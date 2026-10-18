const express = require('express');
const { ethers } = require('ethers');

const app = express();
app.use(express.json());

// --- BLOCKCHAIN SETTINGS ---
// Get a free RPC URL from Alchemy or Infura (Sepolia Testnet)
const RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY"; 
// Export your MetaMask Private Key (NEVER share this or use a wallet with real money)
const PRIVATE_KEY = "YOUR_METAMASK_PRIVATE_KEY"; 
// The address from Remix
const CONTRACT_ADDRESS = "YOUR_CONTRACT_ADDRESS"; 

// The ABI tells ethers.js how to talk to the contract
const CONTRACT_ABI = [
    "function castVote(string memory voterHash, string memory party) public"
];

app.post('/api/blockchain/vote', async (req, res) => {
    try {
        const { voterHash, party } = req.body;
        console.log(`📥 Received verified vote from n8n for hash: ${voterHash}`);

        // 1. Connect to the Blockchain Network
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

        // 2. Execute the Smart Contract Function
        console.log("⏳ Sending to Ethereum network...");
        const tx = await contract.castVote(voterHash, party);
        
        // 3. Wait for the block to be mined
        const receipt = await tx.wait();

        console.log(`✅ Success! Block Hash: ${receipt.hash}`);
        
        // 4. Send the public Etherscan link back to n8n
        res.status(200).json({ 
            success: true, 
            transactionHash: receipt.hash,
            etherscanLink: `https://sepolia.etherscan.io/tx/${receipt.hash}`
        });

    } catch (error) {
        console.error("❌ Blockchain Transaction Failed:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(3000, '0.0.0.0', () => {
    console.log("🔗 Web3 Bridge is running on port 3000");
});