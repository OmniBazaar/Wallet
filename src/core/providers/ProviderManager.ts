/**
 * ProviderManager - Unified provider management for all supported chains
 *
 * This manager handles provider initialization, switching, and access
 * for all supported blockchains in the OmniBazaar wallet.
 */

import { ethers } from 'ethers';
import { LiveEthereumProvider, ETHEREUM_NETWORKS } from '../chains/ethereum/live-provider';
import { LiveCOTIProvider, COTI_NETWORKS } from '../chains/coti/live-provider';
import { LiveOmniCoinProvider, OMNICOIN_NETWORKS } from '../chains/omnicoin/live-provider';
import { LiveBitcoinProvider } from '../chains/bitcoin/live-provider';
import { MultiChainEVMProvider, ALL_NETWORKS } from '../chains/evm';
import { LivePolkadotProvider, POLKADOT_NETWORKS } from '../chains/polkadot';
import { LiveSolanaProvider, SOLANA_NETWORKS } from '../chains/solana';
import { keyringService } from '../keyring/KeyringService';
import { ChainType } from '../keyring/BIP39Keyring';

/** Network type for blockchain environments */
export type NetworkType = 'mainnet' | 'testnet';
/** Union type of all supported blockchain providers */
export type ProviderType = LiveEthereumProvider | LiveCOTIProvider | LiveOmniCoinProvider | LiveBitcoinProvider | MultiChainEVMProvider | LivePolkadotProvider | LiveSolanaProvider;

/** Configuration for a blockchain chain */
export interface ChainConfig {
  /** Type of blockchain (ethereum, bitcoin, etc.) */
  chainType: ChainType;
  /** Human-readable name of the chain */
  name: string;
  /** Icon URL or identifier for the chain */
  icon: string;
  /** Available network names for this chain */
  networks: string[];
  /** Default network to use for this chain */
  defaultNetwork: string;
  /** Supported features for this chain */
  features: {
    /** Supports privacy features */
    privacy?: boolean;
    /** Supports staking operations */
    staking?: boolean;
    /** Supports marketplace functionality */
    marketplace?: boolean;
    /** Supports NFT operations */
    nft?: boolean;
    /** Supports DeFi protocols */
    defi?: boolean;
  };
}

export const SUPPORTED_CHAINS: Record<ChainType, ChainConfig> = {
  ethereum: {
    chainType: 'ethereum',
    name: 'Ethereum',
    icon: 'ethereum',
    networks: Object.keys(ETHEREUM_NETWORKS),
    defaultNetwork: 'mainnet',
    features: {
      nft: true,
      defi: true
    }
  },
  bitcoin: {
    chainType: 'bitcoin',
    name: 'Bitcoin',
    icon: 'bitcoin',
    networks: ['mainnet', 'testnet'],
    defaultNetwork: 'mainnet',
    features: {}
  },
  solana: {
    chainType: 'solana',
    name: 'Solana',
    icon: 'solana',
    networks: Object.keys(SOLANA_NETWORKS),
    defaultNetwork: 'mainnet',
    features: {
      nft: true,
      defi: true
    }
  },
  substrate: {
    chainType: 'substrate',
    name: 'Polkadot/Substrate',
    icon: 'polkadot',
    networks: Object.keys(POLKADOT_NETWORKS),
    defaultNetwork: 'polkadot',
    features: {
      staking: true,
      nft: true
    }
  },
  coti: {
    chainType: 'coti',
    name: 'COTI',
    icon: 'coti',
    networks: Object.keys(COTI_NETWORKS),
    defaultNetwork: 'testnet',
    features: {
      privacy: true
    }
  },
  omnicoin: {
    chainType: 'omnicoin',
    name: 'OmniCoin',
    icon: 'omnicoin',
    networks: Object.keys(OMNICOIN_NETWORKS),
    defaultNetwork: 'testnet',
    features: {
      privacy: true,
      staking: true,
      marketplace: true,
      nft: true
    }
  }
};

/**
 * Manages blockchain providers for all supported chains
 * Provides unified access to different blockchain networks
 */
export class ProviderManager {
  private static instance: ProviderManager;
  private providers: Map<ChainType, ProviderType> = new Map();
  private evmProviders: Map<string, MultiChainEVMProvider> = new Map();
  private activeChain: ChainType = 'ethereum';
  private activeNetwork = 'ethereum'; // For EVM chain switching
  private networkType: NetworkType = 'mainnet';
  private initialized = false;

  private constructor() { }

  /**
   * Get the singleton instance of ProviderManager
   * @returns The ProviderManager instance
   */
  public static getInstance(): ProviderManager {
    if (!ProviderManager.instance) {
      ProviderManager.instance = new ProviderManager();
    }
    return ProviderManager.instance;
  }

  /**
   * Initialize all providers
   * @param networkType Network type to initialize (mainnet or testnet)
   */
  async initialize(networkType: NetworkType = 'mainnet'): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.networkType = networkType;

    try {
      // Initialize main Ethereum provider for backward compatibility
      const ethProvider = new LiveEthereumProvider(
        networkType === 'mainnet' ? 'mainnet' : 'sepolia'
      );
      this.providers.set('ethereum', ethProvider);

      // Initialize EVM providers for all supported chains
      for (const [networkKey, network] of Object.entries(ALL_NETWORKS)) {
        // Skip testnets in mainnet mode and vice versa
        if (networkType === 'mainnet' && network.testnet) continue;
        if (networkType === 'testnet' && !network.testnet) continue;

        const evmProvider = new MultiChainEVMProvider(networkKey);
        this.evmProviders.set(networkKey, evmProvider);
      }

      // Initialize COTI provider
      const cotiProvider = new LiveCOTIProvider(networkType);
      this.providers.set('coti', cotiProvider);

      // Initialize OmniCoin provider
      const omniProvider = new LiveOmniCoinProvider(networkType);
      this.providers.set('omnicoin', omniProvider);

      // Initialize Bitcoin provider
      const btcProvider = new LiveBitcoinProvider(networkType);
      this.providers.set('bitcoin', btcProvider);

      // Initialize Polkadot/Substrate providers
      const defaultPolkadotNetwork = networkType === 'mainnet' ? 'polkadot' : 'westend';
      const polkadotProvider = new LivePolkadotProvider(defaultPolkadotNetwork);
      this.providers.set('substrate', polkadotProvider);

      // Initialize Solana provider
      const solanaNetwork = networkType === 'mainnet' ? 'mainnet' : 'devnet';
      const solanaProvider = new LiveSolanaProvider(solanaNetwork);
      this.providers.set('solana', solanaProvider);

      this.initialized = true;
    } catch (error) {
      console.error('Error initializing providers:', error);
      throw error;
    }
  }

  /**
   * Get provider for a specific chain type.
   * @param chainType Chain identifier
   */
  getProvider(chainType: ChainType): ProviderType | null {
    return this.providers.get(chainType) || null;
  }

  /**
   * Get an EVM provider for a specific EVM network key.
   * @param networkKey Key from ALL_NETWORKS
   */
  getEVMProvider(networkKey: string): MultiChainEVMProvider | null {
    return this.evmProviders.get(networkKey) || null;
  }

  /**
   * Switch the active EVM network. Creates a provider on demand.
   * @param networkKey Key from ALL_NETWORKS
   */
  async switchEVMNetwork(networkKey: string): Promise<void> {
    const provider = this.evmProviders.get(networkKey);
    if (!provider) {
      // Try to create a new provider for this network
      const network = ALL_NETWORKS[networkKey];
      if (!network) {
        throw new Error(`Unknown EVM network: ${networkKey}`);
      }

      const newProvider = new MultiChainEVMProvider(networkKey);
      this.evmProviders.set(networkKey, newProvider);
      this.activeNetwork = networkKey;
      this.activeChain = 'ethereum'; // All EVM chains use 'ethereum' chain type
    } else {
      this.activeNetwork = networkKey;
      this.activeChain = 'ethereum';
    }
  }

  /** Get list of available (initialized) EVM networks. */
  getAvailableEVMNetworks(): string[] {
    return Array.from(this.evmProviders.keys());
  }

  /** Get all statically supported EVM network keys. */
  static getSupportedEVMNetworks(): string[] {
    return Object.keys(ALL_NETWORKS);
  }

  /** Get the currently active provider (chain/network aware). */
  getActiveProvider(): ProviderType | null {
    // If active chain is ethereum and we have a specific EVM network active
    if (this.activeChain === 'ethereum' && this.activeNetwork !== 'ethereum') {
      return this.evmProviders.get(this.activeNetwork) || null;
    }
    return this.providers.get(this.activeChain) || null;
  }

  /** Return the active chain type. */
  getActiveChain(): ChainType {
    return this.activeChain;
  }

  /**
   * Set the active chain and update the keyring’s active account.
   * @param chainType Chain identifier
   */
  async setActiveChain(chainType: ChainType): Promise<void> {
    if (!SUPPORTED_CHAINS[chainType]) {
      throw new Error(`Unsupported chain: ${chainType}`);
    }

    this.activeChain = chainType;

    // Update active account in keyring
    const accounts = await keyringService.getAccounts(chainType);
    if (accounts.length > 0 && accounts[0] && accounts[0].address) {
      keyringService.setActiveAccount(accounts[0].address);
    }
  }

  /** Return the current network type (mainnet/testnet). */
  getNetworkType(): NetworkType {
    return this.networkType;
  }

  /**
   * Switch the network type across initialized providers.
   * @param networkType New network type
   */
  async switchNetworkType(networkType: NetworkType): Promise<void> {
    this.networkType = networkType;

    // Switch all providers to new network type
    const ethProvider = this.providers.get('ethereum') as LiveEthereumProvider;
    if (ethProvider) {
      await ethProvider.switchNetwork(networkType === 'mainnet' ? 'mainnet' : 'sepolia');
    }

    const cotiProvider = this.providers.get('coti') as LiveCOTIProvider;
    if (cotiProvider) {
      await cotiProvider.switchNetwork(networkType);
    }

    const omniProvider = this.providers.get('omnicoin') as LiveOmniCoinProvider;
    if (omniProvider) {
      await omniProvider.switchNetwork(networkType);
    }
  }

  /**
   * Get native balance for the active account on a chain.
   * @param chainType Optional chain override (defaults to active)
   */
  async getBalance(chainType?: ChainType): Promise<string> {
    const chain = chainType || this.activeChain;
    const provider = this.getProvider(chain);

    if (!provider) {
      throw new Error(`No provider for chain: ${chain}`);
    }

    try {
      switch (chain) {
        case 'ethereum': {
          // Check if we're using a specific EVM chain
          if (this.activeNetwork !== 'ethereum' && this.evmProviders.has(this.activeNetwork)) {
            const evmProvider = this.evmProviders.get(this.activeNetwork);
            if (!evmProvider) throw new Error(`EVM provider not found for ${this.activeNetwork}`);
            return await evmProvider.getFormattedBalance();
          }
          const ethProvider = provider as LiveEthereumProvider;
          return await ethProvider.getFormattedBalance();
        }

        case 'coti': {
          const cotiProvider = provider as LiveCOTIProvider;
          const balances = await cotiProvider.getFormattedBalance(undefined, true);
          return balances.private
            ? `Public: ${balances.public}, Private: ${balances.private}`
            : balances.public;
        }

        case 'omnicoin': {
          const omniProvider = provider as LiveOmniCoinProvider;
          const balances = await omniProvider.getFormattedBalance(undefined, true);
          let result = `XOM: ${balances.public}`;
          if (balances.private) result += `, XOMP: ${balances.private}`;
          if (balances.staked) result += `, Staked: ${balances.staked}`;
          return result;
        }

        case 'bitcoin': {
          const btcProvider = provider as LiveBitcoinProvider;
          return await btcProvider.getFormattedBalance();
        }

        case 'substrate': {
          const polkadotProvider = provider as LivePolkadotProvider;
          return await polkadotProvider.getActiveFormattedBalance();
        }

        case 'solana': {
          const solanaProvider = provider as LiveSolanaProvider;
          const balance = await solanaProvider.getActiveFormattedBalance();
          // Also get SPL tokens
          const tokens = await solanaProvider.getActiveTokenBalances();
          if (tokens.length > 0) {
            const tokenList = tokens.map(t =>
              `${parseInt(t.amount) / Math.pow(10, t.decimals)} ${t.symbol || 'Unknown'}`
            ).join(', ');
            return `${balance}, Tokens: ${tokenList}`;
          }
          return balance;
        }

        default:
          return '0';
      }
    } catch (error) {
      console.error(`Error getting balance for ${chain}:`, error);
      return '0';
    }
  }

  /** Get native balances for the active account across all chains. */
  async getAllBalances(): Promise<Record<ChainType, string>> {
    const balances: Record<ChainType, string> = {} as Record<ChainType, string>;

    for (const chainType of Object.keys(SUPPORTED_CHAINS) as ChainType[]) {
      try {
        balances[chainType] = await this.getBalance(chainType);
      } catch (error) {
        console.error(`Error getting balance for ${chainType}:`, error);
        balances[chainType] = '0';
      }
    }

    return balances;
  }

  /**
   * Send a native transaction on the specified chain.
   * @param to Recipient address
   * @param amount Human-readable amount (e.g. "1.5")
   * @param chainType Optional chain override
   * @param data Optional calldata for EVM chains
   */
  async sendTransaction(
    to: string,
    amount: string,
    chainType?: ChainType,
    data?: string
  ): Promise<ethers.TransactionResponse | string> {
    const chain = chainType || this.activeChain;
    const provider = this.getProvider(chain);

    if (!provider) {
      throw new Error(`No provider for chain: ${chain}`);
    }

    // Handle Bitcoin separately
    if (chain === 'bitcoin') {
      const btcProvider = provider as LiveBitcoinProvider;
      // Bitcoin amount is in BTC, convert to satoshis
      const satoshis = Math.floor(parseFloat(amount) * 100000000).toString();
      return await btcProvider.sendBitcoin(to, satoshis);
    }

    // Handle Polkadot/Substrate separately
    if (chain === 'substrate') {
      const polkadotProvider = provider as LivePolkadotProvider;
      const network = polkadotProvider.getCurrentNetwork();
      // Convert amount to smallest unit based on decimals
      const value = Math.floor(parseFloat(amount) * Math.pow(10, network.decimals)).toString();
      return await polkadotProvider.sendNativeToken(to, value);
    }

    // Handle Solana separately
    if (chain === 'solana') {
      const solanaProvider = provider as LiveSolanaProvider;
      // Convert SOL to lamports
      const lamports = Math.floor(parseFloat(amount) * 1e9).toString();
      return await solanaProvider.sendNativeToken(to, lamports);
    }

    // Parse amount based on chain decimals for EVM chains
    let value: bigint;
    switch (chain) {
      case 'omnicoin':
        // 18 decimals (updated for EVM standard)
        value = ethers.parseUnits(amount, 18);
        break;
      case 'coti':
        // 6 decimals (COTI native)
        value = ethers.parseUnits(amount, 6);
        break;
      default:
        // 18 decimals
        value = ethers.parseEther(amount);
    }

    const transaction = {
      to,
      value: value,
      data: data || '0x'
    };

    switch (chain) {
      case 'ethereum': {
        // Check if we're using a specific EVM chain
        if (this.activeNetwork !== 'ethereum' && this.evmProviders.has(this.activeNetwork)) {
          const evmProvider = this.evmProviders.get(this.activeNetwork);
          if (!evmProvider) throw new Error(`EVM provider not found for ${this.activeNetwork}`);
          return await evmProvider.sendTransaction(transaction);
        }
        const ethProvider = provider as LiveEthereumProvider;
        return await ethProvider.sendTransaction(transaction);
      }

      case 'coti': {
        const cotiProvider = provider as LiveCOTIProvider;
        return await cotiProvider.sendTransaction(transaction);
      }

      case 'omnicoin': {
        const omniProvider = provider as LiveOmniCoinProvider;
        const signer = await omniProvider.getSigner();
        return await signer.sendTransaction(transaction);
      }

      default:
        throw new Error(`Transaction not supported for chain: ${chain}`);
    }
  }

  /**
   * Sign an arbitrary message with the active account for a chain.
   * @param message Message to sign
   * @param chainType Optional chain override
   */
  async signMessage(message: string, chainType?: ChainType): Promise<string> {
    const chain = chainType || this.activeChain;
    const activeAccount = keyringService.getActiveAccount();

    if (!activeAccount || activeAccount.chainType !== chain) {
      throw new Error(`No active account for chain: ${chain}`);
    }

    return await keyringService.signMessage(activeAccount.address, message);
  }

  /**
   * Get transaction history
   * @param address
   * @param chainType
   * @param _limit
   */
  async getTransactionHistory(
    address?: string,
    chainType?: ChainType,
    _limit = 10
  ): Promise<unknown[]> {
    const chain = chainType || this.activeChain;
    const provider = this.getProvider(chain);

    if (!provider) {
      throw new Error(`No provider for chain: ${chain}`);
    }

    // This would typically use an indexing service or block explorer API
    // For now, return empty array
    console.warn('Transaction history not yet implemented');
    return [];
  }

  /**
   * Enable privacy mode for supported chains
   * @param chainType
   */
  async enablePrivacyMode(chainType: ChainType): Promise<void> {
    const provider = this.getProvider(chainType);

    if (chainType === 'coti') {
      const cotiProvider = provider as LiveCOTIProvider;
      cotiProvider.setPrivacyMode(true);
    } else if (chainType === 'omnicoin') {
      const omniProvider = provider as LiveOmniCoinProvider;
      omniProvider.setPrivacyMode(true);
    } else {
      throw new Error(`Privacy mode not supported for chain: ${chainType}`);
    }
  }

  /**
   * Disable privacy mode
   * @param chainType
   */
  async disablePrivacyMode(chainType: ChainType): Promise<void> {
    const provider = this.getProvider(chainType);

    if (chainType === 'coti') {
      const cotiProvider = provider as LiveCOTIProvider;
      cotiProvider.setPrivacyMode(false);
    } else if (chainType === 'omnicoin') {
      const omniProvider = provider as LiveOmniCoinProvider;
      omniProvider.setPrivacyMode(false);
    }
  }

  /**
   * Get supported features for a chain
   * @param chainType
   */
  getChainFeatures(chainType: ChainType): ChainConfig['features'] {
    return SUPPORTED_CHAINS[chainType]?.features || {};
  }

  /**
   * Check if a feature is supported
   * @param chainType
   * @param feature
   */
  isFeatureSupported(chainType: ChainType, feature: keyof ChainConfig['features']): boolean {
    const features = this.getChainFeatures(chainType);
    return !!features[feature];
  }
}

// Export singleton instance
export const providerManager = ProviderManager.getInstance();
