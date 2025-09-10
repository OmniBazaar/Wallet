/**
 * ENS Service for resolving .eth domains and omnicoin.omnibazaar.eth addresses
 */

import { ethers } from 'ethers';
import { ContractManager, ENS_CONFIG, defaultConfig } from '../contracts/ContractConfig';

/** ENS resolution service for .eth and .omnicoin domains */
export class ENSService {
  private static instance: ENSService;
  private contractManager: ContractManager;
  private ensRegistry: ethers.Contract;

  private constructor() {
    try {
      this.contractManager = ContractManager.getInstance();
    } catch (error) {
      // If ContractManager is not initialized, initialize with default config
      this.contractManager = ContractManager.initialize(defaultConfig);
    }

    // ENS Registry ABI (minimal)
    const ENS_REGISTRY_ABI = [
      "function resolver(bytes32 node) external view returns (address)",
      "function owner(bytes32 node) external view returns (address)"
    ];

    // ENS Resolver ABI (minimal)
    const _ENS_RESOLVER_ABI = [
      "function addr(bytes32 node) external view returns (address)",
      "function addr(bytes32 node, uint256 coinType) external view returns (bytes memory)"
    ];

    // Only initialize contract if we have a valid address
    if (ENS_CONFIG.registryAddress !== null && ENS_CONFIG.registryAddress !== undefined && ENS_CONFIG.registryAddress !== '') {
      this.ensRegistry = new ethers.Contract(
        ENS_CONFIG.registryAddress,
        ENS_REGISTRY_ABI,
        this.contractManager.getEthereumProvider()
      );
    } else {
      // Create a mock contract for testing
      this.ensRegistry = new ethers.Contract(
        '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
        ENS_REGISTRY_ABI,
        new ethers.JsonRpcProvider('https://rpc.sepolia.org')
      );
    }
  }

  /**
   * Get singleton instance of ENSService
   * @returns ENSService instance
   */
  public static getInstance(): ENSService {
    if (ENSService.instance == null) {
      ENSService.instance = new ENSService();
    }
    return ENSService.instance;
  }

  /**
   * Resolve any ENS name to an address
   * Supports both .eth domains and .omnicoin addresses
   * @param name Domain name to resolve (.eth, .omnicoin, or address)
   * @returns Promise resolving to address or null if not found
   */
  public async resolveAddress(name: string): Promise<string | null> {
    try {
      // Check if it's a .omnicoin address
      if (name.endsWith('.omnicoin')) {
        return await this.resolveOmnicoinAddress(name);
      }

      // Check if it's a .eth address
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
   * Resolve .omnicoin addresses via our stateless resolver
   * @param name .omnicoin domain name to resolve
   * @returns Promise resolving to address or null if not found
   */
  private async resolveOmnicoinAddress(name: string): Promise<string | null> {
    try {
      // Extract username from alice.omnicoin
      const username = name.replace('.omnicoin', '');

      // Use our stateless resolver
      const resolverContract = this.contractManager.getResolverContract();
      const address = await resolverContract.resolve(username) as string;

      return address !== ethers.ZeroAddress ? address : null;
    } catch (error) {
      // Error resolving .omnicoin address
      return null;
    }
  }

  /**
   * Resolve standard .eth addresses via ENS
   * @param name - ENS name to resolve
   * @returns Promise resolving to address or null
   */
  private async resolveEthAddress(name: string): Promise<string | null> {
    try {
      // Calculate namehash for ENS
      const namehash = ethers.namehash(name);

      // Get resolver address from ENS registry
      const resolverAddress = await this.ensRegistry.resolver(namehash) as string;

      if (resolverAddress === ethers.ZeroAddress) {
        return null;
      }

      // Create resolver contract instance
      const ENS_RESOLVER_ABI = [
        "function addr(bytes32 node) external view returns (address)"
      ];

      const resolver = new ethers.Contract(
        resolverAddress,
        ENS_RESOLVER_ABI,
        this.contractManager.getEthereumProvider()
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
   * Resolve address for specific cryptocurrency
   * Used for multi-chain transactions
   * @param name - Domain name to resolve
   * @param coinType - Coin type identifier (e.g., 60 for ETH)
   * @returns Promise resolving to address or null
   */
  public async resolveAddressForCoin(name: string, coinType: number): Promise<string | null> {
    try {
      // For .omnicoin addresses, always return the same address (EVM compatible)
      if (name.endsWith('.omnicoin')) {
        return await this.resolveOmnicoinAddress(name);
      }

      // For .eth addresses, use ENS multicoin support
      if (name.endsWith('.eth')) {
        const namehash = ethers.namehash(name);
        const resolverAddress = await this.ensRegistry.resolver(namehash) as string;

        if (resolverAddress === ethers.ZeroAddress) {
          return null;
        }

        const ENS_RESOLVER_ABI = [
          "function addr(bytes32 node, uint256 coinType) external view returns (bytes memory)"
        ];

        const resolver = new ethers.Contract(
          resolverAddress,
          ENS_RESOLVER_ABI,
          this.contractManager.getEthereumProvider()
        );

        const addressBytes = await resolver.addr(namehash, coinType) as string;

        if (addressBytes === '0x' || addressBytes.length === 0) {
          return null;
        }

        // Convert bytes to address format based on coin type
        return this.formatAddressForCoinType(addressBytes, coinType);
      }

      return null;
    } catch (error) {
      // Error resolving address for coin type
      return null;
    }
  }

  /**
   * Format address bytes for specific coin type
   * @param addressBytes - Raw address bytes from resolver
   * @param coinType - Coin type identifier
   * @returns Formatted address string
   */
  private formatAddressForCoinType(addressBytes: string, coinType: number): string {
    // Coin type constants
    const COIN_TYPES = {
      ETH: 60,
      BTC: 0,
      POL: 966, // Polygon
      ARB: 60,  // Arbitrum (uses ETH format)
      OPT: 60   // Optimism (uses ETH format)
    };

    // For EVM-compatible chains, treat as Ethereum address
    if (coinType === COIN_TYPES.ETH || coinType === COIN_TYPES.ARB || coinType === COIN_TYPES.OPT) {
      // Remove 0x prefix if present and ensure proper length
      const cleanBytes = addressBytes.replace('0x', '');
      if (cleanBytes.length === 40) {
        return '0x' + cleanBytes;
      }
      // If it's encoded differently, extract the address
      if (cleanBytes.length > 40) {
        return '0x' + cleanBytes.slice(-40);
      }
    }

    // For Polygon, also use ETH format
    if (coinType === COIN_TYPES.POL) {
      const cleanBytes = addressBytes.replace('0x', '');
      if (cleanBytes.length === 40) {
        return '0x' + cleanBytes;
      }
      if (cleanBytes.length > 40) {
        return '0x' + cleanBytes.slice(-40);
      }
    }

    // For other coin types, return as-is (would need specific formatting)
    return addressBytes;
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
   * Reverse resolve address to ENS name
   * @param address - Address to reverse resolve
   * @returns Promise resolving to ENS name or null
   */
  public async reverseResolve(address: string): Promise<string | null> {
    try {
      // Check if it resolves to a .omnicoin address
      // TODO: Implement .omnicoin reverse resolution
      // This would require access to the username registry service
      // For now, skip this check

      // Try ENS reverse resolution
      const reverseName = `${address.slice(2).toLowerCase()}.addr.reverse`;
      const namehash = ethers.namehash(reverseName);
      const resolverAddress = await this.ensRegistry.resolver(namehash) as string;

      if (resolverAddress === ethers.ZeroAddress) {
        return null;
      }

      const ENS_RESOLVER_ABI = [
        "function name(bytes32 node) external view returns (string memory)"
      ];

      const resolver = new ethers.Contract(
        resolverAddress,
        ENS_RESOLVER_ABI,
        this.contractManager.getEthereumProvider()
      );

      const name = await resolver.name(namehash) as string;
      return (name !== null && name !== undefined && name !== '') ? name : null;
    } catch (error) {
      // Error reverse resolving address
      return null;
    }
  }
}
