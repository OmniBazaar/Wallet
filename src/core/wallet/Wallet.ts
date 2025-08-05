import { BrowserProvider, TransactionResponse, Contract } from 'ethers';
import { Transaction } from './Transaction';
// import { SupportedAssets } from './assets'; // TODO: implement asset support
import { getOmniCoinBalance, OmniCoinMetadata } from '../blockchain/OmniCoin';

export interface WalletConfig {
  network: string;
  rpcUrl: string;
  chainId: number;
}

export interface WalletState {
  address: string;
  balance: bigint;
  nonce: number;
  chainId: number;
}

export interface GovernanceAction {
  target: string;
  value: bigint;
  data: string;
}

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

export class WalletError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'WalletError';
  }
}

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

  constructor(provider: BrowserProvider) {
    this.provider = provider;
  }

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

  async disconnect(): Promise<void> {
    this.state = null;
    this.provider.removeAllListeners();
  }

  async getAddress(): Promise<string> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');
    return this.state.address;
  }

  async getBalance(assetSymbol?: string): Promise<bigint | string> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');

    if (assetSymbol === 'OMNI') {
      const balance = await getOmniCoinBalance(this.state.address, this.provider);
      return balance;
    }

    return this.state.balance;
  }

  async getChainId(): Promise<number> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');
    return this.state.chainId;
  }

  getProvider(): BrowserProvider {
    return this.provider;
  }

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

  async signTransaction(transaction: Transaction): Promise<string> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');
    if (!this.signer) throw new WalletError('Signer not initialized', 'SIGNER_ERROR');
    const tx = transaction.toEthersTransaction();
    return this.signer.signTransaction(tx);
  }

  async signMessage(message: string): Promise<string> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');
    if (!this.signer) throw new WalletError('Signer not initialized', 'SIGNER_ERROR');
    return this.signer.signMessage(message);
  }

  async getTokenBalance(tokenAddress: string): Promise<bigint> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');

    if (tokenAddress.toLowerCase() === OmniCoinMetadata.contractAddress.toLowerCase()) {
      return this.getBalance('OMNI') as Promise<bigint>;
    }

    const contract = new Contract(tokenAddress, ['function balanceOf(address) view returns (uint256)'], this.provider);
    return contract.balanceOf(this.state.address);
  }

  async approveToken(tokenAddress: string, spender: string, amount: bigint): Promise<TransactionResponse> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');

    if (!this.signer) throw new WalletError('Signer not initialized', 'SIGNER_ERROR');
    const contract = new Contract(tokenAddress, ['function approve(address,uint256)'], this.signer);
    return contract.approve(spender, amount);
  }

  async switchNetwork(chainId: number): Promise<void> {
    try {
      await this.provider.send('wallet_switchEthereumChain', [{ chainId: `0x${chainId.toString(16)}` }]);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new WalletError(`Failed to switch network: ${errorMessage}`, 'NETWORK_ERROR');
    }
  }

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

  onAccountChange(callback: (address: string) => void): void {
    this.accountChangeCallbacks.push(callback);
  }

  onNetworkChange(callback: (chainId: number) => void): void {
    this.networkChangeCallbacks.push(callback);
  }

  onBalanceChange(callback: (balance: bigint) => void): void {
    this.balanceChangeCallbacks.push(callback);
  }

  async getState(): Promise<WalletState> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');
    return this.state;
  }

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

export async function sendOmniCoin(wallet: Wallet, to: string, amount: string): Promise<TransactionResponse> {
  const transaction = new Transaction({
    to: OmniCoinMetadata.contractAddress,
    value: 0n,
    data: `0x${Buffer.from(amount).toString('hex')}`
  });
  return wallet.sendTransaction(transaction);
} 