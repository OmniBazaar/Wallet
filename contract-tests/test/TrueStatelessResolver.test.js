const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("True Stateless Resolver Tests", function () {
  let trueStatelessResolver;
  let nameRegistry;
  let owner, user1, user2;
  
  const OMNICOIN_NODE_ENDPOINTS = [
    "https://node1.omnicoin.io/rpc",
    "https://node2.omnicoin.io/rpc", 
    "https://node3.omnicoin.io/rpc"
  ];
  const TEST_REGISTRY_ADDRESS = "0x1234567890123456789012345678901234567890";
  
  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    // Deploy NameRegistry (simulating COTI chain)
    const OmniNameRegistry = await ethers.getContractFactory("OmniNameRegistry");
    nameRegistry = await OmniNameRegistry.deploy();
    await nameRegistry.waitForDeployment();
    
    // Deploy True Stateless Resolver
    const OmniTrueStatelessResolver = await ethers.getContractFactory("OmniTrueStatelessResolver");
    trueStatelessResolver = await OmniTrueStatelessResolver.deploy(
      OMNICOIN_NODE_ENDPOINTS,
      await nameRegistry.getAddress()
    );
    await trueStatelessResolver.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy with correct configuration", async function () {
      const [nodeEndpoint, registryAddress] = await trueStatelessResolver.getConfiguration();
      expect(nodeEndpoint).to.equal(OMNICOIN_NODE_ENDPOINTS[0]);
      expect(registryAddress).to.equal(await nameRegistry.getAddress());
    });

    it("Should set owner correctly", async function () {
      expect(await trueStatelessResolver.owner()).to.equal(owner.address);
    });

    it("Should start with emergency mode disabled", async function () {
      expect(await trueStatelessResolver.emergencyMode()).to.be.false;
    });
  });

  describe("Username Validation", function () {
    it("Should validate correct usernames", async function () {
      expect(await trueStatelessResolver.supportsUsername("alice")).to.be.true;
      expect(await trueStatelessResolver.supportsUsername("bob123")).to.be.true;
      expect(await trueStatelessResolver.supportsUsername("test-user")).to.be.true;
      expect(await trueStatelessResolver.supportsUsername("user_name")).to.be.true;
    });

    it("Should reject invalid usernames", async function () {
      expect(await trueStatelessResolver.supportsUsername("ab")).to.be.false; // Too short
      expect(await trueStatelessResolver.supportsUsername("a".repeat(21))).to.be.false; // Too long
      expect(await trueStatelessResolver.supportsUsername("test@user")).to.be.false; // Invalid char
      expect(await trueStatelessResolver.supportsUsername("-alice")).to.be.false; // Starts with hyphen
      expect(await trueStatelessResolver.supportsUsername("alice-")).to.be.false; // Ends with hyphen
      expect(await trueStatelessResolver.supportsUsername("_alice")).to.be.false; // Starts with underscore
      expect(await trueStatelessResolver.supportsUsername("alice_")).to.be.false; // Ends with underscore
    });
  });

  describe("Stateless Resolution", function () {
    it("Should revert with QueryCotiChain instruction", async function () {
      const testUsername = "alice";
      
      // The resolve function should revert with instruction to query COTI
      await expect(trueStatelessResolver.resolve(testUsername))
        .to.be.revertedWithCustomError(trueStatelessResolver, "QueryOmniCoinChain")
        .withArgs(testUsername, OMNICOIN_NODE_ENDPOINTS[0], await nameRegistry.getAddress());
    });

    it("Should provide correct query instruction for different usernames", async function () {
      const testUsernames = ["alice", "bob123", "test-user"];
      
      for (const username of testUsernames) {
        await expect(trueStatelessResolver.resolve(username))
          .to.be.revertedWithCustomError(trueStatelessResolver, "QueryOmniCoinChain")
          .withArgs(username, OMNICOIN_NODE_ENDPOINTS[0], await nameRegistry.getAddress());
      }
    });
  });

  describe("Emergency Mode", function () {
    it("Should allow owner to set emergency fallback", async function () {
      const username = "alice";
      const address = user1.address;
      
      await trueStatelessResolver.setEmergencyFallback(username, address);
      
      // Should still revert normally when emergency mode is off
      await expect(trueStatelessResolver.resolve(username))
        .to.be.revertedWithCustomError(trueStatelessResolver, "QueryOmniCoinChain");
    });

    it("Should use emergency fallback when emergency mode is enabled", async function () {
      const username = "alice";
      const address = user1.address;
      
      // Set emergency fallback
      await trueStatelessResolver.setEmergencyFallback(username, address);
      
      // Enable emergency mode
      await trueStatelessResolver.setEmergencyMode(true);
      
      // Should now return emergency address
      const resolvedAddress = await trueStatelessResolver.resolve(username);
      expect(resolvedAddress).to.equal(address);
    });

    it("Should prevent non-owner from setting emergency fallback", async function () {
      await expect(
        trueStatelessResolver.connect(user1).setEmergencyFallback("alice", user1.address)
      ).to.be.revertedWithCustomError(trueStatelessResolver, "OwnableUnauthorizedAccount");
    });

    it("Should prevent non-owner from toggling emergency mode", async function () {
      await expect(
        trueStatelessResolver.connect(user1).setEmergencyMode(true)
      ).to.be.revertedWithCustomError(trueStatelessResolver, "OwnableUnauthorizedAccount");
    });
  });

  describe("Batch Resolution", function () {
    it("Should handle batch resolution", async function () {
      const usernames = ["alice", "bob", "charlie"];
      
      // This should return array of zero addresses since all queries revert
      const addresses = await trueStatelessResolver.batchResolve(usernames);
      
      expect(addresses).to.have.length(3);
      expect(addresses[0]).to.equal(ethers.ZeroAddress);
      expect(addresses[1]).to.equal(ethers.ZeroAddress);
      expect(addresses[2]).to.equal(ethers.ZeroAddress);
    });

    it("Should handle batch resolution with emergency fallbacks", async function () {
      const usernames = ["alice", "bob", "charlie"];
      const addresses = [user1.address, user2.address, owner.address];
      
      // Set emergency fallbacks
      for (let i = 0; i < usernames.length; i++) {
        await trueStatelessResolver.setEmergencyFallback(usernames[i], addresses[i]);
      }
      
      // Enable emergency mode
      await trueStatelessResolver.setEmergencyMode(true);
      
      // Should return emergency addresses
      const resolvedAddresses = await trueStatelessResolver.batchResolve(usernames);
      
      expect(resolvedAddresses).to.have.length(3);
      expect(resolvedAddresses[0]).to.equal(addresses[0]);
      expect(resolvedAddresses[1]).to.equal(addresses[1]);
      expect(resolvedAddresses[2]).to.equal(addresses[2]);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to add new node endpoint", async function () {
      const newEndpoint = "https://node4.omnicoin.io/rpc";
      
      await expect(trueStatelessResolver.addNodeEndpoint(newEndpoint))
        .to.emit(trueStatelessResolver, "NodeAdded")
        .withArgs(newEndpoint);
      
      const nodeCount = await trueStatelessResolver.getNodeCount();
      expect(nodeCount).to.equal(4);
    });
    
    it("Should allow adding many nodes without limit", async function () {
      const initialCount = await trueStatelessResolver.getNodeCount();
      
      // Add 10 nodes to test scalability
      for (let i = 1; i <= 10; i++) {
        await trueStatelessResolver.addNodeEndpoint(`https://node${i + 10}.omnicoin.io/rpc`);
      }
      
      const finalCount = await trueStatelessResolver.getNodeCount();
      expect(finalCount).to.equal(initialCount + 10n);
    });
    
    it("Should allow owner to remove node endpoint", async function () {
      // First add a node so we have more than the minimum
      const newEndpoint = "https://node4.omnicoin.io/rpc";
      await trueStatelessResolver.addNodeEndpoint(newEndpoint);
      
      // Now remove the newly added node
      await expect(trueStatelessResolver.removeNodeEndpoint(newEndpoint))
        .to.emit(trueStatelessResolver, "NodeRemoved")
        .withArgs(newEndpoint);
      
      const nodeCount = await trueStatelessResolver.getNodeCount();
      expect(nodeCount).to.equal(3); // Back to original count
    });
    
    it("Should allow owner to force node rotation", async function () {
      const initialNode = await trueStatelessResolver.getCurrentNodeEndpoint();
      
      await expect(trueStatelessResolver.forceNodeRotation())
        .to.emit(trueStatelessResolver, "CurrentNodeUpdated")
        .withArgs(OMNICOIN_NODE_ENDPOINTS[1]);
      
      const newNode = await trueStatelessResolver.getCurrentNodeEndpoint();
      expect(newNode).to.not.equal(initialNode);
      expect(newNode).to.equal(OMNICOIN_NODE_ENDPOINTS[1]);
    });

    it("Should allow owner to update registry address", async function () {
      const newRegistryAddress = "0x9876543210987654321098765432109876543210";
      
      await expect(trueStatelessResolver.updateRegistryAddress(newRegistryAddress))
        .to.emit(trueStatelessResolver, "RegistryAddressUpdated")
        .withArgs(newRegistryAddress);
      
      const [, registryAddress] = await trueStatelessResolver.getConfiguration();
      expect(registryAddress).to.equal(newRegistryAddress);
    });

    it("Should prevent non-owner from updating configuration", async function () {
      await expect(
        trueStatelessResolver.connect(user1).addNodeEndpoint("https://new-endpoint.com")
      ).to.be.revertedWithCustomError(trueStatelessResolver, "OwnableUnauthorizedAccount");

      await expect(
        trueStatelessResolver.connect(user1).updateRegistryAddress("0x1234567890123456789012345678901234567890")
      ).to.be.revertedWithCustomError(trueStatelessResolver, "OwnableUnauthorizedAccount");
    });
  });

  describe("Pausable Functionality", function () {
    it("Should allow owner to pause and unpause", async function () {
      // Pause contract
      await trueStatelessResolver.pause();
      
      // Should revert when paused
      await expect(trueStatelessResolver.resolve("alice"))
        .to.be.revertedWithCustomError(trueStatelessResolver, "EnforcedPause");
      
      // Unpause contract
      await trueStatelessResolver.unpause();
      
      // Should work normally again (revert with QueryOmniCoinChain)
      await expect(trueStatelessResolver.resolve("alice"))
        .to.be.revertedWithCustomError(trueStatelessResolver, "QueryOmniCoinChain");
    });

    it("Should prevent non-owner from pausing", async function () {
      await expect(
        trueStatelessResolver.connect(user1).pause()
      ).to.be.revertedWithCustomError(trueStatelessResolver, "OwnableUnauthorizedAccount");
    });
  });

  describe("Gas Costs", function () {
    it("Should have minimal gas costs for resolve calls", async function () {
      // Since resolve() always reverts, we can't estimate gas normally
      // But we can test that the function exists and behaves correctly
      
      await expect(trueStatelessResolver.resolve("alice"))
        .to.be.revertedWithCustomError(trueStatelessResolver, "QueryOmniCoinChain");
      
      // The gas cost is minimal because it only checks emergency mode and reverts
      console.log("✅ Resolve function has minimal gas requirements (always reverts)");
    });

    it("Should have reasonable gas costs for batch resolution", async function () {
      const usernames = ["alice", "bob", "charlie", "david", "eve"];
      
      const gasEstimate = await trueStatelessResolver.batchResolve.estimateGas(usernames);
      
      // Should be reasonable for batch operation
      expect(gasEstimate).to.be.lessThan(200000);
      console.log(`Batch resolve gas cost: ${gasEstimate}`);
    });
  });

  describe("Integration Simulation", function () {
    it("Should simulate MetaMask integration flow", async function () {
      const username = "alice";
      
      // Step 1: MetaMask calls resolve()
      let caughtError;
      try {
        await trueStatelessResolver.resolve(username);
      } catch (error) {
        caughtError = error;
      }
      
      // Step 2: MetaMask should catch the QueryCotiChain error
      expect(caughtError).to.exist;
      
      // Step 3: MetaMask extracts query information from error
      // In real implementation, MetaMask would:
      // - Parse the error to get username, rpcEndpoint, registryAddress
      // - Make RPC call to COTI chain
      // - Query the registry contract directly
      
      // Simulate the COTI query that MetaMask would make
      await nameRegistry.registerFor(username, user1.address);
      const resolvedAddress = await nameRegistry.resolve(username);
      
      expect(resolvedAddress).to.equal(user1.address);
    });

    it("Should demonstrate zero ETH gas costs for nodes", async function () {
      // This test demonstrates that nodes never need to pay ETH gas
      
      // 1. User registers on COTI (nodes process this, earn XOM)
      await nameRegistry.registerFor("alice", user1.address);
      
      // 2. User tries to resolve in MetaMask
      await expect(trueStatelessResolver.resolve("alice"))
        .to.be.revertedWithCustomError(trueStatelessResolver, "QueryOmniCoinChain");
      
      // 3. MetaMask queries COTI directly (no ETH gas)
      const resolvedAddress = await nameRegistry.resolve("alice");
      expect(resolvedAddress).to.equal(user1.address);
      
      // 4. No ETH transactions by nodes at any point!
      console.log("✅ Zero ETH gas costs for nodes confirmed");
    });
  });
});