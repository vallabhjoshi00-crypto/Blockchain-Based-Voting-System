import "dotenv/config";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("\n=======================================================");
  console.log("🚀 DEPLOYING VOTING REGISTRY SMART CONTRACT TO SEPOLIA");
  console.log("=======================================================\n");

  const rpcUrl = process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
  const rawKey = process.env.PRIVATE_KEY || process.env.MNEMONIC;

  if (!rawKey || rawKey.includes("YOUR_ACTUAL") || rawKey.includes("YOUR_METAMASK")) {
    console.error("❌ Error: Valid PRIVATE_KEY or MNEMONIC is not configured in .env file.");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  let wallet;

  const trimmedKey = rawKey.trim();
  if (trimmedKey.includes(" ")) {
    wallet = ethers.Wallet.fromPhrase(trimmedKey, provider);
  } else {
    const formattedKey = trimmedKey.startsWith("0x") ? trimmedKey : `0x${trimmedKey}`;
    wallet = new ethers.Wallet(formattedKey, provider);
  }

  const balance = await provider.getBalance(wallet.address);
  console.log(`📡 Connected Network RPC : ${rpcUrl}`);
  console.log(`👤 Deployer Address      : ${wallet.address}`);
  console.log(`💰 Deployer Balance      : ${ethers.formatEther(balance)} ETH\n`);

  if (balance === 0n) {
    console.warn("⚠️ Warning: Deployer balance is 0 ETH. Get Sepolia testnet ETH before deploying.");
  }

  const artifactPath = path.resolve(__dirname, "../artifacts/contract/VotingRegistry.sol/VotingRegistry.json");
  if (!fs.existsSync(artifactPath)) {
    console.error(`❌ Artifact not found at ${artifactPath}. Run 'npm run compile' first.`);
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  console.log("⏳ Broadcasting deployment transaction...");
  const contract = await factory.deploy();
  console.log(`⛓️  Deployment Tx Hash    : ${contract.deploymentTransaction().hash}`);

  console.log("⏳ Awaiting block confirmation...");
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log(`\n🎉 CONTRACT DEPLOYED SUCCESSFULLY!`);
  console.log(`📜 Contract Address       : ${contractAddress}`);
  console.log(`🔗 Etherscan Contract URL : https://sepolia.etherscan.io/address/${contractAddress}`);

  // Automatically update .env if file exists
  const envPath = path.resolve(__dirname, "../.env");
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, "utf-8");
    if (envContent.includes("CONTRACT_ADDRESS=")) {
      envContent = envContent.replace(/CONTRACT_ADDRESS=.*(\r?\n|$)/, `CONTRACT_ADDRESS="${contractAddress}"$1`);
    } else {
      envContent += `\nCONTRACT_ADDRESS="${contractAddress}"\n`;
    }
    fs.writeFileSync(envPath, envContent, "utf-8");
    console.log(`📝 Updated CONTRACT_ADDRESS in .env`);
  }
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});