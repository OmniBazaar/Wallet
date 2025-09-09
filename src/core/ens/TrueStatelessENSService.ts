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
      (process?.env?.['OMNICOIN_RPC_URL']) ?? 'https://testnet.omnicoin.io/rpc'
    );
    
    // OmniCoin Registry contract instance
    const REGISTRY_ABI = [
      "function resolve(string memory username) external view returns (address)",
      "function reverseResolve(address addr) external view returns (string memory)",
      "function isAvailable(string memory username) external view returns (bool)"
    ];
    
    this.omnicoinRegistryContract = new ethers.Contract(
      (process?.env?.['OMNICOIN_REGISTRY_ADDRESS']) ?? '',
      REGISTRY_ABI,
      this.omnicoinProvider
    );
  }

  /**
   * Get a singleton instance of the stateless ENS service.
   * @returns Service instance
   */
  public static getInstance(): TrueStatelessENSService {
    if (TrueStatelessENSService.instance === null || TrueStatelessENSService.instance === undefined) {
      TrueStatelessENSService.instance = new TrueStatelessENSService();
    }
    return TrueStatelessENSService.instance;
  }

  /**
   * Resolve any ENS name to an address
   * NO oracle updates, NO ETH gas fees - direct OmniCoin queries only
   * @param name - Domain name or address to resolve
   * @returns Resolved address or null
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
      // Error resolving address
      return null;
    }
  }

  /**
   * Resolve .omnicoin addresses by querying OmniCoin directly
   * NO oracle updates, NO ETH gas fees
   * @param name - .omnicoin domain name
   * @returns Resolved address or null
   */
  private async resolveOmnicoinAddress(name: string): Promise<string | null> {
    try {
      // Extract username from alice.omnicoin
      const username = name.replace('.omnicoin', '');
      
      // Query OmniCoin registry directly - NO ETH gas fees!
      const address = await this.omnicoinRegistryContract.resolve(username) as string;
      
      return address !== ethers.ZeroAddress ? address : null;
    } catch (error) {
      // Error resolving .omnicoin address
      return null;
    }
  }

  /**
   * Resolve standard .eth addresses via ENS (unchanged)
   * @param name - .eth domain name
   * @returns Resolved address or null
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
      const resolverAddress = await ensRegistry.resolver(namehash) as string;
      
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
      const address = await resolver.addr(namehash) as string;
      
      return address !== ethers.ZeroAddress ? address : null;
    } catch (error) {
      // Error resolving .eth address
      return null;
    }
  }

  /**
   * Check if a username is available on OmniCoin
   * Direct query - NO ETH gas fees
   * @param username - Username to check
   * @returns True if available
   */
  public async isUsernameAvailable(username: string): Promise<boolean> {
    try {
      const isAvailable = await this.omnicoinRegistryContract.isAvailable(username) as boolean;
      return isAvailable;
    } catch (error) {
      // Error checking username availability
      return false;
    }
  }

  /**
   * Reverse resolve address to username
   * Direct OmniCoin query - NO ETH gas fees
   * @param address - Address to reverse resolve
   * @returns Username with .omnicoin suffix or null
   */
  public async reverseResolve(address: string): Promise<string | null> {
    try {
      // Query OmniCoin for reverse resolution
      const username = await this.omnicoinRegistryContract.reverseResolve(address) as string;
      return username !== '' ? `${username}.omnicoin` : null;
    } catch (error) {
      // Error reverse resolving address
      return null;
    }
  }

  /**
   * Batch resolve multiple usernames
   * All queries go to OmniCoin - NO ETH gas fees
   * @param names - Array of names to resolve
   * @returns Array of resolved addresses or null values
   */
  public async batchResolveAddresses(names: string[]): Promise<(string | null)[]> {
    const promises = names.map(name => this.resolveAddress(name));
    return Promise.all(promises);
  }

  /**
   * Check if a name is a valid ENS name
   * @param name - Name to check
   * @returns True if valid ENS name
   */
  public isValidENSName(name: string): boolean {
    return name.endsWith('.eth') || name.endsWith('.omnicoin');
  }

  /**
   * Get OmniCoin network information
   * @returns Network information object
   */
  public async getOmnicoinNetworkInfo(): Promise<{
    /** Chain ID as string */
    chainId: string;
    /** Current block number */
    blockNumber: number;
    /** Registry contract address */
    registryAddress: string;
  }> {
    const network = await this.omnicoinProvider.getNetwork();
    const blockNumber = await this.omnicoinProvider.getBlockNumber();
    
    return {
      chainId: network.chainId.toString(),
      blockNumber,
      registryAddress: (process?.env?.['OMNICOIN_REGISTRY_ADDRESS']) ?? ''
    };
  }

  /**
   * Test OmniCoin connection
   * @returns True if connection is successful
   */
  public async testOmnicoinConnection(): Promise<boolean> {
    try {
      await this.omnicoinProvider.getBlockNumber();
      return true;
    } catch (error) {
      // OmniCoin connection test failed
      return false;
    }
  }
}
