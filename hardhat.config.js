import "dotenv/config";

const config = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./contract",
    artifacts: "./artifacts",
    cache: "./cache",
  },
  networks: {
    sepolia: {
      type: "http",
      url: process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
      accounts: process.env.PRIVATE_KEY && !process.env.PRIVATE_KEY.includes("YOUR_")
        ? [process.env.PRIVATE_KEY.trim()]
        : [],
    },
  },
};

export default config;