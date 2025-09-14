/**
 * Test Environment Configuration
 * 
 * Allows tests to run with mocks in development and real endpoints in integration
 * Set USE_REAL_ENDPOINTS=true to use actual blockchain/validator connections
 */

export interface TestEndpoints {
  omnicoinRpc: string;
  validatorUrl: string;
  validatorWsUrl: string;
  contractAddresses: {
    omniCoin?: string;
    omniCore?: string;
    validatorRegistry?: string;
    privacyPool?: string;
  };
}

export interface TestAccounts {
  deployer: {
    address: string;
    privateKey: string;
    username: string;
  };
  user1: {
    address: string;
    privateKey: string;
    username: string;
  };
  user2: {
    address: string;
    privateKey: string;
    username: string;
  };
  validator: {
    address: string;
    privateKey: string;
    username: string;
  };
}

export class TestEnvironment {
  private static instance: TestEnvironment;
  private useRealEndpoints: boolean;
  
  private constructor() {
    this.useRealEndpoints = process.env.USE_REAL_ENDPOINTS === 'true';
  }
  
  static getInstance(): TestEnvironment {
    if (!TestEnvironment.instance) {
      TestEnvironment.instance = new TestEnvironment();
    }
    return TestEnvironment.instance;
  }
  
  /**
   * Get endpoints based on environment
   */
  getEndpoints(): TestEndpoints {
    if (this.useRealEndpoints) {
      return {
        omnicoinRpc: process.env.OMNICOIN_RPC_URL || 'http://localhost:8545',
        validatorUrl: process.env.VALIDATOR_URL || 'http://localhost:8090',
        validatorWsUrl: process.env.VALIDATOR_WS_URL || 'ws://localhost:8091',
        contractAddresses: {
          omniCoin: process.env.OMNICOIN_ADDRESS,
          omniCore: process.env.OMNICORE_ADDRESS,
          validatorRegistry: process.env.VALIDATOR_REGISTRY_ADDRESS,
          privacyPool: process.env.PRIVACY_POOL_ADDRESS
        }
      };
    }
    
    // Mock endpoints for testing
    return {
      omnicoinRpc: 'mock://omnicoin-rpc',
      validatorUrl: 'mock://validator-api',
      validatorWsUrl: 'mock://validator-ws',
      contractAddresses: {
        omniCoin: '0x0000000000000000000000000000000000000001',
        omniCore: '0x0000000000000000000000000000000000000002',
        validatorRegistry: '0x0000000000000000000000000000000000000003',
        privacyPool: '0x0000000000000000000000000000000000000004'
      }
    };
  }
  
  /**
   * Get test accounts
   */
  getTestAccounts(): TestAccounts {
    if (this.useRealEndpoints) {
      // Use environment variables for real accounts
      return {
        deployer: {
          address: process.env.DEPLOYER_ADDRESS || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
          privateKey: process.env.DEPLOYER_PRIVATE_KEY || '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
          username: process.env.DEPLOYER_USERNAME || 'deployer.omnicoin'
        },
        user1: {
          address: process.env.USER1_ADDRESS || '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
          privateKey: process.env.USER1_PRIVATE_KEY || '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
          username: process.env.USER1_USERNAME || 'alice.omnicoin'
        },
        user2: {
          address: process.env.USER2_ADDRESS || '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
          privateKey: process.env.USER2_PRIVATE_KEY || '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
          username: process.env.USER2_USERNAME || 'bob.omnicoin'
        },
        validator: {
          address: process.env.VALIDATOR_ADDRESS || '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
          privateKey: process.env.VALIDATOR_PRIVATE_KEY || '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
          username: process.env.VALIDATOR_USERNAME || 'validator.omnicoin'
        }
      };
    }
    
    // Mock accounts for testing (Hardhat default accounts)
    return {
      deployer: {
        address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
        username: 'deployer.omnicoin'
      },
      user1: {
        address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
        username: 'alice.omnicoin'
      },
      user2: {
        address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
        username: 'bob.omnicoin'
      },
      validator: {
        address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
        privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
        username: 'validator.omnicoin'
      }
    };
  }
  
  /**
   * Check if using real endpoints
   */
  isUsingRealEndpoints(): boolean {
    return this.useRealEndpoints;
  }
  
  /**
   * Get timeout for tests (longer for real endpoints)
   */
  getTestTimeout(): number {
    return this.useRealEndpoints ? 30000 : 5000;
  }
  
  /**
   * Should skip test if real endpoints not available
   */
  shouldSkipIfNoRealEndpoints(): boolean {
    return !this.useRealEndpoints && process.env.REQUIRE_REAL_ENDPOINTS === 'true';
  }
}

// Export singleton instance
export const testEnv = TestEnvironment.getInstance();