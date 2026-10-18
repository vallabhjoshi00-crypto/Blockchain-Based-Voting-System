import "dotenv/config";
import express from "express";
import { ethers } from "ethers";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// =========================================================
// CONFIGURATION & ENVIRONMENT
// =========================================================
const PORT = process.env.PORT || 3000;
const PRIMARY_RPC = process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const FALLBACK_RPC = process.env.FALLBACK_RPC_URL || "https://eth-sepolia.public.blastapi.io";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0xa899b0F862277c2a8b5566324782Cd189d2c5a3f";
const VOTER_HASH_SALT = process.env.VOTER_HASH_SALT || "Election2026";

// Known default political parties/candidates
const DEFAULT_PARTIES = ["Democracy Forward", "Alliance for Progress", "Liberty Coalition", "Green Earth Party"];

// Backwards-compatible ABI definition
const CONTRACT_ABI = [
  "function castVote(string calldata voterHash, string calldata party) external",
  "function hasVoted(string memory voterHash) public view returns (bool)",
  "function partyVotes(string memory party) public view returns (uint256)",
  "function totalVotes() public view returns (uint256)",
  "function getPartyList() external view returns (string[] memory)",
  "event VoteSecured(string voterHash, string party, uint256 timestamp)"
];

// =========================================================
// TRANSACTION QUEUE (Prevents EVM Nonce Collisions)
// =========================================================
class TransactionQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  async enqueue(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processNext();
    });
  }

  async processNext() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    const { task, resolve, reject } = this.queue.shift();
    try {
      const result = await task();
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      this.processing = false;
      this.processNext();
    }
  }

  get pendingCount() {
    return this.queue.length;
  }
}

const txQueue = new TransactionQueue();

// In-memory ledger of recent transactions
const recentVotes = [];
const MAX_RECENT_LOGS = 100;

// Track active parties
const activeParties = new Set(DEFAULT_PARTIES);

// In-Memory Simulation State (Used if contract is not yet deployed on-chain)
const simulatedVotesSet = new Set();
const simulatedPartyTallies = {};
DEFAULT_PARTIES.forEach(p => simulatedPartyTallies[p] = 0);

// =========================================================
// BLOCKCHAIN PROVIDER & WALLET SETUP
// =========================================================
let provider;
let wallet;
let contract;
let isWalletConfigured = false;
let isContractDeployed = false;
let walletBalanceEth = "0.0";

async function setupBlockchain() {
  try {
    provider = new ethers.JsonRpcProvider(PRIMARY_RPC);
    await provider.getBlockNumber();
    console.log(`📡 Connected to Primary RPC: ${PRIMARY_RPC}`);
  } catch (rpcErr) {
    console.warn(`⚠️ Primary RPC unreachable (${rpcErr.message}), switching to Fallback RPC...`);
    provider = new ethers.JsonRpcProvider(FALLBACK_RPC);
    try {
      await provider.getBlockNumber();
      console.log(`📡 Connected to Fallback RPC: ${FALLBACK_RPC}`);
    } catch (fallbackErr) {
      console.error(`❌ Both RPC endpoints failed:`, fallbackErr.message);
    }
  }

  // Setup Wallet
  const rawKey = (process.env.PRIVATE_KEY || process.env.MNEMONIC || "").trim();

  if (rawKey && !rawKey.includes("YOUR_") && !rawKey.includes("PASTE_")) {
    try {
      if (rawKey.includes(" ")) {
        wallet = ethers.Wallet.fromPhrase(rawKey, provider);
      } else {
        const formattedKey = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
        wallet = new ethers.Wallet(formattedKey, provider);
      }
      contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
      isWalletConfigured = true;

      const bal = await provider.getBalance(wallet.address);
      walletBalanceEth = ethers.formatEther(bal);

      console.log(`👤 Relayer Wallet Address : ${wallet.address}`);
      console.log(`💰 Relayer Wallet Balance : ${walletBalanceEth} ETH`);
    } catch (keyErr) {
      console.error(`❌ Failed to initialize wallet:`, keyErr.message);
      contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    }
  } else {
    console.warn(`⚠️ No private key or mnemonic in .env. Running in READ-ONLY mode.`);
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
  }

  // Check if bytecode exists at CONTRACT_ADDRESS on Sepolia
  try {
    const code = await provider.getCode(CONTRACT_ADDRESS);
    if (code && code !== "0x") {
      isContractDeployed = true;
      console.log(`📜 Target Contract Verified : ${CONTRACT_ADDRESS} (Live Bytecode Found)`);
    } else {
      isContractDeployed = false;
      console.log(`ℹ️ Notice: CONTRACT_ADDRESS (${CONTRACT_ADDRESS}) currently has no contract bytecode deployed.`);
      console.log(`💡 The server will seamlessly run in Hybrid Simulation Mode until deployed via 'npm run deploy'.`);
    }
  } catch (err) {
    isContractDeployed = false;
  }
}

// Initialize blockchain connectivity
await setupBlockchain();

// =========================================================
// HELPER FUNCTIONS
// =========================================================
export function hashVoterId(voterId, salt = VOTER_HASH_SALT) {
  return crypto.createHash("sha256").update(`${voterId}_${salt}`).digest("hex");
}

// =========================================================
// MIDDLEWARE
// =========================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS headers
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// Structured request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api/")) {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Static assets
app.use(express.static(path.join(__dirname, "public")));

// =========================================================
// REST API ENDPOINTS
// =========================================================

/**
 * POST /api/blockchain/vote
 * Core endpoint receiving vote requests from ESP32, n8n, or web dashboard.
 */
app.post("/api/blockchain/vote", async (req, res) => {
  try {
    const { voterID, hashID, party } = req.body;
    let voterHash = req.body.voterHash || hashID;

    // Automatic SHA-256 identity anonymization if raw voterID provided
    if (!voterHash && voterID) {
      voterHash = hashVoterId(voterID);
    }

    if (!voterHash || !party) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: provide 'voterID' or 'voterHash', along with 'party'."
      });
    }

    const candidateParty = party.trim();
    activeParties.add(candidateParty);

    console.log(`\n===========================================`);
    console.log(`📥 INCOMING VOTE INGESTED`);
    console.log(`   • Raw Voter ID : ${voterID || "N/A (Pre-hashed)"}`);
    console.log(`   • SHA-256 Hash : ${voterHash}`);
    console.log(`   • Candidate    : ${candidateParty}`);
    console.log(`===========================================`);

    // Pre-Flight Fraud Verification: Check if hash already exists
    let alreadyVoted = false;

    if (isContractDeployed && contract) {
      try {
        alreadyVoted = await contract.hasVoted(voterHash);
      } catch (checkErr) {
        console.warn("⚠️ Contract preflight warning:", checkErr.message);
        alreadyVoted = simulatedVotesSet.has(voterHash);
      }
    } else {
      alreadyVoted = simulatedVotesSet.has(voterHash);
    }

    if (alreadyVoted) {
      console.warn(`🛑 FRAUD DETECTED: Voter hash ${voterHash} already recorded!`);
      return res.status(409).json({
        success: false,
        fraudAlert: true,
        error: "Fraud Alert: This voter has already recorded a vote on the Ethereum blockchain!",
        voterHash
      });
    }

    // Check if on-chain transaction can proceed
    const canBroadcastOnChain = isContractDeployed && isWalletConfigured && wallet && Number(walletBalanceEth) > 0;

    let txHash;
    let blockNumber;
    let etherscanUrl;

    if (canBroadcastOnChain) {
      // Execute through sequential transaction queue to avoid EVM nonce collisions
      const receipt = await txQueue.enqueue(async () => {
        console.log(`⏳ Submitting transaction to Sepolia Ethereum network for ${candidateParty}...`);
        const tx = await contract.castVote(voterHash, candidateParty);
        console.log(`🚀 Transaction broadcasted! Hash: ${tx.hash}`);

        console.log(`⏳ Awaiting block confirmation...`);
        const confirmedReceipt = await tx.wait(1);
        return { tx, confirmedReceipt };
      });

      txHash = receipt.confirmedReceipt.hash || receipt.tx.hash;
      blockNumber = receipt.confirmedReceipt.blockNumber;
      etherscanUrl = `https://sepolia.etherscan.io/tx/${txHash}`;
      console.log(`✅ VOTE MINED IN BLOCK #${blockNumber}`);
    } else {
      // Hybrid High-Fidelity Simulation (for local testing before funding/deploying contract)
      const currentBlock = provider ? await provider.getBlockNumber() : 11935280;
      blockNumber = currentBlock;
      txHash = "0x" + crypto.randomBytes(32).toString("hex");
      etherscanUrl = `https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`;

      simulatedVotesSet.add(voterHash);
      simulatedPartyTallies[candidateParty] = (simulatedPartyTallies[candidateParty] || 0) + 1;

      console.log(`✅ [SIMULATION CONFIRMED] Hash recorded: ${voterHash}`);
      console.log(`   • Simulated Block : #${blockNumber}`);
      console.log(`   • Simulated Tx    : ${txHash}`);
    }

    const voteRecord = {
      id: crypto.randomUUID(),
      voterHash,
      party: candidateParty,
      transactionHash: txHash,
      blockNumber,
      etherscanLink: etherscanUrl,
      isSimulation: !canBroadcastOnChain,
      timestamp: new Date().toISOString()
    };

    recentVotes.unshift(voteRecord);
    if (recentVotes.length > MAX_RECENT_LOGS) recentVotes.pop();

    return res.status(200).json({
      success: true,
      message: canBroadcastOnChain 
        ? "Vote permanently secured on Ethereum Sepolia ledger!" 
        : "Vote verified & recorded in biometric consensus pipeline (Simulation Mode).",
      voterHash,
      party: candidateParty,
      blockNumber,
      transactionHash: txHash,
      etherscanLink: etherscanUrl,
      timestamp: voteRecord.timestamp,
      isSimulation: !canBroadcastOnChain
    });

  } catch (error) {
    console.error("❌ Blockchain Submission Error:", error.reason || error.message);
    return res.status(500).json({
      success: false,
      error: error.reason || error.message || "Blockchain transaction failed"
    });
  }
});

/**
 * GET /api/blockchain/votes
 * Returns tallies for all active parties
 */
app.get("/api/blockchain/votes", async (req, res) => {
  try {
    let partyList = Array.from(activeParties);
    const tallies = {};
    let totalVotes = 0;

    if (isContractDeployed && contract) {
      await Promise.all(
        partyList.map(async (party) => {
          try {
            const count = await contract.partyVotes(party);
            const num = Number(count);
            tallies[party] = num;
            totalVotes += num;
          } catch {
            tallies[party] = simulatedPartyTallies[party] || 0;
            totalVotes += tallies[party];
          }
        })
      );
    } else {
      partyList.forEach((party) => {
        const count = simulatedPartyTallies[party] || 0;
        tallies[party] = count;
        totalVotes += count;
      });
    }

    return res.status(200).json({
      success: true,
      totalVotes,
      parties: tallies,
      contractAddress: CONTRACT_ADDRESS,
      network: "Ethereum Sepolia",
      isContractDeployed
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/blockchain/votes/:party
 */
app.get("/api/blockchain/votes/:party", async (req, res) => {
  try {
    const party = req.params.party;
    let count = 0;

    if (isContractDeployed && contract) {
      try {
        const val = await contract.partyVotes(party);
        count = val.toString();
      } catch {
        count = String(simulatedPartyTallies[party] || 0);
      }
    } else {
      count = String(simulatedPartyTallies[party] || 0);
    }

    return res.status(200).json({
      success: true,
      party,
      totalVotes: count
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/blockchain/hasVoted/:voterHash
 */
app.get("/api/blockchain/hasVoted/:voterHash", async (req, res) => {
  try {
    let voterHash = req.params.voterHash;
    if (req.query.isRawId === "true") {
      voterHash = hashVoterId(voterHash);
    }

    let hasVotedStatus = false;
    if (isContractDeployed && contract) {
      try {
        hasVotedStatus = await contract.hasVoted(voterHash);
      } catch {
        hasVotedStatus = simulatedVotesSet.has(voterHash);
      }
    } else {
      hasVotedStatus = simulatedVotesSet.has(voterHash);
    }

    return res.status(200).json({
      success: true,
      voterHash,
      hasVoted: Boolean(hasVotedStatus),
      isContractDeployed
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/blockchain/hash
 */
app.post("/api/blockchain/hash", (req, res) => {
  const { voterID, salt } = req.body;
  if (!voterID) {
    return res.status(400).json({ success: false, error: "Missing voterID in request body" });
  }
  const voterHash = hashVoterId(voterID, salt || VOTER_HASH_SALT);
  return res.status(200).json({
    success: true,
    voterID,
    salt: salt || VOTER_HASH_SALT,
    voterHash
  });
});

/**
 * GET /api/blockchain/recent
 */
app.get("/api/blockchain/recent", (req, res) => {
  return res.status(200).json({
    success: true,
    count: recentVotes.length,
    votes: recentVotes
  });
});

/**
 * GET /api/health
 */
app.get("/api/health", async (req, res) => {
  try {
    let blockNumber = null;
    let latencyMs = null;

    if (provider) {
      const start = Date.now();
      blockNumber = await provider.getBlockNumber();
      latencyMs = Date.now() - start;

      if (wallet) {
        const bal = await provider.getBalance(wallet.address);
        walletBalanceEth = ethers.formatEther(bal);
      }
    }

    return res.status(200).json({
      status: "healthy",
      mode: isContractDeployed ? "ON_CHAIN_LIVE" : "SIMULATION_FALLBACK",
      timestamp: new Date().toISOString(),
      network: {
        name: "Ethereum Sepolia",
        chainId: 11155111,
        rpcUrl: PRIMARY_RPC,
        blockNumber,
        latencyMs
      },
      contract: {
        address: CONTRACT_ADDRESS,
        bytecodeDeployed: isContractDeployed,
        etherscanUrl: `https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`
      },
      relayer: {
        configured: isWalletConfigured,
        address: wallet ? wallet.address : "Not Configured",
        balanceEth: walletBalanceEth
      },
      queue: {
        pendingTasks: txQueue.pendingCount
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: "degraded",
      error: error.message
    });
  }
});

/**
 * POST /webhook-test/voters
 */
app.post("/webhook-test/voters", (req, res) => {
  console.log("📥 Raw ESP32 Test Packet Received:", req.body);
  res.status(200).json({
    message: "ESP32 data received successfully by Node.js server",
    payload: req.body,
    receivedAt: new Date().toISOString()
  });
});

// Fallback to dashboard for unknown routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// =========================================================
// START SERVER
// =========================================================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n======================================================`);
  console.log(`🚀 BIOMETRIC BLOCKCHAIN VOTING RELAY ACTIVE`);
  console.log(`📡 Listening on      : http://0.0.0.0:${PORT}`);
  console.log(`🖥️  Live Dashboard    : http://localhost:${PORT}`);
  console.log(`📜 Contract Address  : ${CONTRACT_ADDRESS}`);
  console.log(`🌐 Network           : Ethereum Sepolia Testnet`);
  console.log(`⚙️  Operating Mode    : ${isContractDeployed ? "ON_CHAIN_LIVE" : "HYBRID SIMULATION"}`);
  console.log(`======================================================\n`);
});