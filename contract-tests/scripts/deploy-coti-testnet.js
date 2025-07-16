const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying OmniNameRegistry to COTI V2 Testnet...");
  
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)));

  // Deploy OmniNameRegistry
  const OmniNameRegistry = await ethers.getContractFactory("OmniNameRegistry");
  const nameRegistry = await OmniNameRegistry.deploy();
  await nameRegistry.waitForDeployment();
  
  const registryAddress = await nameRegistry.getAddress();
  console.log("✅ OmniNameRegistry deployed to:", registryAddress);
  
  // Set registration fee to 1 XOM (in wei)
  const registrationFee = ethers.parseEther("1");
  console.log("Setting registration fee to 1 XOM...");
  await nameRegistry.setRegistrationFee(registrationFee);
  
  // Test basic functionality
  console.log("\n🧪 Testing basic functionality...");
  
  // Check if 'alice' is available
  const isAliceAvailable = await nameRegistry.isAvailable("alice");
  console.log("Is 'alice' available?", isAliceAvailable);
  
  // Register 'alice' for the deployer
  if (isAliceAvailable) {
    console.log("Registering 'alice' for deployer...");
    const tx = await nameRegistry.registerFor("alice", deployer.address);
    await tx.wait();
    console.log("✅ 'alice' registered successfully");
    
    // Verify registration
    const aliceAddress = await nameRegistry.resolve("alice");
    console.log("Alice resolves to:", aliceAddress);
    
    const deployerName = await nameRegistry.reverseResolve(deployer.address);
    console.log("Deployer's primary name:", deployerName);
  }
  
  // Test username validation
  console.log("\n🔍 Testing username validation...");
  console.log("Is 'bob' valid?", await nameRegistry.isValidUsername("bob"));
  console.log("Is 'a' valid?", await nameRegistry.isValidUsername("a")); // Too short
  console.log("Is 'test@user' valid?", await nameRegistry.isValidUsername("test@user")); // Invalid chars
  console.log("Is 'admin' available?", await nameRegistry.isAvailable("admin")); // Reserved
  
  console.log("\n📋 Deployment Summary:");
  console.log("=".repeat(50));
  console.log("Contract: OmniNameRegistry");
  console.log("Address:", registryAddress);
  console.log("Network: COTI V2 Testnet");
  console.log("Registration Fee: 1 XOM");
  console.log("Min Username Length:", await nameRegistry.MIN_USERNAME_LENGTH());
  console.log("Max Username Length:", await nameRegistry.MAX_USERNAME_LENGTH());
  console.log("=".repeat(50));
  
  // Save deployment info
  const deploymentInfo = {
    contractAddress: registryAddress,
    network: "coti-testnet",
    deployer: deployer.address,
    blockNumber: await deployer.provider.getBlockNumber(),
    timestamp: new Date().toISOString()
  };
  
  const fs = require('fs');
  fs.writeFileSync(
    './deployments/coti-testnet.json',
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("💾 Deployment info saved to ./deployments/coti-testnet.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });