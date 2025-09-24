require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require("hardhat-gas-reporter");
require("solidity-coverage");

// Load environment variables
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x" + "1".repeat(64);
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  
  networks: {
    // Local development
    hardhat: {
      chainId: 31337,
      gas: "auto",
      gasPrice: "auto",
    },
    
    // COTI V2 Testnet
    "coti-testnet": {
      url: "https://testnet.coti.io/rpc", // Update with actual RPC URL
      chainId: 7082400, // COTI V2 testnet chain ID
      accounts: [PRIVATE_KEY],
      gas: "auto",
      gasPrice: 5000000000, // 5 gwei - adjust based on network
      timeout: 60000,
      confirmations: 2,
    },
    
    // COTI V2 Mainnet (for future use)
    "coti-mainnet": {
      url: "https://mainnet.coti.io/rpc", // Update with actual RPC URL
      chainId: 7082400, // Update with actual mainnet chain ID
      accounts: [PRIVATE_KEY],
      gas: "auto",
      gasPrice: 5000000000,
      timeout: 60000,
      confirmations: 3,
    },
    
    // Ethereum Sepolia (for resolver testing)
    sepolia: {
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [PRIVATE_KEY],
      chainId: 11155111,
      gas: "auto",
      gasPrice: "auto",
      timeout: 60000,
      confirmations: 2,
    },
    
    // Ethereum Goerli (backup testnet)
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [PRIVATE_KEY],
      chainId: 5,
      gas: "auto",
      gasPrice: "auto",
      timeout: 60000,
      confirmations: 2,
    },
    
    // Ethereum Mainnet (for future production)
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [PRIVATE_KEY],
      chainId: 1,
      gas: "auto",
      gasPrice: "auto",
      timeout: 120000,
      confirmations: 3,
    },
  },
  
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
      goerli: ETHERSCAN_API_KEY,
      mainnet: ETHERSCAN_API_KEY,
      // Add COTI explorer API key when available
      "coti-testnet": "your-coti-explorer-api-key",
      "coti-mainnet": "your-coti-explorer-api-key",
    },
    customChains: [
      {
        network: "coti-testnet",
        chainId: 7082400,
        urls: {
          apiURL: "https://testnet-explorer.coti.io/api", // Update with actual explorer API
          browserURL: "https://testnet-explorer.coti.io" // Update with actual explorer URL
        }
      },
      {
        network: "coti-mainnet",
        chainId: 7082400, // Update with actual mainnet chain ID
        urls: {
          apiURL: "https://explorer.coti.io/api", // Update with actual explorer API
          browserURL: "https://explorer.coti.io" // Update with actual explorer URL
        }
      }
    ]
  },
  
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    coinmarketcap: COINMARKETCAP_API_KEY,
    gasPrice: 20, // gwei
    token: "ETH",
    gasPriceApi: "https://api.etherscan.io/api?module=proxy&action=eth_gasPrice",
    showTimeSpent: true,
    showMethodSig: true,
    maxMethodDiff: 10,
  },
  
  mocha: {
    timeout: 60000,
  },
  
  // Custom tasks
  
  // Task to check network connection
  task: {
    "network-check": {
      description: "Check network connectivity",
      action: async (taskArgs, hre) => {
        const provider = hre.ethers.provider;
        const network = await provider.getNetwork();
        const blockNumber = await provider.getBlockNumber();
        const gasPrice = await provider.getGasPrice();
        
        console.log("Network Info:");
        console.log("- Chain ID:", network.chainId);
        console.log("- Block Number:", blockNumber);
        console.log("- Gas Price:", hre.ethers.formatUnits(gasPrice, "gwei"), "gwei");
        
        const [signer] = await hre.ethers.getSigners();
        const balance = await provider.getBalance(signer.address);
        console.log("- Signer Address:", signer.address);
        console.log("- Balance:", hre.ethers.formatEther(balance), "ETH");
      }
    }
  }
};

// Custom task to check network
task("network-check", "Check network connectivity")
  .setAction(async (taskArgs, hre) => {
    const provider = hre.ethers.provider;
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    const gasPrice = await provider.getGasPrice();
    
    console.log("🌐 Network Info:");
    console.log("- Chain ID:", network.chainId);
    console.log("- Block Number:", blockNumber);
    console.log("- Gas Price:", hre.ethers.formatUnits(gasPrice, "gwei"), "gwei");
    
    const [signer] = await hre.ethers.getSigners();
    const balance = await provider.getBalance(signer.address);
    console.log("- Signer Address:", signer.address);
    console.log("- Balance:", hre.ethers.formatEther(balance), "ETH");
  });

// Custom task to deploy to specific network
task("deploy-all", "Deploy all contracts to specified network")
  .addParam("targetNetwork", "The network to deploy to")
  .setAction(async (taskArgs, hre) => {
    const network = taskArgs.targetNetwork;
    
    console.log(`🚀 Deploying to ${network}...`);
    
    if (network.includes("coti")) {
      await hre.run("run", { script: "scripts/deploy-coti-testnet.js" });
    } else {
      await hre.run("run", { script: "scripts/deploy-ethereum-testnet.js" });
    }
  });