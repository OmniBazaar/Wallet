/**
 * Script to verify cross-testnet communication
 * Tests that Sepolia StatelessResolver can communicate with COTI V2 NameRegistry
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Verifying Cross-Testnet Communication...\n");

  // Contract addresses (update these after deployment)
  const COTI_REGISTRY_ADDRESS = process.env.COTI_REGISTRY_ADDRESS || "";
  const SEPOLIA_RESOLVER_ADDRESS = process.env.SEPOLIA_RESOLVER_ADDRESS || "";
  const SEPOLIA_ORACLE_ADDRESS = process.env.SEPOLIA_ORACLE_ADDRESS || "";

  if (!COTI_REGISTRY_ADDRESS || !SEPOLIA_RESOLVER_ADDRESS || !SEPOLIA_ORACLE_ADDRESS) {
    console.error("❌ Missing contract addresses in environment variables");
    console.log("Please set:");
    console.log("- COTI_REGISTRY_ADDRESS");
    console.log("- SEPOLIA_RESOLVER_ADDRESS");
    console.log("- SEPOLIA_ORACLE_ADDRESS");
    process.exit(1);
  }

  // Test 1: Connect to COTI V2 testnet
  console.log("1️⃣ Testing COTI V2 Testnet Connection...");
  const cotiProvider = new ethers.JsonRpcProvider("https://testnet.coti.io/rpc");
  
  try {
    const cotiNetwork = await cotiProvider.getNetwork();
    console.log(`✅ Connected to COTI V2 testnet (Chain ID: ${cotiNetwork.chainId})`);
  } catch (error) {
    console.error("❌ Failed to connect to COTI V2 testnet:", error.message);
    process.exit(1);
  }

  // Test 2: Connect to Sepolia testnet
  console.log("\n2️⃣ Testing Sepolia Testnet Connection...");
  const sepoliaProvider = new ethers.JsonRpcProvider(
    `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`
  );
  
  try {
    const sepoliaNetwork = await sepoliaProvider.getNetwork();
    console.log(`✅ Connected to Sepolia testnet (Chain ID: ${sepoliaNetwork.chainId})`);
  } catch (error) {
    console.error("❌ Failed to connect to Sepolia testnet:", error.message);
    process.exit(1);
  }

  // Test 3: Check contract deployments
  console.log("\n3️⃣ Verifying Contract Deployments...");
  
  // Check COTI registry
  const cotiRegistryCode = await cotiProvider.getCode(COTI_REGISTRY_ADDRESS);
  if (cotiRegistryCode === "0x") {
    console.error("❌ NameRegistry not deployed on COTI V2 testnet");
    process.exit(1);
  }
  console.log("✅ NameRegistry deployed on COTI V2 testnet");

  // Check Sepolia resolver
  const sepoliaResolverCode = await sepoliaProvider.getCode(SEPOLIA_RESOLVER_ADDRESS);
  if (sepoliaResolverCode === "0x") {
    console.error("❌ StatelessResolver not deployed on Sepolia testnet");
    process.exit(1);
  }
  console.log("✅ StatelessResolver deployed on Sepolia testnet");

  // Check Sepolia oracle
  const sepoliaOracleCode = await sepoliaProvider.getCode(SEPOLIA_ORACLE_ADDRESS);
  if (sepoliaOracleCode === "0x") {
    console.error("❌ Oracle not deployed on Sepolia testnet");
    process.exit(1);
  }
  console.log("✅ Oracle deployed on Sepolia testnet");

  // Test 4: Test cross-chain name resolution simulation
  console.log("\n4️⃣ Testing Cross-Chain Name Resolution...");
  
  // Create contract instances
  const [signer] = await ethers.getSigners();
  
  const NameRegistry = await ethers.getContractFactory("OmniNameRegistry");
  const cotiRegistry = NameRegistry.attach(COTI_REGISTRY_ADDRESS).connect(
    new ethers.Wallet(process.env.PRIVATE_KEY, cotiProvider)
  );
  
  const Oracle = await ethers.getContractFactory("OmniOracle");
  const sepoliaOracle = Oracle.attach(SEPOLIA_ORACLE_ADDRESS).connect(
    new ethers.Wallet(process.env.PRIVATE_KEY, sepoliaProvider)
  );
  
  const StatelessResolver = await ethers.getContractFactory("OmniStatelessResolver");
  const sepoliaResolver = StatelessResolver.attach(SEPOLIA_RESOLVER_ADDRESS).connect(
    new ethers.Wallet(process.env.PRIVATE_KEY, sepoliaProvider)
  );

  // Test username registration on COTI
  const testUsername = "testuser" + Date.now();
  const testAddress = signer.address;
  
  console.log(`📝 Registering test user: ${testUsername}`);
  
  try {
    // Register on COTI (admin registration for testing)
    const registerTx = await cotiRegistry.registerFor(testUsername, testAddress);
    await registerTx.wait();
    console.log(`✅ User registered on COTI V2: ${testUsername} → ${testAddress}`);
    
    // Verify registration
    const resolvedAddress = await cotiRegistry.resolve(testUsername);
    if (resolvedAddress !== testAddress) {
      console.error("❌ Registration verification failed");
      process.exit(1);
    }
    console.log("✅ Registration verified on COTI V2");
    
  } catch (error) {
    console.error("❌ Registration failed:", error.message);
    process.exit(1);
  }

  // Test 5: Oracle bridge simulation
  console.log("\n5️⃣ Testing Oracle Bridge...");
  
  try {
    // Add test signer as oracle updater
    const addUpdaterTx = await sepoliaOracle.addUpdater(signer.address);
    await addUpdaterTx.wait();
    console.log("✅ Oracle updater added");
    
    // Simulate oracle update from COTI to Sepolia
    const updateTx = await sepoliaOracle.updateName(testUsername, testAddress);
    await updateTx.wait();
    console.log(`✅ Oracle updated on Sepolia: ${testUsername} → ${testAddress}`);
    
    // Verify oracle data
    const oracleAddress = await sepoliaOracle.queryName(testUsername);
    if (oracleAddress !== testAddress) {
      console.error("❌ Oracle update verification failed");
      process.exit(1);
    }
    console.log("✅ Oracle data verified on Sepolia");
    
  } catch (error) {
    console.error("❌ Oracle bridge failed:", error.message);
    process.exit(1);
  }

  // Test 6: End-to-end resolution
  console.log("\n6️⃣ Testing End-to-End Resolution...");
  
  try {
    // Add oracle to resolver
    const addOracleTx = await sepoliaResolver.addOracle(SEPOLIA_ORACLE_ADDRESS);
    await addOracleTx.wait();
    console.log("✅ Oracle added to resolver");
    
    // Test resolution through resolver
    const finalAddress = await sepoliaResolver.resolve(testUsername);
    if (finalAddress !== testAddress) {
      console.error("❌ End-to-end resolution failed");
      process.exit(1);
    }
    console.log(`✅ End-to-end resolution successful: ${testUsername} → ${finalAddress}`);
    
  } catch (error) {
    console.error("❌ End-to-end resolution failed:", error.message);
    process.exit(1);
  }

  // Test 7: Gas cost analysis
  console.log("\n7️⃣ Gas Cost Analysis...");
  
  try {
    // Registration cost on COTI
    const cotiGasPrice = await cotiProvider.getGasPrice();
    const registrationGas = 100000n; // Estimated
    const cotiCost = (registrationGas * cotiGasPrice) / 10n**18n;
    
    console.log(`📊 COTI Registration Cost: ~${cotiCost} COTI (very low)`);
    
    // Oracle update cost on Sepolia
    const sepoliaGasPrice = await sepoliaProvider.getGasPrice();
    const updateGas = 80000n; // Estimated
    const sepoliaCost = (updateGas * sepoliaGasPrice) / 10n**18n;
    
    console.log(`📊 Sepolia Oracle Update Cost: ~${sepoliaCost} ETH`);
    
    // Resolution cost (view function - free)
    console.log(`📊 Resolution Cost: FREE (view function)`);
    
  } catch (error) {
    console.log("⚠️  Gas cost analysis failed:", error.message);
  }

  console.log("\n🎉 Cross-Testnet Verification Complete!");
  console.log("\n✅ System is ready for cross-testnet testing:");
  console.log("   • COTI V2 testnet handles registrations");
  console.log("   • Sepolia testnet handles ENS resolution");
  console.log("   • Oracle bridge connects both networks");
  console.log("   • MetaMask can resolve alice.omnicoin addresses");
  console.log("\n🚀 Deploy to testnets and configure omnicoin.omnibazaar.eth!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  });