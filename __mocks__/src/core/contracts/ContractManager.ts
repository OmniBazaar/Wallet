/**
 * Mock ContractManager for testing
 */

import { jest } from '@jest/globals';
import { createMockContract } from '../../../../tests/setup';

export interface ContractConfig {
  registryAddress: string;
  resolverAddress: string;
  cotiRpcUrl: string;
  ethereumRpcUrl: string;
}

export class ContractManager {
  private static instance: ContractManager;
  private config: ContractConfig;
  private registryContract: any;
  private resolverContract: any;
  private cotiProvider: any;
  private ethereumProvider: any;

  private constructor(config: ContractConfig) {
    this.config = config;
    
    // Create mock providers
    this.cotiProvider = {
      getNetwork: jest.fn().mockResolvedValue({ chainId: 1234n, name: 'coti-testnet' }),
      getBalance: jest.fn().mockResolvedValue('1000000000000000000'),
      send: jest.fn().mockResolvedValue(null)
    };
    
    this.ethereumProvider = {
      getNetwork: jest.fn().mockResolvedValue({ chainId: 11155111n, name: 'sepolia' }),
      getBalance: jest.fn().mockResolvedValue('1000000000000000000'),
      send: jest.fn().mockResolvedValue(null)
    };

    // Create mock contracts with required methods
    this.registryContract = createMockContract(config.registryAddress, {
      isAvailable: jest.fn().mockImplementation(async (username: string) => {
        // Return true for all usernames in tests to allow registration
        // Except for some specific test cases
        if (username === 'existinguser') {
          return false; // This user exists
        }
        return true; // All other usernames are available
      }),
      resolve: jest.fn().mockImplementation(async (username: string) => {
        if (username === 'testuser') {
          return '0xF4C9aa764684C74595213384d32E2e57798Fd2F9';
        }
        return null;
      }),
      reverseResolve: jest.fn().mockImplementation(async (address: string) => {
        if (address === '0xF4C9aa764684C74595213384d32E2e57798Fd2F9') {
          return 'testuser';
        }
        return null;
      }),
      register: jest.fn().mockResolvedValue({ hash: '0x' + '1'.repeat(64) })
    });

    this.resolverContract = createMockContract(config.resolverAddress, {
      resolve: jest.fn().mockImplementation(async (username: string) => {
        if (username === 'testuser.omnicoin') {
          return '0xF4C9aa764684C74595213384d32E2e57798Fd2F9';
        }
        return null;
      }),
      setText: jest.fn().mockResolvedValue({ hash: '0x' + '2'.repeat(64) })
    });
  }

  public static initialize(config: ContractConfig): ContractManager {
    if (ContractManager.instance == null) {
      ContractManager.instance = new ContractManager(config);
    }
    return ContractManager.instance;
  }

  public static getInstance(): ContractManager {
    if (ContractManager.instance == null) {
      // Auto-initialize with test config for testing
      const testConfig: ContractConfig = {
        registryAddress: '0x0000000000000000000000000000000000000001',
        resolverAddress: '0x0000000000000000000000000000000000000002',
        cotiRpcUrl: 'https://testnet.coti.io/rpc',
        ethereumRpcUrl: 'https://rpc.sepolia.org'
      };
      ContractManager.instance = new ContractManager(testConfig);
    }
    return ContractManager.instance;
  }

  public getRegistryContract(): any {
    return this.registryContract;
  }

  public getResolverContract(): any {
    return this.resolverContract;
  }

  public getCotiProvider(): any {
    return this.cotiProvider;
  }

  public getEthereumProvider(): any {
    return this.ethereumProvider;
  }

  public getConfig(): ContractConfig {
    return this.config;
  }

  // Add static method for testing to reset instance
  public static reset(): void {
    ContractManager.instance = null as any;
  }
}

export const defaultConfig: ContractConfig = {
  registryAddress: '0x0000000000000000000000000000000000000001',
  resolverAddress: '0x0000000000000000000000000000000000000002',
  cotiRpcUrl: 'https://testnet.coti.io/rpc',
  ethereumRpcUrl: 'https://rpc.sepolia.org'
};

export const ENS_CONFIG = {
  domain: 'omnibazaar.eth',
  subdomain: 'omnicoin.omnibazaar.eth',
  registryAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
  resolverAddress: '0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63'
};