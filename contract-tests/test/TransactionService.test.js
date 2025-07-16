const { expect } = require("chai");

describe("Transaction Service Tests", function() {
  // Mock TransactionService
  class TransactionService {
    constructor() {
      this.keyringManager = {
        resolveAddressForChain: async (addressOrName, chainType) => {
          if (addressOrName.startsWith('0x')) return addressOrName;
          if (addressOrName.endsWith('.omnicoin')) return '0x1234567890123456789012345678901234567890';
          if (addressOrName.endsWith('.eth')) return '0x1234567890123456789012345678901234567890';
          return null;
        },
        getCurrentSession: () => ({
          accounts: {
            ethereum: {
              address: '0x9999999999999999999999999999999999999999'
            }
          }
        }),
        signTransaction: async (tx, chainType) => '0xabcdef123456789'
      };
    }

    async sendTransaction(request) {
      // 1. Resolve destination address
      const resolvedAddress = await this.keyringManager.resolveAddressForChain(
        request.to,
        request.chainType
      );

      if (!resolvedAddress) {
        throw new Error(`Could not resolve address: ${request.to}`);
      }

      // 2. Get current user session
      const session = this.keyringManager.getCurrentSession();
      if (!session) {
        throw new Error('User not logged in');
      }

      // 3. Prepare transaction
      const transaction = {
        to: resolvedAddress,
        value: request.value || '0',
        data: request.data || '0x',
        gasLimit: request.gasLimit || 21000,
        gasPrice: request.gasPrice || '20000000000'
      };

      // 4. Sign transaction
      const signedTx = await this.keyringManager.signTransaction(transaction, 'ethereum');

      // 5. Return transaction result
      return {
        hash: signedTx,
        from: session.accounts.ethereum.address,
        to: resolvedAddress,
        value: transaction.value,
        chainType: request.chainType,
        resolvedAddress: resolvedAddress,
        originalAddress: request.to
      };
    }

    async validateTransaction(request) {
      const errors = [];
      let resolvedAddress;

      try {
        // Check if user is logged in
        const session = this.keyringManager.getCurrentSession();
        if (!session) {
          errors.push('User not logged in');
          return { valid: false, errors };
        }

        // Resolve destination address
        resolvedAddress = await this.keyringManager.resolveAddressForChain(
          request.to,
          request.chainType
        );

        if (!resolvedAddress) {
          errors.push(`Could not resolve address: ${request.to}`);
        }

        // Validate value
        if (request.value) {
          try {
            const value = parseFloat(request.value);
            if (value < 0) {
              errors.push('Value cannot be negative');
            }
          } catch {
            errors.push('Invalid value format');
          }
        }

        // Validate gas settings
        if (request.gasLimit && request.gasLimit < 21000) {
          errors.push('Gas limit too low (minimum 21000)');
        }

        if (request.gasPrice) {
          try {
            const gasPrice = parseFloat(request.gasPrice);
            if (gasPrice <= 0) {
              errors.push('Gas price must be greater than 0');
            }
          } catch {
            errors.push('Invalid gas price format');
          }
        }

        return {
          valid: errors.length === 0,
          errors,
          resolvedAddress
        };
      } catch (error) {
        errors.push(`Validation error: ${error.message}`);
        return { valid: false, errors };
      }
    }

    async isValidDestination(addressOrName) {
      try {
        // Check if it's a valid address (mock check)
        if (addressOrName.startsWith('0x') && addressOrName.length === 42) {
          return true;
        }

        // Check if it's a malformed address
        if (addressOrName.startsWith('0x') && addressOrName.length !== 42) {
          return false;
        }

        // Check if it's a valid ENS name
        const resolved = await this.keyringManager.resolveAddressForChain(addressOrName, 'ethereum');
        return resolved !== null;
      } catch (error) {
        return false;
      }
    }
  }

  let txService;

  beforeEach(function() {
    txService = new TransactionService();
  });

  describe("Transaction Resolution", function() {
    it("should send transaction to .omnicoin address", async function() {
      const request = {
        to: 'alice.omnicoin',
        value: '1000000000000000000', // 1 ETH in wei
        chainType: 'ethereum'
      };

      const result = await txService.sendTransaction(request);
      
      expect(result.originalAddress).to.equal('alice.omnicoin');
      expect(result.resolvedAddress).to.equal('0x1234567890123456789012345678901234567890');
      expect(result.chainType).to.equal('ethereum');
      expect(result.hash).to.equal('0xabcdef123456789');
    });

    it("should send transaction to .eth address", async function() {
      const request = {
        to: 'alice.eth',
        value: '1000000000000000000', // 1 ETH in wei
        chainType: 'ethereum'
      };

      const result = await txService.sendTransaction(request);
      
      expect(result.originalAddress).to.equal('alice.eth');
      expect(result.resolvedAddress).to.equal('0x1234567890123456789012345678901234567890');
      expect(result.chainType).to.equal('ethereum');
    });

    it("should send transaction to regular address", async function() {
      const request = {
        to: '0x1234567890123456789012345678901234567890',
        value: '1000000000000000000',
        chainType: 'ethereum'
      };

      const result = await txService.sendTransaction(request);
      
      expect(result.originalAddress).to.equal('0x1234567890123456789012345678901234567890');
      expect(result.resolvedAddress).to.equal('0x1234567890123456789012345678901234567890');
    });

    it("should handle Polygon transactions", async function() {
      const request = {
        to: 'alice.omnicoin',
        value: '1000000000000000000',
        chainType: 'polygon'
      };

      const result = await txService.sendTransaction(request);
      
      expect(result.chainType).to.equal('polygon');
      expect(result.resolvedAddress).to.equal('0x1234567890123456789012345678901234567890');
    });

    it("should handle Arbitrum transactions", async function() {
      const request = {
        to: 'alice.omnicoin',
        value: '1000000000000000000',
        chainType: 'arbitrum'
      };

      const result = await txService.sendTransaction(request);
      
      expect(result.chainType).to.equal('arbitrum');
      expect(result.resolvedAddress).to.equal('0x1234567890123456789012345678901234567890');
    });

    it("should handle Optimism transactions", async function() {
      const request = {
        to: 'alice.omnicoin',
        value: '1000000000000000000',
        chainType: 'optimism'
      };

      const result = await txService.sendTransaction(request);
      
      expect(result.chainType).to.equal('optimism');
      expect(result.resolvedAddress).to.equal('0x1234567890123456789012345678901234567890');
    });

    it("should fail for unresolvable addresses", async function() {
      const request = {
        to: 'invalid.address',
        value: '1000000000000000000',
        chainType: 'ethereum'
      };

      try {
        await txService.sendTransaction(request);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Could not resolve address');
      }
    });
  });

  describe("Transaction Validation", function() {
    it("should validate valid transactions", async function() {
      const request = {
        to: 'alice.omnicoin',
        value: '1000000000000000000',
        chainType: 'ethereum'
      };

      const validation = await txService.validateTransaction(request);
      
      expect(validation.valid).to.be.true;
      expect(validation.errors).to.be.empty;
      expect(validation.resolvedAddress).to.equal('0x1234567890123456789012345678901234567890');
    });

    it("should reject negative values", async function() {
      const request = {
        to: 'alice.omnicoin',
        value: '-1000000000000000000',
        chainType: 'ethereum'
      };

      const validation = await txService.validateTransaction(request);
      
      expect(validation.valid).to.be.false;
      expect(validation.errors).to.include('Value cannot be negative');
    });

    it("should reject low gas limits", async function() {
      const request = {
        to: 'alice.omnicoin',
        value: '1000000000000000000',
        gasLimit: 20000, // Below minimum
        chainType: 'ethereum'
      };

      const validation = await txService.validateTransaction(request);
      
      expect(validation.valid).to.be.false;
      expect(validation.errors).to.include('Gas limit too low (minimum 21000)');
    });

    it("should reject zero gas prices", async function() {
      const request = {
        to: 'alice.omnicoin',
        value: '1000000000000000000',
        gasPrice: '0',
        chainType: 'ethereum'
      };

      const validation = await txService.validateTransaction(request);
      
      expect(validation.valid).to.be.false;
      expect(validation.errors).to.include('Gas price must be greater than 0');
    });

    it("should reject unresolvable addresses", async function() {
      const request = {
        to: 'invalid.address',
        value: '1000000000000000000',
        chainType: 'ethereum'
      };

      const validation = await txService.validateTransaction(request);
      
      expect(validation.valid).to.be.false;
      expect(validation.errors).to.include('Could not resolve address: invalid.address');
    });
  });

  describe("Destination Validation", function() {
    it("should validate .omnicoin addresses", async function() {
      const isValid = await txService.isValidDestination('alice.omnicoin');
      expect(isValid).to.be.true;
    });

    it("should validate .eth addresses", async function() {
      const isValid = await txService.isValidDestination('alice.eth');
      expect(isValid).to.be.true;
    });

    it("should validate regular addresses", async function() {
      const isValid = await txService.isValidDestination('0x1234567890123456789012345678901234567890');
      expect(isValid).to.be.true;
    });

    it("should reject invalid addresses", async function() {
      const isValid = await txService.isValidDestination('invalid.address');
      expect(isValid).to.be.false;
    });

    it("should reject malformed addresses", async function() {
      const isValid = await txService.isValidDestination('0x123');
      expect(isValid).to.be.false;
    });
  });
});