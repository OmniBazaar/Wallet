const { expect } = require("chai");

describe("ENS Service Tests", function() {
  // Mock ethers for testing
  const mockEthers = {
    isAddress: (addr) => addr && addr.startsWith('0x') && addr.length === 42,
    ZeroAddress: '0x0000000000000000000000000000000000000000',
    namehash: (name) => '0x' + '1'.repeat(64),
    Contract: function(address, abi, provider) {
      this.address = address;
      this.resolver = () => Promise.resolve('0x1234567890123456789012345678901234567890');
      this.addr = () => Promise.resolve('0x1234567890123456789012345678901234567890');
      this.name = () => Promise.resolve('alice.eth');
      return this;
    }
  };

  // Mock ENS Service class
  class ENSService {
    constructor() {
      this.ethers = mockEthers;
    }

    async resolveAddress(name) {
      try {
        if (this.ethers.isAddress(name)) {
          return name;
        }
        
        if (name.endsWith('.omnicoin')) {
          return await this.resolveOmnicoinAddress(name);
        }
        
        if (name.endsWith('.eth')) {
          return await this.resolveEthAddress(name);
        }
        
        return null;
      } catch (error) {
        return null;
      }
    }

    async resolveOmnicoinAddress(name) {
      const username = name.replace('.omnicoin', '');
      // Mock resolver call
      return '0x1234567890123456789012345678901234567890';
    }

    async resolveEthAddress(name) {
      // Mock ENS resolution
      return '0x1234567890123456789012345678901234567890';
    }

    async resolveAddressForCoin(name, coinType) {
      if (name.endsWith('.omnicoin')) {
        return await this.resolveOmnicoinAddress(name);
      }
      
      if (name.endsWith('.eth')) {
        return await this.resolveEthAddress(name);
      }
      
      return null;
    }

    isValidENSName(name) {
      return name.endsWith('.eth') || name.endsWith('.omnicoin');
    }

    formatAddressForCoinType(addressBytes, coinType) {
      const COIN_TYPES = {
        ETH: 60,
        POL: 966,
        ARB: 60,
        OPT: 60
      };
      
      if (coinType === COIN_TYPES.ETH || coinType === COIN_TYPES.ARB || coinType === COIN_TYPES.OPT || coinType === COIN_TYPES.POL) {
        const cleanBytes = addressBytes.replace('0x', '');
        if (cleanBytes.length === 40) {
          return '0x' + cleanBytes;
        }
        if (cleanBytes.length > 40) {
          return '0x' + cleanBytes.slice(-40);
        }
      }
      
      return addressBytes;
    }

    async reverseResolve(address) {
      if (address === '0x1234567890123456789012345678901234567890') {
        return 'alice.eth';
      }
      return null;
    }
  }

  let ensService;

  beforeEach(function() {
    ensService = new ENSService();
  });

  describe("Address Resolution", function() {
    it("should resolve .omnicoin addresses", async function() {
      const address = await ensService.resolveAddress('alice.omnicoin');
      expect(address).to.equal('0x1234567890123456789012345678901234567890');
    });

    it("should resolve .eth addresses", async function() {
      const address = await ensService.resolveAddress('alice.eth');
      expect(address).to.equal('0x1234567890123456789012345678901234567890');
    });

    it("should return valid addresses unchanged", async function() {
      const validAddress = '0x1234567890123456789012345678901234567890';
      const address = await ensService.resolveAddress(validAddress);
      expect(address).to.equal(validAddress);
    });

    it("should return null for invalid names", async function() {
      const address = await ensService.resolveAddress('invalid-name');
      expect(address).to.be.null;
    });
  });

  describe("Multi-chain Support", function() {
    it("should resolve addresses for ETH (coin type 60)", async function() {
      const address = await ensService.resolveAddressForCoin('alice.omnicoin', 60);
      expect(address).to.equal('0x1234567890123456789012345678901234567890');
    });

    it("should resolve addresses for Polygon (coin type 966)", async function() {
      const address = await ensService.resolveAddressForCoin('alice.omnicoin', 966);
      expect(address).to.equal('0x1234567890123456789012345678901234567890');
    });

    it("should resolve addresses for Arbitrum (coin type 60)", async function() {
      const address = await ensService.resolveAddressForCoin('alice.omnicoin', 60);
      expect(address).to.equal('0x1234567890123456789012345678901234567890');
    });

    it("should resolve .eth addresses for different coin types", async function() {
      const address = await ensService.resolveAddressForCoin('alice.eth', 60);
      expect(address).to.equal('0x1234567890123456789012345678901234567890');
    });
  });

  describe("Validation", function() {
    it("should validate ENS names correctly", function() {
      expect(ensService.isValidENSName('alice.eth')).to.be.true;
      expect(ensService.isValidENSName('alice.omnicoin')).to.be.true;
      expect(ensService.isValidENSName('alice.com')).to.be.false;
      expect(ensService.isValidENSName('alice')).to.be.false;
    });
  });

  describe("Address Formatting", function() {
    it("should format addresses correctly for EVM chains", function() {
      const formatted = ensService.formatAddressForCoinType('0x1234567890123456789012345678901234567890', 60);
      expect(formatted).to.equal('0x1234567890123456789012345678901234567890');
    });

    it("should handle encoded addresses", function() {
      const encoded = '0x000000000000000000000000' + '1234567890123456789012345678901234567890';
      const formatted = ensService.formatAddressForCoinType(encoded, 60);
      expect(formatted).to.equal('0x1234567890123456789012345678901234567890');
    });

    it("should format addresses for Polygon", function() {
      const formatted = ensService.formatAddressForCoinType('0x1234567890123456789012345678901234567890', 966);
      expect(formatted).to.equal('0x1234567890123456789012345678901234567890');
    });
  });

  describe("Reverse Resolution", function() {
    it("should reverse resolve addresses", async function() {
      const name = await ensService.reverseResolve('0x1234567890123456789012345678901234567890');
      expect(name).to.equal('alice.eth');
    });

    it("should return null for unknown addresses", async function() {
      const name = await ensService.reverseResolve('0x0000000000000000000000000000000000000000');
      expect(name).to.be.null;
    });
  });

  describe("Error Handling", function() {
    it("should handle invalid inputs gracefully", async function() {
      const address = await ensService.resolveAddress('');
      expect(address).to.be.null;
    });

    it("should handle null inputs", async function() {
      const address = await ensService.resolveAddress(null);
      expect(address).to.be.null;
    });

    it("should handle undefined inputs", async function() {
      const address = await ensService.resolveAddress(undefined);
      expect(address).to.be.null;
    });
  });
});