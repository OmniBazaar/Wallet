const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ENS Integration Tests", function () {
  let nameRegistry, oracle, resolver;
  let owner, user1, user2, node1, node2;
  
  beforeEach(async function () {
    [owner, user1, user2, node1, node2] = await ethers.getSigners();
    
    // Deploy OmniNameRegistry (simulating COTI chain)
    const OmniNameRegistry = await ethers.getContractFactory("OmniNameRegistry");
    nameRegistry = await OmniNameRegistry.deploy();
    await nameRegistry.waitForDeployment();
    
    // Deploy Oracle
    const OmniOracle = await ethers.getContractFactory("OmniOracle");
    oracle = await OmniOracle.deploy();
    await oracle.waitForDeployment();
    
    // Deploy Resolver
    const OmniStatelessResolver = await ethers.getContractFactory("OmniStatelessResolver");
    resolver = await OmniStatelessResolver.deploy();
    await resolver.waitForDeployment();
    
    // Configure contracts
    await resolver.addOracle(await oracle.getAddress());
    await oracle.addUpdater(node1.address);
    await oracle.addUpdater(node2.address);
  });

  describe("OmniNameRegistry", function () {
    it("Should register names correctly", async function () {
      // Register name for user1
      await nameRegistry.connect(owner).registerFor("alice", user1.address);
      
      // Check resolution
      expect(await nameRegistry.resolve("alice")).to.equal(user1.address);
      expect(await nameRegistry.reverseResolve(user1.address)).to.equal("alice");
    });

    it("Should validate usernames correctly", async function () {
      expect(await nameRegistry.isValidUsername("alice")).to.be.true;
      expect(await nameRegistry.isValidUsername("bob123")).to.be.true;
      expect(await nameRegistry.isValidUsername("test-user")).to.be.true;
      expect(await nameRegistry.isValidUsername("user_name")).to.be.true;
      
      // Invalid usernames
      expect(await nameRegistry.isValidUsername("ab")).to.be.false; // Too short
      expect(await nameRegistry.isValidUsername("a".repeat(21))).to.be.false; // Too long
      expect(await nameRegistry.isValidUsername("test@user")).to.be.false; // Invalid char
      expect(await nameRegistry.isValidUsername("-alice")).to.be.false; // Starts with hyphen
      expect(await nameRegistry.isValidUsername("alice-")).to.be.false; // Ends with hyphen
    });

    it("Should prevent registration of reserved names", async function () {
      await expect(
        nameRegistry.connect(owner).registerFor("admin", user1.address)
      ).to.be.revertedWith("Username is reserved");
    });

    it("Should handle name transfers", async function () {
      // Register name
      await nameRegistry.connect(owner).registerFor("alice", user1.address);
      
      // Transfer to user2
      await nameRegistry.connect(user1).transfer("alice", user2.address);
      
      // Check new ownership
      expect(await nameRegistry.resolve("alice")).to.equal(user2.address);
      expect(await nameRegistry.reverseResolve(user2.address)).to.equal("alice");
      expect(await nameRegistry.reverseResolve(user1.address)).to.equal("");
    });

    it("Should handle registration fees", async function () {
      const fee = ethers.parseEther("1");
      await nameRegistry.setRegistrationFee(fee);
      
      // Should work with correct fee
      await nameRegistry.connect(user1).register("alice", { value: fee });
      expect(await nameRegistry.resolve("alice")).to.equal(user1.address);
      
      // Should fail with insufficient fee
      await expect(
        nameRegistry.connect(user2).register("bob", { value: fee - 1n })
      ).to.be.revertedWith("Insufficient registration fee");
    });
  });

  describe("Oracle Integration", function () {
    it("Should update name data correctly", async function () {
      // Node1 updates name
      await oracle.connect(node1).updateName("alice", user1.address);
      
      // Check oracle data
      expect(await oracle.queryName("alice")).to.equal(user1.address);
      expect(await oracle.hasName("alice")).to.be.true;
      
      // Check metadata
      const [address, timestamp] = await oracle.getNameData("alice");
      expect(address).to.equal(user1.address);
      expect(timestamp).to.be.gt(0);
    });

    it("Should handle batch updates", async function () {
      const usernames = ["alice", "bob", "charlie"];
      const addresses = [user1.address, user2.address, owner.address];
      
      await oracle.connect(node1).batchUpdateNames(usernames, addresses);
      
      // Check all updates
      for (let i = 0; i < usernames.length; i++) {
        expect(await oracle.queryName(usernames[i])).to.equal(addresses[i]);
      }
    });

    it("Should respect update cooldown", async function () {
      // First update should work
      await oracle.connect(node1).updateName("alice", user1.address);
      
      // Immediate second update should fail
      await expect(
        oracle.connect(node1).updateName("alice", user2.address)
      ).to.be.revertedWith("Update too frequent");
    });

    it("Should track oracle health", async function () {
      expect(await oracle.isHealthy()).to.be.true;
      
      // Update name to refresh last update time
      await oracle.connect(node1).updateName("alice", user1.address);
      
      expect(await oracle.isHealthy()).to.be.true;
      expect(await oracle.getLastUpdateTime()).to.be.gt(0);
    });
  });

  describe("Stateless Resolver", function () {
    beforeEach(async function () {
      // Set up oracle data
      await oracle.connect(node1).updateName("alice", user1.address);
      await oracle.connect(node1).updateName("bob", user2.address);
    });

    it("Should resolve names through oracle", async function () {
      expect(await resolver.resolve("alice")).to.equal(user1.address);
      expect(await resolver.resolve("bob")).to.equal(user2.address);
    });

    it("Should handle cache updates", async function () {
      // Update cache
      await resolver.connect(await oracle.getAddress()).updateCache("charlie", owner.address);
      
      // Check cache
      expect(await resolver.isCached("charlie")).to.be.true;
      const [cachedAddress, timestamp] = await resolver.getCached("charlie");
      expect(cachedAddress).to.equal(owner.address);
      expect(timestamp).to.be.gt(0);
    });

    it("Should handle emergency mode", async function () {
      // Set emergency cache
      await resolver.connect(owner).setEmergencyCache("emergency", user1.address);
      
      // Enable emergency mode
      await resolver.connect(owner).setEmergencyMode(true);
      
      // Should resolve from emergency cache
      expect(await resolver.resolve("emergency")).to.equal(user1.address);
      
      // Disable emergency mode
      await resolver.connect(owner).setEmergencyMode(false);
      
      // Should resolve normally (return 0x0 for unknown names)
      expect(await resolver.resolve("emergency")).to.equal(ethers.ZeroAddress);
    });

    it("Should manage oracles correctly", async function () {
      expect(await resolver.getOracleCount()).to.equal(1);
      
      // Deploy second oracle
      const OmniOracle2 = await ethers.getContractFactory("OmniOracle");
      const oracle2 = await OmniOracle2.deploy();
      await oracle2.waitForDeployment();
      
      // Add second oracle
      await resolver.connect(owner).addOracle(await oracle2.getAddress());
      expect(await resolver.getOracleCount()).to.equal(2);
      
      // Remove first oracle
      await resolver.connect(owner).removeOracle(await oracle.getAddress());
      expect(await resolver.getOracleCount()).to.equal(1);
    });
  });

  describe("End-to-End Integration", function () {
    it("Should simulate full name resolution flow", async function () {
      // 1. Register name on "COTI chain" (nameRegistry)
      await nameRegistry.connect(owner).registerFor("alice", user1.address);
      
      // 2. Node monitors and updates oracle
      await oracle.connect(node1).updateName("alice", user1.address);
      
      // 3. Resolver queries oracle
      expect(await resolver.resolve("alice")).to.equal(user1.address);
      
      // 4. Update address
      await nameRegistry.connect(user1).updateAddress("alice", user2.address);
      
      // 5. Node updates oracle
      await oracle.connect(node1).updateName("alice", user2.address);
      
      // 6. Resolver returns updated address
      expect(await resolver.resolve("alice")).to.equal(user2.address);
    });

    it("Should handle multiple node updates", async function () {
      // Register multiple names
      await nameRegistry.connect(owner).registerFor("alice", user1.address);
      await nameRegistry.connect(owner).registerFor("bob", user2.address);
      
      // Different nodes update different names
      await oracle.connect(node1).updateName("alice", user1.address);
      await oracle.connect(node2).updateName("bob", user2.address);
      
      // Both should resolve correctly
      expect(await resolver.resolve("alice")).to.equal(user1.address);
      expect(await resolver.resolve("bob")).to.equal(user2.address);
    });

    it("Should handle batch synchronization", async function () {
      // Register multiple names
      const names = ["alice", "bob", "charlie", "david"];
      const addresses = [user1.address, user2.address, owner.address, node1.address];
      
      for (let i = 0; i < names.length; i++) {
        await nameRegistry.connect(owner).registerFor(names[i], addresses[i]);
      }
      
      // Node does batch sync
      await oracle.connect(node1).batchUpdateNames(names, addresses);
      
      // All should resolve correctly
      for (let i = 0; i < names.length; i++) {
        expect(await resolver.resolve(names[i])).to.equal(addresses[i]);
      }
    });
  });

  describe("Security Tests", function () {
    it("Should prevent unauthorized oracle updates", async function () {
      await expect(
        oracle.connect(user1).updateName("alice", user1.address)
      ).to.be.revertedWith("Not authorized updater");
    });

    it("Should prevent unauthorized resolver operations", async function () {
      await expect(
        resolver.connect(user1).addOracle(user1.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should handle pausing correctly", async function () {
      // Pause oracle
      await oracle.connect(owner).pause();
      
      await expect(
        oracle.connect(node1).updateName("alice", user1.address)
      ).to.be.revertedWith("Pausable: paused");
      
      // Unpause
      await oracle.connect(owner).unpause();
      
      // Should work again
      await oracle.connect(node1).updateName("alice", user1.address);
      expect(await oracle.queryName("alice")).to.equal(user1.address);
    });
  });

  describe("Gas Optimization Tests", function () {
    it("Should optimize batch operations", async function () {
      const names = Array.from({ length: 50 }, (_, i) => `user${i}`);
      const addresses = Array.from({ length: 50 }, () => user1.address);
      
      // Batch update should be more efficient than individual updates
      const tx = await oracle.connect(node1).batchUpdateNames(names, addresses);
      const receipt = await tx.wait();
      
      console.log(`Batch update gas used: ${receipt.gasUsed}`);
      
      // Should complete successfully
      expect(receipt.status).to.equal(1);
    });
  });
});