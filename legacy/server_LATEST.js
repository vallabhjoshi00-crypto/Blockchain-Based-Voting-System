const express = require('express');
const { ethers } = require('ethers');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// --- BLOCKCHAIN CONFIGURATION ---
const RPC_URL = process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

// Paste either your 64-character Hex Private Key OR your 12-word Seed Phrase here
const PRIVATE_KEY_OR_MNEMONIC = process.env.PRIVATE_KEY || "sniff increase thumb sauce device brown sponsor canyon feature zone endless toddler";

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0xa899b0F862277c2a8b5566324782Cd189d2c5a3f";

const CONTRACT_ABI = [
    "function castVote(string memory voterHash, string memory party) public",
    "function hasVoted(string memory voterHash) public view returns (bool)",
    "function partyVotes(string memory party) public view returns (uint256)"
];

// Initialize Provider
const provider = new ethers.JsonRpcProvider(RPC_URL);

// Safely initialize Wallet depending on input type (Seed Phrase vs Private Key)
let wallet;
const inputKey = PRIVATE_KEY_OR_MNEMONIC.trim();

if (inputKey.includes(" ")) {
    // 12-word Mnemonic Phrase
    wallet = ethers.Wallet.fromPhrase(inputKey, provider);
} else {
    // 64-character Hex Private Key
    wallet = new ethers.Wallet(inputKey, provider);
}

const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

// ---------------------------------------------------------
// ENDPOINT 1: Submit Vote to Blockchain (POST)
// ---------------------------------------------------------
app.post('/api/blockchain/vote', async (req, res) => {
    try {
        const { voterHash, party } = req.body;

        if (!voterHash || !party) {
            return res.status(400).json({
                success: false,
                error: "Both 'voterHash' and 'party' are required in the JSON payload."
            });
        }

        console.log(`\n📥 Received vote request:`);
        console.log(`   • Voter Hash : ${voterHash}`);
        console.log(`   • Candidate  : ${party}`);

        // Pre-flight Check: Prevent wasting gas if the voter already cast a vote
        const alreadyVoted = await contract.hasVoted(voterHash);
        if (alreadyVoted) {
            console.log(`⚠️ Fraud Prevention: Voter ${voterHash} has already voted on-chain.`);
            return res.status(400).json({
                success: false,
                error: "Fraud Alert: This voter hash has already been recorded on the blockchain!"
            });
        }

        console.log("⏳ Submitting transaction to Sepolia network...");
        const tx = await contract.castVote(voterHash, party);
        console.log(`🚀 Transaction broadcasted! Hash: ${tx.hash}`);

        console.log("⏳ Waiting for block confirmation...");
        const receipt = await tx.wait();

        const transactionHash = receipt.hash || tx.hash;
        const etherscanUrl = `https://sepolia.etherscan.io/tx/${transactionHash}`;

        console.log(`✅ Block Mined successfully! Block #${receipt.blockNumber}`);
        console.log(`🔗 Public Receipt: ${etherscanUrl}`);

        return res.status(200).json({
            success: true,
            message: "Vote permanently recorded on Ethereum ledger!",
            voterHash: voterHash,
            party: party,
            blockNumber: receipt.blockNumber,
            transactionHash: transactionHash,
            etherscanLink: etherscanUrl
        });

    } catch (error) {
        console.error("❌ Blockchain Transaction Failed:", error);
        return res.status(500).json({
            success: false,
            error: error.reason || error.message || "Failed to process transaction"
        });
    }
});

// ---------------------------------------------------------
// ENDPOINT 2: Read Vote Tally for a Party (GET)
// ---------------------------------------------------------
app.get('/api/blockchain/votes/:party', async (req, res) => {
    try {
        const party = req.params.party;
        const totalVotes = await contract.partyVotes(party);

        return res.status(200).json({
            success: true,
            party: party,
            totalVotes: totalVotes.toString()
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

// ---------------------------------------------------------
// ENDPOINT 3: Check If a Voter Hash Exists (GET)
// ---------------------------------------------------------
app.get('/api/blockchain/hasVoted/:voterHash', async (req, res) => {
    try {
        const voterHash = req.params.voterHash;
        const hasVotedStatus = await contract.hasVoted(voterHash);

        return res.status(200).json({
            success: true,
            voterHash: voterHash,
            hasVoted: hasVotedStatus
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

// ---------------------------------------------------------
// START SERVER
// ---------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n==================================================`);
    console.log(`🔗 Web3 Blockchain Bridge Active on Port ${PORT}`);
    console.log(`📜 Contract : ${CONTRACT_ADDRESS}`);
    console.log(`🌐 Network  : Ethereum Sepolia Testnet`);
    console.log(`==================================================\n`);
});