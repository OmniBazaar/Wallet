/**
 * True Stateless ENS Service - NO oracle updates, NO ETH gas fees
 * Queries OmniCoin chain directly for name resolution
 */

import { ethers } from 'ethers';
import { ContractManager, ENS_CONFIG } from '../contracts/ContractConfig';

/**
 * Stateless resolver that queries OmniCoin and Ethereum directly
 * without requiring any oracle updates or paying gas. Supports:
 * - `.omnicoin` usernames via OmniCoin registry
 * - `.eth` names via standard ENS on Ethereum
 */
export class TrueStatelessENSService {
  private static instance: TrueStatelessENSService;
  private contractManager: ContractManager;
  private omnicoinProvider: ethers.JsonRpcProvider;
  private omnicoinRegistryContract: ethers.Contract;

  private constructor() {
    this.contractManager = ContractManager.getInstance();
    
    // OmniCoin provider for direct queries
    this.omnicoinProvider = new ethers.JsonRpcProvider(
      process.env.OMNICOIN_RPC_URL || 'https://testnet.omnicoin.io/rpc'
    );
    
    // OmniCoin Registry contract instance
    const REGISTRY_ABI = [
      "function resolve(string memory username) external view returns (address)",
      "function reverseResolve(address addr) external view returns (string memory)",
      "function isAvailable(string memory username) external view returns (bool)"
    ];
    
    this.omnicoinRegistryContract = new ethers.Contract(
      process.env.OMNICOIN_REGISTRY_ADDRESS || '',
      REGISTRY_ABI,
      this.omnicoinProvider
    );
  }

  /**
   * Get a singleton instance of the stateless ENS service.
   * @returns Service instance
   */
  public static getInstance(): TrueStatelessENSService {
    if (!TrueStatelessENSService.instance) {
      TrueStatelessENSService.instance = new TrueStatelessENSService();
    }
    return TrueStatelessENSService.instance;
  }

  /**
   * Resolve any ENS name to an address
   * NO oracle updates, NO ETH gas fees - direct OmniCoin queries only
   * @param name
   */
  public async resolveAddress(name: string): Promise<string | null> {
    try {
      // Check if it's a .omnicoin address
      if (name.endsWith('.omnicoin')) {
        return await this.resolveOmnicoinAddress(name);
      }
      
      // Check if it's a .eth address (use standard ENS)
      if (name.endsWith('.eth')) {
        return await this.resolveEthAddress(name);
      }
      
      // Check if it's already a valid address
      if (ethers.isAddress(name)) {
        return name;
      }
      
      return null;
    } catch (error) {
      console.error('Error resolving address:', error);
      return null;
    }
  }

  /**
   * Resolve .omnicoin addresses by querying OmniCoin directly
   * NO oracle updates, NO ETH gas fees
   * @param name
   */
  private async resolveOmnicoinAddress(name: string): Promise<string | null> {
    try {
      // Extract username from alice.omnicoin
      const username = name.replace('.omnicoin', '');
      
      // Query OmniCoin registry directly - NO ETH gas fees!
      const address = await this.omnicoinRegistryContract.resolve(username);
      
      return address !== ethers.ZeroAddress ? address : null;
    } catch (error) {
      console.error('Error resolving .omnicoin address:', error);
      return null;
    }
  }

  /**
   * Resolve standard .eth addresses via ENS (unchanged)
   * @param name
   */
  private async resolveEthAddress(name: string): Promise<string | null> {
    try {
      const ethereumProvider = this.contractManager.getEthereumProvider();
      
      // ENS Registry ABI
      const ENS_REGISTRY_ABI = [
        "function resolver(bytes32 node) external view returns (address)"
      ];
      
      const ENS_RESOLVER_ABI = [
        "function addr(bytes32 node) external view returns (address)"
      ];
      
      const ensRegistry = new ethers.Contract(
        ENS_CONFIG.registryAddress,
        ENS_REGISTRY_ABI,
        ethereumProvider
      );
      
      // Calculate namehash for ENS
      const namehash = ethers.namehash(name);
      
      // Get resolver address from ENS registry
      const resolverAddress = await ensRegistry.resolver(namehash);
      
      if (resolverAddress === ethers.ZeroAddress) {
        return null;
      }
      
      // Create resolver contract instance
      const resolver = new ethers.Contract(
        resolverAddress,
        ENS_RESOLVER_ABI,
        ethereumProvider
      );
      
      // Get address from resolver
      const address = await resolver.addr(namehash);
      
      return address !== ethers.ZeroAddress ? address : null;
    } catch (error) {
      console.error('Error resolving .eth address:', error);
      return null;
    }
  }

  /**
   * Check if a username is available on OmniCoin
   * Direct query - NO ETH gas fees
   * @param username
   */
  public async isUsernameAvailable(username: string): Promise<boolean> {
    try {
      const isAvailable = await this.omnicoinRegistryContract.isAvailable(username);
      return isAvailable;
    } catch (error) {
      console.error('Error checking username availability:', error);
      return false;
    }
  }

  /**
   * Reverse resolve address to username
   * Direct OmniCoin query - NO ETH gas fees
   * @param address
   */
  public async reverseResolve(address: string): Promise<string | null> {
    try {
      // Query OmniCoin for reverse resolution
      const username = await this.omnicoinRegistryContract.reverseResolve(address);
      return username !== '' ? `${username}.omnicoin` : null;
    } catch (error) {
      console.error('Error reverse resolving address:', error);
      return null;
    }
  }

  /**
   * Batch resolve multiple usernames
   * All queries go to OmniCoin - NO ETH gas fees
   * @param names
   */
  public async batchResolveAddresses(names: string[]): Promise<(string | null)[]> {
    const promises = names.map(name => this.resolveAddress(name));
    return Promise.all(promises);
  }

  /**
   * Check if a name is a valid ENS name
   * @param name
   */
  public isValidENSName(name: string): boolean {
    return name.endsWith('.eth') || name.endsWith('.omnicoin');
  }

  /**
   * Get OmniCoin network information
   */
  public async getOmnicoinNetworkInfo(): Promise<{
    /**
     *
     */
    chainId: string;
    /**
     *
     */
    blockNumber: number;
    /**
     *
     */
    registryAddress: string;
  }> {
    try {
      const network = await this.omnicoinProvider.getNetwork();
      const blockNumber = await this.omnicoinProvider.getBlockNumber();
      
      return {
        chainId: network.chainId.toString(),
        blockNumber,
        registryAddress: process.env.OMNICOIN_REGISTRY_ADDRESS || ''
      };
    } catch (error) {
      console.error('Error getting OmniCoin network info:', error);
      throw error;
    }
  }

  /**
   * Test OmniCoin connection
   */
  public async testOmnicoinConnection(): Promise<boolean> {
    try {
      await this.omnicoinProvider.getBlockNumber();
      return true;
    } catch (error) {
      console.error('OmniCoin connection test failed:', error);
      return false;
    }
  }
}
