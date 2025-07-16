const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying Oracle and Resolver to Ethereum Testnet...");
  
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)));

  // Deploy OmniOracle first
  console.log("\n📡 Deploying OmniOracle...");
  const OmniOracle = await ethers.getContractFactory("OmniOracle");
  const oracle = await OmniOracle.deploy();
  await oracle.waitForDeployment();
  
  const oracleAddress = await oracle.getAddress();
  console.log("✅ OmniOracle deployed to:", oracleAddress);
  
  // Deploy OmniStatelessResolver
  console.log("\n🔍 Deploying OmniStatelessResolver...");
  const OmniStatelessResolver = await ethers.getContractFactory("OmniStatelessResolver");
  const resolver = await OmniStatelessResolver.deploy();
  await resolver.waitForDeployment();
  
  const resolverAddress = await resolver.getAddress();
  console.log("✅ OmniStatelessResolver deployed to:", resolverAddress);
  
  // Configure the resolver to use the oracle
  console.log("\n⚙️ Configuring contracts...");
  
  // Add oracle to resolver
  await resolver.addOracle(oracleAddress);
  console.log("✅ Oracle added to resolver");
  
  // Add deployer as authorized updater to oracle
  await oracle.addUpdater(deployer.address);
  console.log("✅ Deployer added as oracle updater");
  
  // Test the setup
  console.log("\n🧪 Testing setup...");
  
  // Add some test data to oracle
  await oracle.updateName("alice", deployer.address);
  await oracle.updateName("bob", "0x742d35Cc6634C0532925a3b844Bc9e7595f2bd7e");
  console.log("✅ Test names added to oracle");
  
  // Test resolution through resolver
  const aliceResolved = await resolver.resolve("alice");
  console.log("Alice resolves to:", aliceResolved);
  
  const bobResolved = await resolver.resolve("bob");
  console.log("Bob resolves to:", bobResolved);
  
  // Test batch update
  console.log("\n📦 Testing batch update...");
  const testUsernames = ["charlie", "david", "eve"];
  const testAddresses = [
    "0x123456789abcdef123456789abcdef123456789",
    "0x987654321fedcba987654321fedcba987654321",
    "0x456789abcdef123456789abcdef123456789abc"
  ];
  
  await oracle.batchUpdateNames(testUsernames, testAddresses);
  console.log("✅ Batch update completed");
  
  // Verify batch update
  for (let i = 0; i < testUsernames.length; i++) {
    const resolved = await resolver.resolve(testUsernames[i]);
    console.log(`${testUsernames[i]} resolves to: ${resolved}`);
  }
  
  // Test oracle health
  const isHealthy = await oracle.isHealthy();
  console.log("Oracle healthy:", isHealthy);
  
  const oracleStats = await oracle.getOracleStats();
  console.log("Oracle stats:", {
    lastUpdate: new Date(Number(oracleStats[0]) * 1000).toISOString(),
    reputation: oracleStats[1].toString(),
    healthy: oracleStats[2]
  });
  
  console.log("\n📋 Deployment Summary:");
  console.log("=".repeat(60));
  console.log("OmniOracle Address:", oracleAddress);
  console.log("OmniStatelessResolver Address:", resolverAddress);
  console.log("Network: Ethereum Testnet");
  console.log("Oracle Count:", (await resolver.getOracleCount()).toString());
  console.log("Active Oracles:", await resolver.getActiveOracles());
  console.log("=".repeat(60));
  
  // Save deployment info
  const deploymentInfo = {
    oracleAddress: oracleAddress,
    resolverAddress: resolverAddress,
    network: "ethereum-testnet",
    deployer: deployer.address,
    blockNumber: await deployer.provider.getBlockNumber(),
    timestamp: new Date().toISOString(),
    testData: {
      alice: aliceResolved,
      bob: bobResolved,
      batchUsers: testUsernames,
      batchAddresses: testAddresses
    }
  };
  
  const fs = require('fs');
  const path = require('path');
  
  // Create deployments directory if it doesn't exist
  const deploymentsDir = './deployments';
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(deploymentsDir, 'ethereum-testnet.json'),
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("💾 Deployment info saved to ./deployments/ethereum-testnet.json");
  
  // Generate integration guide
  const integrationGuide = `
# Integration Guide

## Contract Addresses
- Oracle: ${oracleAddress}
- Resolver: ${resolverAddress}

## For Node Operators:
1. Get authorized as oracle updater:
   oracle.addUpdater(YOUR_NODE_ADDRESS)

2. Update names from COTI chain:
   oracle.updateName("username", "0x...")
   
3. Batch update for efficiency:
   oracle.batchUpdateNames(usernames[], addresses[])

## For Wallet Integration:
1. Add resolver to your wallet:
   const resolver = new ethers.Contract("${resolverAddress}", ABI, provider)

2. Resolve names:
   const address = await resolver.resolve("username")

## Test Commands:
- Check oracle health: oracle.isHealthy()
- Get oracle stats: oracle.getOracleStats()
- Test resolution: resolver.resolve("alice")
`;
  
  fs.writeFileSync('./INTEGRATION_GUIDE.md', integrationGuide);
  console.log("📖 Integration guide saved to ./INTEGRATION_GUIDE.md");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });