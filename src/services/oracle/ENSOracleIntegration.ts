/**
 * ENSOracleIntegration - Integration service for ENS Oracle
 *
 * This service provides the interface between the Wallet module and the
 * real ValidatorENSOracle implementation from the Validator module.
 */

import { ValidatorENSOracle } from '../../../../Validator/dist/services/ens/ValidatorENSOracle';
import type {
  ValidatorENSOracleConfig
} from '../../../../Validator/dist/services/ens/ValidatorENSOracle';
import { createOmniValidatorClient } from '../../../../Validator/dist/client/index';

/**
 * Service for ENS name resolution through the validator oracle
 */
export class ENSOracleIntegration {
  private ensOracle: ValidatorENSOracle;
  private static instance: ENSOracleIntegration;

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    // Create validator client for ENS oracle
    const validatorEndpoint = process.env['VITE_VALIDATOR_ENDPOINT'] ?? process.env['TEST_VALIDATOR_ENDPOINT'] ?? 'http://localhost:4000';
    const validatorClient = createOmniValidatorClient({
      validatorEndpoint,
      wsEndpoint: validatorEndpoint.replace('http', 'ws') + '/graphql',
      timeout: 30000,
      retryAttempts: 3
    });

    // Create config for ENS oracle
    const config: ValidatorENSOracleConfig = {
      validatorClient,
      ethereumRpcUrl: process.env['VITE_ETH_RPC_URL'] ?? 'https://eth-mainnet.alchemyapi.io/v2/demo',
      cotiRpcUrl: process.env['VITE_AVALANCHE_RPC_URL'] ?? 'https://api.avax.network/ext/bc/C/rpc',
      oracleContractAddress: process.env['VITE_ENS_ORACLE_CONTRACT'] ?? '0x0000000000000000000000000000000000000000',
      resolverContractAddress: process.env['VITE_ENS_RESOLVER_CONTRACT'] ?? '0x0000000000000000000000000000000000000000',
      registryContractAddress: process.env['VITE_ENS_REGISTRY_CONTRACT'] ?? '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
      updateInterval: 300,
      batchSize: 10,
      nodeId: `wallet-ens-${Date.now()}`,
      privateKey: process.env['VITE_WALLET_PRIVATE_KEY'] ?? '0x' + '0'.repeat(64)
    };

    this.ensOracle = new ValidatorENSOracle(config);
  }

  /**
   * Get singleton instance
   * @returns ENSOracleIntegration instance
   */
  static getInstance(): ENSOracleIntegration {
    if (ENSOracleIntegration.instance === undefined) {
      ENSOracleIntegration.instance = new ENSOracleIntegration();
    }
    return ENSOracleIntegration.instance;
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    try {
      await this.ensOracle.initialize();
    } catch (error) {
      console.error('ENSOracleIntegration initialization error:', error);
      throw error;
    }
  }

  /**
   * Resolve ENS name to address
   * @param name ENS name
   * @returns Ethereum address
   */
  async resolveENS(name: string): Promise<string> {
    if (!name.endsWith('.eth')) {
      throw new Error('Invalid ENS name - must end with .eth');
    }

    const address = await this.ensOracle.resolveNameToAddress(name);
    if (address === null || address === '') {
      throw new Error(`ENS name ${name} not found`);
    }

    return address;
  }

  /**
   * Reverse resolve address to ENS name
   * @param address Ethereum address
   * @returns ENS name or null if not found
   */
  async reverseResolveENS(address: string): Promise<string | null> {
    return await this.ensOracle.resolveAddressToName(address);
  }

  /**
   * Check if ENS name is available
   * @param name ENS name to check
   * @returns True if available
   */
  async isENSAvailable(name: string): Promise<boolean> {
    try {
      const address = await this.ensOracle.resolveNameToAddress(name);
      return address === null || address === ''; // If no address resolved, name is available
    } catch {
      return true; // If error, assume available
    }
  }

  /**
   * Get ENS metadata
   * @param name ENS name
   * @returns ENS metadata
   */
  async getENSMetadata(name: string): Promise<{
    owner: string;
    resolver: string;
    registeredAt: number;
    expiresAt: number;
  }> {
    const record = await this.ensOracle.getFullRecord(name);

    if (record === null) {
      throw new Error(`No metadata found for ${name}`);
    }

    // Convert ENSRecord to expected format
    return {
      owner: record.owner,
      resolver: record.resolver ?? '',
      registeredAt: record.registeredAt ?? Date.now() - 365 * 24 * 60 * 60 * 1000, // Default 1 year ago
      expiresAt: record.expiresAt ?? Date.now() + 365 * 24 * 60 * 60 * 1000 // Default 1 year from now
    };
  }

  /**
   * Register ENS name (mock implementation)
   * @param params Registration parameters
   * @param params.name ENS name to register
   * @param params.owner Owner address
   * @param params.duration Duration in years
   * @returns Registration result
   */
  async registerENS(params: {
    name: string;
    owner: string;
    duration: number;
  }): Promise<{
    success: boolean;
    transactionHash?: string;
    expiresAt?: number;
    error?: string;
  }> {
    try {
      // Check if name is available
      const available = await this.isENSAvailable(params.name);
      if (!available) {
        return {
          success: false,
          error: 'Name already taken'
        };
      }

      // Mock successful registration
      const expiresAt = Date.now() + params.duration * 365 * 24 * 60 * 60 * 1000;
      const transactionHash = `0x${Math.random().toString(16).substring(2)}${Math.random().toString(16).substring(2)}`;

      // In a real implementation, this would interact with ENS contracts
      return {
        success: true,
        transactionHash,
        expiresAt
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed'
      };
    }
  }

  /**
   * Get multiple ENS records in batch
   * @param names Array of ENS names
   * @returns Map of name to address
   */
  async batchResolve(names: string[]): Promise<Map<string, string | null>> {
    const results = new Map<string, string | null>();

    // Process in parallel for efficiency
    const promises = names.map(async (name) => {
      try {
        const address = await this.ensOracle.resolveNameToAddress(name);
        results.set(name, address);
      } catch {
        results.set(name, null);
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Get text records for ENS name
   * @param name ENS name
   * @param keys Text record keys to fetch
   * @returns Map of key to value
   */
  async getTextRecords(
    name: string,
    keys: string[]
  ): Promise<Map<string, string | null>> {
    const record = await this.ensOracle.getFullRecord(name);
    const results = new Map<string, string | null>();

    if (record === null || record.textRecords === undefined) {
      keys.forEach(key => results.set(key, null));
      return results;
    }

    for (const key of keys) {
      const value = record.textRecords[key];
      results.set(key, (value !== undefined && value !== '') ? value : null);
    }

    return results;
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    await this.ensOracle.shutdown();
  }
}