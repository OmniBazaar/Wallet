/**
 * Provider Factory for Tests
 * 
 * Creates either mock or real providers based on test environment
 */

import { ethers } from 'ethers';
import { testEnv } from '../config/test-environment';

export interface MockProvider extends ethers.JsonRpcProvider {
  // Additional mock methods
  setMockBalance(address: string, balance: bigint): void;
  setMockTransactionResponse(response: any): void;
  setMockBlockNumber(blockNumber: number): void;
  getMockCallHistory(): any[];
}

export class TestProviderFactory {
  /**
   * Create a provider for OmniCoin blockchain
   */
  static createOmniCoinProvider(): ethers.JsonRpcProvider | MockProvider {
    const endpoints = testEnv.getEndpoints();
    
    if (testEnv.isUsingRealEndpoints()) {
      // Return real provider
      return new ethers.JsonRpcProvider(endpoints.omnicoinRpc);
    }
    
    // Return mock provider
    return this.createMockProvider();
  }
  
  /**
   * Create a mock provider with common test functionality
   */
  private static createMockProvider(): MockProvider {
    const mockBalances = new Map<string, bigint>();
    const mockCallHistory: any[] = [];
    let mockBlockNumber = 1000000;
    let mockTransactionResponse: any = null;
    
    const provider = new ethers.JsonRpcProvider('mock://test') as any;
    
    // Override methods for mocking
    provider.getBalance = jest.fn(async (address: string) => {
      mockCallHistory.push({ method: 'getBalance', address });
      return mockBalances.get(address.toLowerCase()) || BigInt(0);
    });
    
    provider.getBlockNumber = jest.fn(async () => {
      mockCallHistory.push({ method: 'getBlockNumber' });
      return mockBlockNumber;
    });
    
    provider.getTransactionCount = jest.fn(async (address: string) => {
      mockCallHistory.push({ method: 'getTransactionCount', address });
      return 0; // Simple mock
    });
    
    provider.call = jest.fn(async (transaction: any) => {
      mockCallHistory.push({ method: 'call', transaction });
      return '0x'; // Empty response
    });
    
    provider.estimateGas = jest.fn(async (transaction: any) => {
      mockCallHistory.push({ method: 'estimateGas', transaction });
      return BigInt(21000); // Standard gas
    });
    
    provider.getFeeData = jest.fn(async () => {
      mockCallHistory.push({ method: 'getFeeData' });
      return {
        gasPrice: ethers.parseUnits('20', 'gwei'),
        maxFeePerGas: ethers.parseUnits('30', 'gwei'),
        maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei')
      };
    });
    
    provider.sendTransaction = jest.fn(async (signedTx: string) => {
      mockCallHistory.push({ method: 'sendTransaction', signedTx });
      
      if (mockTransactionResponse) {
        return mockTransactionResponse;
      }
      
      // Default mock response
      const hash = '0x' + Math.random().toString(16).substring(2);
      return {
        hash,
        wait: jest.fn(async () => ({
          status: 1,
          blockNumber: mockBlockNumber + 1,
          blockHash: '0x' + Math.random().toString(16).substring(2),
          transactionHash: hash
        }))
      };
    });
    
    provider.getNetwork = jest.fn(async () => ({
      chainId: BigInt(31337), // Hardhat chainId
      name: 'omnicoin-testnet'
    }));
    
    // Mock methods for testing
    provider.setMockBalance = (address: string, balance: bigint) => {
      mockBalances.set(address.toLowerCase(), balance);
    };
    
    provider.setMockTransactionResponse = (response: any) => {
      mockTransactionResponse = response;
    };
    
    provider.setMockBlockNumber = (blockNumber: number) => {
      mockBlockNumber = blockNumber;
    };
    
    provider.getMockCallHistory = () => mockCallHistory;
    
    return provider as MockProvider;
  }
  
  /**
   * Create a validator client (mock or real)
   */
  static createValidatorClient(): any {
    const endpoints = testEnv.getEndpoints();
    
    if (testEnv.isUsingRealEndpoints()) {
      // In real mode, return actual HTTP client
      return {
        baseUrl: endpoints.validatorUrl,
        async getAccount(address: string) {
          const response = await fetch(`${endpoints.validatorUrl}/api/account/${address}`);
          return response.json();
        },
        async getListings(params: any) {
          const response = await fetch(`${endpoints.validatorUrl}/api/listings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
          });
          return response.json();
        },
        async getReputation(address: string) {
          const response = await fetch(`${endpoints.validatorUrl}/api/reputation/${address}`);
          return response.json();
        }
      };
    }
    
    // Mock validator client
    return {
      baseUrl: 'mock://validator',
      getAccount: jest.fn(async (address: string) => ({
        address,
        balance: '1000000000000000000', // 1 XOM
        nonce: 0,
        username: `user_${address.substring(2, 8)}`
      })),
      getListings: jest.fn(async (params: any) => ({
        listings: [
          {
            id: 'listing-1',
            seller: params.seller || '0x123',
            title: 'Test Listing 1',
            price: '100000000000000000', // 0.1 XOM
            category: 'Electronics'
          },
          {
            id: 'listing-2', 
            seller: params.seller || '0x123',
            title: 'Test Listing 2',
            price: '200000000000000000', // 0.2 XOM
            category: 'Books'
          }
        ],
        total: 2
      })),
      getReputation: jest.fn(async (address: string) => ({
        address,
        score: 85,
        totalTransactions: 10,
        successfulTransactions: 9,
        disputes: 1
      }))
    };
  }
  
  /**
   * Create a contract instance (mock or real)
   */
  static async createContract(
    contractName: 'OmniCoin' | 'OmniCore' | 'ValidatorRegistry', 
    provider: ethers.Provider
  ): Promise<ethers.Contract> {
    const endpoints = testEnv.getEndpoints();
    const addresses = endpoints.contractAddresses;
    
    if (testEnv.isUsingRealEndpoints() && addresses[contractName.toLowerCase()]) {
      // Load real ABI and create contract
      const abi = await this.loadContractABI(contractName);
      return new ethers.Contract(
        addresses[contractName.toLowerCase()],
        abi,
        provider
      );
    }
    
    // Return mock contract
    return this.createMockContract(contractName);
  }
  
  /**
   * Load contract ABI (would load from artifacts in real implementation)
   */
  private static async loadContractABI(contractName: string): Promise<any[]> {
    // Simplified - in real implementation, load from artifacts
    return [
      'function balanceOf(address) view returns (uint256)',
      'function transfer(address to, uint256 amount) returns (bool)',
      'function approve(address spender, uint256 amount) returns (bool)',
      'function stake(uint256 amount) returns (bool)',
      'function unstake(uint256 amount) returns (bool)',
      'function getStake(address) view returns (uint256)'
    ];
  }
  
  /**
   * Create a mock contract
   */
  private static createMockContract(contractName: string): ethers.Contract {
    const mockMethods: any = {
      balanceOf: jest.fn(async () => BigInt('1000000000000000000')),
      transfer: jest.fn(async () => true),
      approve: jest.fn(async () => true),
      stake: jest.fn(async () => true),
      unstake: jest.fn(async () => true),
      getStake: jest.fn(async () => BigInt('500000000000000000'))
    };
    
    // Create a mock contract object
    const contract = {
      address: testEnv.getEndpoints().contractAddresses[contractName.toLowerCase()],
      ...mockMethods,
      interface: {
        encodeFunctionData: jest.fn((method: string, params: any[]) => '0x'),
        decodeFunctionResult: jest.fn((method: string, data: string) => [])
      }
    } as any;
    
    return contract;
  }
}

// Helper to reset all mocks between tests
export function resetAllMocks() {
  jest.clearAllMocks();
}