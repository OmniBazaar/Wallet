/**
 * Contract configuration and initialization
 */

import { ethers } from 'ethers';
import OmniNameRegistryArtifact from '../../../contract-tests/artifacts/contracts/OmniNameRegistry.sol/OmniNameRegistry.json';
import OmniStatelessResolverArtifact from '../../../contract-tests/artifacts/contracts/OmniStatelessResolver.sol/OmniStatelessResolver.json';

/** Configuration for contract addresses and RPC endpoints */
export interface ContractConfig {
  /** OmniNameRegistry contract address */
  registryAddress: string;
  /** OmniStatelessResolver contract address */
  resolverAddress: string;
  /** COTI network RPC URL */
  cotiRpcUrl: string;
  /** Ethereum network RPC URL */
  ethereumRpcUrl: string;
}

/** Manages contract instances and provider connections */
export class ContractManager {
  private static instance: ContractManager;
  private config: ContractConfig;
  private cotiProvider: ethers.JsonRpcProvider;
  private ethereumProvider: ethers.JsonRpcProvider;
  private registryContract: ethers.Contract;
  private resolverContract: ethers.Contract;

  private constructor(config: ContractConfig) {
    this.config = config;
    this.cotiProvider = new ethers.JsonRpcProvider(config.cotiRpcUrl);
    this.ethereumProvider = new ethers.JsonRpcProvider(config.ethereumRpcUrl);

    // Initialize contracts with ABIs
    this.registryContract = new ethers.Contract(
      config.registryAddress,
      OmniNameRegistryArtifact.abi,
      this.cotiProvider
    );

    this.resolverContract = new ethers.Contract(
      config.resolverAddress,
      OmniStatelessResolverArtifact.abi,
      this.ethereumProvider
    );
  }

  /**
   * Initialize the contract manager singleton
   * @param config Contract configuration
   * @returns ContractManager instance
   */
  public static initialize(config: ContractConfig): ContractManager {
    if (ContractManager.instance == null) {
      ContractManager.instance = new ContractManager(config);
    }
    return ContractManager.instance;
  }

  /**
   * Get the contract manager singleton instance
   * @returns ContractManager instance
   * @throws Error if not initialized
   */
  public static getInstance(): ContractManager {
    if (ContractManager.instance == null) {
      throw new Error('ContractManager not initialized. Call initialize() first.');
    }
    return ContractManager.instance;
  }

  /**
   * Get the OmniNameRegistry contract instance
   * @returns Ethers contract instance
   */
  public getRegistryContract(): ethers.Contract {
    return this.registryContract;
  }

  /**
   * Get the OmniStatelessResolver contract instance
   * @returns Ethers contract instance
   */
  public getResolverContract(): ethers.Contract {
    return this.resolverContract;
  }

  /**
   * Get the COTI network provider
   * @returns COTI JsonRpcProvider instance
   */
  public getCotiProvider(): ethers.JsonRpcProvider {
    return this.cotiProvider;
  }

  /**
   *
   */
  public getEthereumProvider(): ethers.JsonRpcProvider {
    return this.ethereumProvider;
  }

  /**
   *
   */
  public getConfig(): ContractConfig {
    return this.config;
  }
}

// Default configuration
export const defaultConfig: ContractConfig = {
  registryAddress: (process?.env?.['REGISTRY_CONTRACT_ADDRESS'] as string | undefined) ?? '',
  resolverAddress: (process?.env?.['RESOLVER_CONTRACT_ADDRESS'] as string | undefined) ?? '',
  cotiRpcUrl: (process?.env?.['COTI_RPC_URL'] as string | undefined) ?? 'https://testnet.coti.io/rpc',
  ethereumRpcUrl: (process?.env?.['ETHEREUM_RPC_URL'] as string | undefined) ?? 'https://sepolia.infura.io/v3/your-key'
};

// ENS Configuration
export const ENS_CONFIG = {
  domain: 'omnibazaar.eth',
  subdomain: 'omnicoin.omnibazaar.eth',
  registryAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e', // ENS Registry
  resolverAddress: (process?.env?.['RESOLVER_CONTRACT_ADDRESS'] as string | undefined) ?? ''
};
