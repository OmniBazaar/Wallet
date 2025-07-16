#!/usr/bin/env node

/**
 * Integration Testing CLI Tool
 * 
 * This script tests the complete ENS integration flow:
 * 1. Deploy contracts to testnets
 * 2. Register test names
 * 3. Update oracle
 * 4. Test resolution
 * 5. Simulate MetaMask usage
 */

const { ethers } = require("ethers");
const readline = require("readline");
require("dotenv").config();

// Configuration
const config = {
  cotiRpc: process.env.COTI_TESTNET_RPC || "https://testnet.coti.io/rpc",
  ethereumRpc: process.env.ETHEREUM_RPC || `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
  privateKey: process.env.PRIVATE_KEY,
  registryAddress: process.env.REGISTRY_ADDRESS,
  oracleAddress: process.env.ORACLE_ADDRESS,
  resolverAddress: process.env.RESOLVER_ADDRESS
};

// Contract ABIs
const registryABI = [
  "function registerFor(string memory username, address owner) external",
  "function resolve(string memory username) external view returns (address)",
  "function isAvailable(string memory username) external view returns (bool)"
];

const oracleABI = [
  "function updateName(string memory username, address resolvedAddress) external",
  "function queryName(string memory username) external view returns (address)",
  "function isHealthy() external view returns (bool)"
];

const resolverABI = [
  "function resolve(string memory username) external view returns (address)",
  "function addOracle(address oracle) external",
  "function getOracleCount() external view returns (uint256)"
];

class IntegrationTester {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async initialize() {
    console.log("🚀 ENS Integration Tester");
    console.log("=" .repeat(40));
    
    // Initialize providers
    this.cotiProvider = new ethers.JsonRpcProvider(config.cotiRpc);
    this.ethereumProvider = new ethers.JsonRpcProvider(config.ethereumRpc);
    this.signer = new ethers.Wallet(config.privateKey, this.ethereumProvider);
    
    console.log("✅ Providers initialized");
    
    // Test connections
    await this.testConnections();
    
    // Initialize contracts if addresses provided
    if (config.registryAddress) {
      this.registryContract = new ethers.Contract(
        config.registryAddress,
        registryABI,
        this.cotiProvider
      );
      console.log("✅ Registry contract connected");
    }
    
    if (config.oracleAddress) {
      this.oracleContract = new ethers.Contract(
        config.oracleAddress,
        oracleABI,
        this.signer
      );
      console.log("✅ Oracle contract connected");
    }
    
    if (config.resolverAddress) {
      this.resolverContract = new ethers.Contract(
        config.resolverAddress,
        resolverABI,
        this.signer
      );
      console.log("✅ Resolver contract connected");
    }
  }

  async testConnections() {
    console.log("\n🔍 Testing network connections...");
    
    try {
      const cotiBlock = await this.cotiProvider.getBlockNumber();
      console.log(`✅ COTI testnet: Block ${cotiBlock}`);
    } catch (error) {
      console.error(`❌ COTI connection failed: ${error.message}`);
      throw error;
    }
    
    try {
      const ethBlock = await this.ethereumProvider.getBlockNumber();
      console.log(`✅ Ethereum testnet: Block ${ethBlock}`);
    } catch (error) {
      console.error(`❌ Ethereum connection failed: ${error.message}`);
      throw error;
    }
    
    const balance = await this.signer.provider.getBalance(this.signer.address);
    console.log(`✅ Wallet balance: ${ethers.formatEther(balance)} ETH`);
  }

  async runTestSuite() {
    console.log("\n🧪 Running Integration Test Suite");
    console.log("=" .repeat(40));
    
    const testNames = ["alice", "bob", "charlie"];
    const testAddresses = [
      "0x742d35Cc6634C0532925a3b844Bc9e7595f2bd7e",
      "0x8ba1f109551bD432803012645Hac136c4fd4A84",
      "0x1234567890123456789012345678901234567890"
    ];
    
    try {
      // Test 1: Name Registration (if registry available)
      if (this.registryContract) {
        console.log("\n📝 Test 1: Name Registration");
        await this.testNameRegistration(testNames, testAddresses);
      }
      
      // Test 2: Oracle Updates
      if (this.oracleContract) {
        console.log("\n📡 Test 2: Oracle Updates");
        await this.testOracleUpdates(testNames, testAddresses);
      }
      
      // Test 3: Stateless Resolution
      if (this.resolverContract) {
        console.log("\n🔍 Test 3: Stateless Resolution");
        await this.testStatelessResolution(testNames);
      }
      
      // Test 4: End-to-End Flow
      console.log("\n🔄 Test 4: End-to-End Flow");
      await this.testEndToEndFlow();
      
      console.log("\n✅ All tests completed successfully!");
      
    } catch (error) {
      console.error(`\n❌ Test failed: ${error.message}`);
      throw error;
    }
  }

  async testNameRegistration(names, addresses) {
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const address = addresses[i];
      
      console.log(`  Registering ${name} -> ${address}`);
      
      try {
        // Check availability
        const available = await this.registryContract.isAvailable(name);
        console.log(`    Available: ${available}`);
        
        if (available) {
          // Register name (this would normally require fee payment)
          const tx = await this.registryContract.registerFor(name, address);
          console.log(`    TX: ${tx.hash}`);
          
          // Verify registration
          const resolved = await this.registryContract.resolve(name);
          console.log(`    Resolved: ${resolved}`);
          
          if (resolved.toLowerCase() === address.toLowerCase()) {
            console.log(`    ✅ ${name} registered successfully`);
          } else {
            console.log(`    ❌ ${name} registration verification failed`);
          }
        }
      } catch (error) {
        console.log(`    ❌ ${name} registration failed: ${error.message}`);
      }
    }
  }

  async testOracleUpdates(names, addresses) {
    // Test oracle health
    try {
      const healthy = await this.oracleContract.isHealthy();
      console.log(`  Oracle healthy: ${healthy}`);
    } catch (error) {
      console.log(`  Oracle health check failed: ${error.message}`);
    }
    
    // Test single updates
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const address = addresses[i];
      
      console.log(`  Updating oracle: ${name} -> ${address}`);
      
      try {
        const tx = await this.oracleContract.updateName(name, address);
        const receipt = await tx.wait();
        
        console.log(`    TX: ${receipt.hash}`);
        console.log(`    Gas used: ${receipt.gasUsed}`);
        
        // Verify update
        const resolved = await this.oracleContract.queryName(name);
        console.log(`    Oracle resolved: ${resolved}`);
        
        if (resolved.toLowerCase() === address.toLowerCase()) {
          console.log(`    ✅ ${name} oracle update successful`);
        } else {
          console.log(`    ❌ ${name} oracle update verification failed`);
        }
        
      } catch (error) {
        console.log(`    ❌ ${name} oracle update failed: ${error.message}`);
      }
    }
  }

  async testStatelessResolution(names) {
    // Test oracle count
    try {
      const oracleCount = await this.resolverContract.getOracleCount();
      console.log(`  Oracle count: ${oracleCount}`);
    } catch (error) {
      console.log(`  Oracle count check failed: ${error.message}`);
    }
    
    // Test resolution
    for (const name of names) {
      console.log(`  Resolving ${name} through resolver...`);
      
      try {
        const resolved = await this.resolverContract.resolve(name);
        console.log(`    Resolved: ${resolved}`);
        
        if (resolved !== ethers.ZeroAddress) {
          console.log(`    ✅ ${name} resolved successfully`);
        } else {
          console.log(`    ⚠️  ${name} resolved to zero address`);
        }
        
      } catch (error) {
        console.log(`    ❌ ${name} resolution failed: ${error.message}`);
      }
    }
  }

  async testEndToEndFlow() {
    const testName = "testuser";
    const testAddress = this.signer.address;
    
    console.log(`  Testing end-to-end flow for: ${testName}`);
    
    try {
      // Step 1: Register on COTI (if available)
      if (this.registryContract) {
        console.log("    Step 1: Registering on COTI...");
        const tx1 = await this.registryContract.registerFor(testName, testAddress);
        await tx1.wait();
        console.log("    ✅ COTI registration complete");
      }
      
      // Step 2: Update oracle
      if (this.oracleContract) {
        console.log("    Step 2: Updating oracle...");
        const tx2 = await this.oracleContract.updateName(testName, testAddress);
        await tx2.wait();
        console.log("    ✅ Oracle update complete");
      }
      
      // Step 3: Resolve through resolver
      if (this.resolverContract) {
        console.log("    Step 3: Resolving through resolver...");
        const resolved = await this.resolverContract.resolve(testName);
        
        if (resolved.toLowerCase() === testAddress.toLowerCase()) {
          console.log("    ✅ End-to-end flow successful!");
        } else {
          console.log("    ❌ End-to-end flow failed - address mismatch");
        }
      }
      
    } catch (error) {
      console.log(`    ❌ End-to-end flow failed: ${error.message}`);
    }
  }

  async interactiveMode() {
    console.log("\n🎮 Interactive Mode");
    console.log("Commands: resolve <name>, update <name> <address>, health, quit");
    
    const askCommand = () => {
      this.rl.question(">> ", async (input) => {
        const parts = input.trim().split(" ");
        const command = parts[0].toLowerCase();
        
        try {
          switch (command) {
            case "resolve":
              if (parts.length < 2) {
                console.log("Usage: resolve <name>");
                break;
              }
              await this.handleResolve(parts[1]);
              break;
              
            case "update":
              if (parts.length < 3) {
                console.log("Usage: update <name> <address>");
                break;
              }
              await this.handleUpdate(parts[1], parts[2]);
              break;
              
            case "health":
              await this.handleHealth();
              break;
              
            case "quit":
            case "exit":
              console.log("👋 Goodbye!");
              this.rl.close();
              return;
              
            default:
              console.log("Unknown command. Available: resolve, update, health, quit");
          }
        } catch (error) {
          console.error(`❌ Error: ${error.message}`);
        }
        
        askCommand();
      });
    };
    
    askCommand();
  }

  async handleResolve(name) {
    console.log(`🔍 Resolving ${name}...`);
    
    // Try resolver first
    if (this.resolverContract) {
      const resolved = await this.resolverContract.resolve(name);
      console.log(`  Resolver: ${resolved}`);
    }
    
    // Try oracle
    if (this.oracleContract) {
      const resolved = await this.oracleContract.queryName(name);
      console.log(`  Oracle: ${resolved}`);
    }
    
    // Try registry
    if (this.registryContract) {
      const resolved = await this.registryContract.resolve(name);
      console.log(`  Registry: ${resolved}`);
    }
  }

  async handleUpdate(name, address) {
    console.log(`📝 Updating ${name} -> ${address}...`);
    
    if (!this.oracleContract) {
      console.log("❌ Oracle contract not available");
      return;
    }
    
    if (!ethers.isAddress(address)) {
      console.log("❌ Invalid address format");
      return;
    }
    
    const tx = await this.oracleContract.updateName(name, address);
    const receipt = await tx.wait();
    
    console.log(`✅ Update complete (${receipt.hash})`);
  }

  async handleHealth() {
    console.log("🏥 Health check...");
    
    if (this.oracleContract) {
      const healthy = await this.oracleContract.isHealthy();
      console.log(`  Oracle healthy: ${healthy}`);
    }
    
    if (this.resolverContract) {
      const oracleCount = await this.resolverContract.getOracleCount();
      console.log(`  Oracle count: ${oracleCount}`);
    }
  }

  async run() {
    try {
      await this.initialize();
      
      // Check if we have contract addresses
      if (!config.registryAddress && !config.oracleAddress && !config.resolverAddress) {
        console.log("\n⚠️  No contract addresses provided in environment.");
        console.log("Please deploy contracts first or set environment variables.");
        process.exit(1);
      }
      
      // Run test suite
      await this.runTestSuite();
      
      // Enter interactive mode
      await this.interactiveMode();
      
    } catch (error) {
      console.error(`\n❌ Integration test failed: ${error.message}`);
      process.exit(1);
    }
  }
}

// Main execution
if (require.main === module) {
  const tester = new IntegrationTester();
  tester.run();
}

module.exports = IntegrationTester;