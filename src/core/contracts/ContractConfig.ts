/**
 * Contract configuration and initialization
 */

import { ethers } from 'ethers';
import OmniNameRegistryArtifact from '../../../contract-tests/artifacts/contracts/OmniNameRegistry.sol/OmniNameRegistry.json';
import OmniStatelessResolverArtifact from '../../../contract-tests/artifacts/contracts/OmniStatelessResolver.sol/OmniStatelessResolver.json';

/**
 *
 */
export interface ContractConfig {
  /**
   *
   */
  registryAddress: string;
  /**
   *
   */
  resolverAddress: string;
  /**
   *
   */
  cotiRpcUrl: string;
  /**
   *
   */
  ethereumRpcUrl: string;
}

/**
 *
 */
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
   *
   * @param config
   */
  public static initialize(config: ContractConfig): ContractManager {
    if (!ContractManager.instance) {
      ContractManager.instance = new ContractManager(config);
    }
    return ContractManager.instance;
  }

  /**
   *
   */
  public static getInstance(): ContractManager {
    if (!ContractManager.instance) {
      throw new Error('ContractManager not initialized. Call initialize() first.');
    }
    return ContractManager.instance;
  }

  /**
   *
   */
  public getRegistryContract(): ethers.Contract {
    return this.registryContract;
  }

  /**
   *
   */
  public getResolverContract(): ethers.Contract {
    return this.resolverContract;
  }

  /**
   *
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
  registryAddress: process.env.REGISTRY_CONTRACT_ADDRESS || '',
  resolverAddress: process.env.RESOLVER_CONTRACT_ADDRESS || '',
  cotiRpcUrl: process.env.COTI_RPC_URL || 'https://testnet.coti.io/rpc',
  ethereumRpcUrl: process.env.ETHEREUM_RPC_URL || 'https://sepolia.infura.io/v3/your-key'
};

// ENS Configuration
export const ENS_CONFIG = {
  domain: 'omnibazaar.eth',
  subdomain: 'omnicoin.omnibazaar.eth',
  registryAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e', // ENS Registry
  resolverAddress: process.env.RESOLVER_CONTRACT_ADDRESS || ''
};