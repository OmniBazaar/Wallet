import { BrowserProvider, TransactionResponse, Contract } from 'ethers';
import { Transaction } from './Transaction';
// import { SupportedAssets } from './assets'; // TODO: implement asset support
import { getOmniCoinBalance, OmniCoinMetadata } from '../blockchain/OmniCoin';

/**
 * Configuration parameters for wallet network setup
 */
export interface WalletConfig {
  network: string;
  rpcUrl: string;
  chainId: number;
}

/**
 * Current state of the wallet including address and balances
 */
export interface WalletState {
  address: string;
  balance: bigint;
  nonce: number;
  chainId: number;
}

/**
 * Represents an action in a governance proposal
 */
export interface GovernanceAction {
  target: string;
  value: bigint;
  data: string;
}

/**
 * Main wallet interface defining all wallet operations
 * Supports multi-chain functionality and OmniCoin-specific features
 */
export interface Wallet {
  // Core Wallet Functions
  getAddress(): Promise<string>;
  getBalance(assetSymbol?: string): Promise<bigint | string>;
  getChainId(): Promise<number>;
  getProvider(): BrowserProvider;

  // Transaction Management
  sendTransaction(transaction: Transaction): Promise<TransactionResponse>;
  signTransaction(transaction: Transaction): Promise<string>;
  signMessage(message: string): Promise<string>;

  // Token Management
  getTokenBalance(tokenAddress: string): Promise<bigint>;
  approveToken(tokenAddress: string, spender: string, amount: bigint): Promise<TransactionResponse>;

  // Network Management
  switchNetwork(chainId: number): Promise<void>;
  addNetwork(config: WalletConfig): Promise<void>;

  // Event Handlers
  onAccountChange(callback: (address: string) => void): void;
  onNetworkChange(callback: (chainId: number) => void): void;
  onBalanceChange(callback: (balance: bigint) => void): void;

  // State Management
  getState(): Promise<WalletState>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  // Advanced OmniCoin Features
  stakeOmniCoin(amount: bigint): Promise<TransactionResponse>;
  unstakeOmniCoin(amount: bigint): Promise<TransactionResponse>;
  getStakedBalance(): Promise<bigint>;
  createPrivacyAccount(): Promise<TransactionResponse>;
  closePrivacyAccount(): Promise<TransactionResponse>;
  getPrivacyBalance(): Promise<bigint>;
  proposeGovernanceAction(description: string, actions: GovernanceAction[]): Promise<TransactionResponse>;
  voteOnProposal(proposalId: number, support: boolean): Promise<TransactionResponse>;
}

/**
 * Custom error class for wallet operations
 */
export class WalletError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'WalletError';
  }
}

/**
 * Main implementation of the Wallet interface
 * Provides full wallet functionality for the OmniBazaar ecosystem
 */
export class WalletImpl implements Wallet {
  private provider: BrowserProvider;
  private signer: { 
    sendTransaction: (transaction: { to?: string; value?: bigint; data?: string; gasLimit?: bigint; gasPrice?: bigint }) => Promise<TransactionResponse>; 
    getAddress: () => Promise<string>;
    signTransaction: (transaction: { to?: string; value?: bigint; data?: string; gasLimit?: bigint; gasPrice?: bigint }) => Promise<string>;
    signMessage: (message: string) => Promise<string>;
  } | null = null;
  private state: WalletState | null = null;
  private accountChangeCallbacks: ((address: string) => void)[] = [];
  private networkChangeCallbacks: ((chainId: number) => void)[] = [];
  private balanceChangeCallbacks: ((balance: bigint) => void)[] = [];

  /**
   * Creates a new WalletImpl instance
   * @param provider - Ethereum browser provider for blockchain interactions
   */
  constructor(provider: BrowserProvider) {
    this.provider = provider;
  }

  /**
   * Connects the wallet and initializes state
   * @throws {WalletError} When connection fails or signer is not initialized
   */
  async connect(): Promise<void> {
    try {
      if (!this.signer) {
        throw new WalletError('Signer not initialized', 'SIGNER_ERROR');
      }
      const address = await this.signer.getAddress();
      const balance = await this.provider.getBalance(address);
      const network = await this.provider.getNetwork();
      const nonce = await this.provider.getTransactionCount(address);

      this.state = {
        address,
        balance,
        nonce,
        chainId: Number(network.chainId)
      };

      // Set up event listeners
      this.provider.on('accountsChanged', this.handleAccountChange.bind(this));
      this.provider.on('chainChanged', this.handleNetworkChange.bind(this));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new WalletError(`Failed to connect wallet: ${errorMessage}`, 'CONNECTION_ERROR');
    }
  }

  /**
   * Disconnects the wallet and cleans up event listeners
   */
  async disconnect(): Promise<void> {
    this.state = null;
    this.provider.removeAllListeners();
  }

  /**
   * Gets the current wallet address
   * @returns The wallet address
   * @throws {WalletError} When wallet is not connected
   */
  async getAddress(): Promise<string> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');
    return this.state.address;
  }

  /**
   * Gets the balance for the specified asset or native currency
   * @param assetSymbol - Optional asset symbol (e.g., 'OMNI' for OmniCoin)
   * @returns Balance as bigint for native currency or string for tokens
   * @throws {WalletError} When wallet is not connected
   */
  async getBalance(assetSymbol?: string): Promise<bigint | string> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');

    if (assetSymbol === 'OMNI') {
      const balance = await getOmniCoinBalance(this.state.address, this.provider);
      return balance;
    }

    return this.state.balance;
  }

  /**
   * Gets the current chain ID
   * @returns The chain ID as a number
   * @throws {WalletError} When wallet is not connected
   */
  async getChainId(): Promise<number> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');
    return this.state.chainId;
  }

  /**
   * Gets the underlying Ethereum provider
   * @returns The browser provider instance
   */
  getProvider(): BrowserProvider {
    return this.provider;
  }

  /**
   * Sends a transaction using the wallet
   * @param transaction - Transaction object to send
   * @returns Promise resolving to transaction response
   * @throws {WalletError} When wallet is not connected, signer not initialized, or transaction fails
   */
  async sendTransaction(transaction: Transaction): Promise<TransactionResponse> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');
    if (!this.signer) throw new WalletError('Signer not initialized', 'SIGNER_ERROR');

    try {
      const tx = await this.signer.sendTransaction(transaction.toEthersTransaction());
      this.state.nonce++;
      return tx;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new WalletError(`Transaction failed: ${errorMessage}`, 'TX_ERROR');
    }
  }

  /**
   * Signs a transaction without sending it
   * @param transaction - Transaction to sign
   * @returns Promise resolving to signed transaction hex string
   * @throws {WalletError} When wallet is not connected or signer not initialized
   */
  async signTransaction(transaction: Transaction): Promise<string> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');
    if (!this.signer) throw new WalletError('Signer not initialized', 'SIGNER_ERROR');
    const tx = transaction.toEthersTransaction();
    return this.signer.signTransaction(tx);
  }

  /**
   * Signs a message using the wallet
   * @param message - Message to sign
   * @returns Promise resolving to signature
   * @throws {WalletError} When wallet is not connected or signer not initialized
   */
  async signMessage(message: string): Promise<string> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');
    if (!this.signer) throw new WalletError('Signer not initialized', 'SIGNER_ERROR');
    return this.signer.signMessage(message);
  }

  /**
   * Gets the balance of a specific ERC-20 token
   * @param tokenAddress - Contract address of the token
   * @returns Promise resolving to token balance
   * @throws {WalletError} When wallet is not connected
   */
  async getTokenBalance(tokenAddress: string): Promise<bigint> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');

    if (tokenAddress.toLowerCase() === OmniCoinMetadata.contractAddress.toLowerCase()) {
      return this.getBalance('OMNI') as Promise<bigint>;
    }

    const contract = new Contract(tokenAddress, ['function balanceOf(address) view returns (uint256)'], this.provider);
    return contract.balanceOf(this.state.address);
  }

  /**
   * Approves a spender to use tokens on behalf of the wallet
   * @param tokenAddress - Contract address of the token
   * @param spender - Address that will be approved to spend tokens
   * @param amount - Amount of tokens to approve
   * @returns Promise resolving to transaction response
   * @throws {WalletError} When wallet is not connected or signer not initialized
   */
  async approveToken(tokenAddress: string, spender: string, amount: bigint): Promise<TransactionResponse> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');

    if (!this.signer) throw new WalletError('Signer not initialized', 'SIGNER_ERROR');
    const contract = new Contract(tokenAddress, ['function approve(address,uint256)'], this.signer);
    return contract.approve(spender, amount);
  }

  /**
   * Switches to a different blockchain network
   * @param chainId - Target chain ID
   * @throws {WalletError} When network switch fails
   */
  async switchNetwork(chainId: number): Promise<void> {
    try {
      await this.provider.send('wallet_switchEthereumChain', [{ chainId: `0x${chainId.toString(16)}` }]);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new WalletError(`Failed to switch network: ${errorMessage}`, 'NETWORK_ERROR');
    }
  }

  /**
   * Adds a new network to the wallet
   * @param config - Network configuration
   * @throws {WalletError} When network addition fails
   */
  async addNetwork(config: WalletConfig): Promise<void> {
    try {
      await this.provider.send('wallet_addEthereumChain', [{
        chainId: `0x${config.chainId.toString(16)}`,
        chainName: config.network,
        rpcUrls: [config.rpcUrl]
      }]);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new WalletError(`Failed to add network: ${errorMessage}`, 'NETWORK_ERROR');
    }
  }

  /**
   * Registers a callback for account change events
   * @param callback - Function to call when account changes
   */
  onAccountChange(callback: (address: string) => void): void {
    this.accountChangeCallbacks.push(callback);
  }

  /**
   * Registers a callback for network change events
   * @param callback - Function to call when network changes
   */
  onNetworkChange(callback: (chainId: number) => void): void {
    this.networkChangeCallbacks.push(callback);
  }

  /**
   * Registers a callback for balance change events
   * @param callback - Function to call when balance changes
   */
  onBalanceChange(callback: (balance: bigint) => void): void {
    this.balanceChangeCallbacks.push(callback);
  }

  /**
   * Gets the current wallet state
   * @returns Promise resolving to wallet state
   * @throws {WalletError} When wallet is not connected
   */
  async getState(): Promise<WalletState> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');
    return this.state;
  }

  /**
   * Handles account change events from the provider
   * @param accounts - Array of available accounts
   */
  private async handleAccountChange(accounts: string[]): Promise<void> {
    if (accounts.length === 0) {
      this.state = null;
    } else {
      const address = accounts[0];
      const balance = await this.provider.getBalance(address);
      const nonce = await this.provider.getTransactionCount(address);
      if (!this.state) throw new Error('Wallet state not initialized');
      this.state = { ...this.state, address, balance, nonce };
    }
    this.accountChangeCallbacks.forEach(callback => callback(accounts[0] || ''));
  }

  /**
   * Handles network change events from the provider
   * @param chainId - New chain ID in hex format
   */
  private async handleNetworkChange(chainId: string): Promise<void> {
    const newChainId = parseInt(chainId, 16);
    if (!this.state) throw new Error('Wallet state not initialized');
    this.state = { ...this.state, chainId: newChainId };
    this.networkChangeCallbacks.forEach(callback => callback(newChainId));
  }

  async stakeOmniCoin(_amount: bigint): Promise<TransactionResponse> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');
    // Implementation for staking OmniCoin
    throw new Error('Not implemented');
  }

  async unstakeOmniCoin(_amount: bigint): Promise<TransactionResponse> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');
    // Implementation for unstaking OmniCoin
    throw new Error('Not implemented');
  }

  async getStakedBalance(): Promise<bigint> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');
    // Implementation for getting staked balance
    throw new Error('Not implemented');
  }

  async createPrivacyAccount(): Promise<TransactionResponse> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');
    // Implementation for creating privacy account
    throw new Error('Not implemented');
  }

  async closePrivacyAccount(): Promise<TransactionResponse> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');
    // Implementation for closing privacy account
    throw new Error('Not implemented');
  }

  async getPrivacyBalance(): Promise<bigint> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');
    // Implementation for getting privacy balance
    throw new Error('Not implemented');
  }

  async proposeGovernanceAction(_description: string, _actions: GovernanceAction[]): Promise<TransactionResponse> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');
    // Implementation for proposing governance action
    throw new Error('Not implemented');
  }

  async voteOnProposal(_proposalId: number, _support: boolean): Promise<TransactionResponse> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');
    // Implementation for voting on proposal
    throw new Error('Not implemented');
  }
}

/**
 * Utility function to send OmniCoin to another address
 * @param wallet - Wallet instance to use for sending
 * @param to - Recipient address
 * @param amount - Amount to send as string
 * @returns Promise resolving to transaction response
 */
export async function sendOmniCoin(wallet: Wallet, to: string, amount: string): Promise<TransactionResponse> {
  const transaction = new Transaction({
    to: OmniCoinMetadata.contractAddress,
    value: 0n,
    data: `0x${Buffer.from(amount).toString('hex')}`
  });
  return wallet.sendTransaction(transaction);
} 