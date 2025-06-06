import { ethers } from 'ethers';
import { Transaction } from './Transaction';
import { SupportedAssets } from './assets';
import { getOmniCoinBalance, OmniCoinMetadata } from '../blockchain/OmniCoin';

export interface WalletConfig {
  network: string;
  rpcUrl: string;
  chainId: number;
}

export interface WalletState {
  address: string;
  balance: ethers.BigNumber;
  nonce: number;
  chainId: number;
}

export interface Wallet {
  // Core Wallet Functions
  getAddress(): Promise<string>;
  getBalance(): Promise<ethers.BigNumber>;
  getChainId(): Promise<number>;
  getProvider(): ethers.providers.Web3Provider;
  
  // Transaction Management
  sendTransaction(transaction: Transaction): Promise<ethers.providers.TransactionResponse>;
  signTransaction(transaction: Transaction): Promise<string>;
  signMessage(message: string): Promise<string>;
  
  // Token Management
  getTokenBalance(tokenAddress: string): Promise<ethers.BigNumber>;
  approveToken(tokenAddress: string, spender: string, amount: ethers.BigNumber): Promise<ethers.providers.TransactionResponse>;
  
  // Network Management
  switchNetwork(chainId: number): Promise<void>;
  addNetwork(config: WalletConfig): Promise<void>;
  
  // Event Handlers
  onAccountChange(callback: (address: string) => void): void;
  onNetworkChange(callback: (chainId: number) => void): void;
  onBalanceChange(callback: (balance: ethers.BigNumber) => void): void;
  
  // State Management
  getState(): Promise<WalletState>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  // New function for OmniCoin balance
  getBalance(assetSymbol: string): Promise<string>;
}

export class WalletError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'WalletError';
  }
}

export class WalletImpl implements Wallet {
  private provider: ethers.providers.Web3Provider;
  private signer: ethers.Signer;
  private state: WalletState | null = null;
  private accountChangeCallbacks: ((address: string) => void)[] = [];
  private networkChangeCallbacks: ((chainId: number) => void)[] = [];
  private balanceChangeCallbacks: ((balance: ethers.BigNumber) => void)[] = [];

  constructor(provider: ethers.providers.Web3Provider) {
    this.provider = provider;
    this.signer = provider.getSigner();
  }

  async connect(): Promise<void> {
    try {
      const address = await this.signer.getAddress();
      const balance = await this.provider.getBalance(address);
      const network = await this.provider.getNetwork();
      const nonce = await this.provider.getTransactionCount(address);

      this.state = {
        address,
        balance,
        nonce,
        chainId: network.chainId
      };

      // Set up event listeners
      this.provider.on('accountsChanged', this.handleAccountChange.bind(this));
      this.provider.on('chainChanged', this.handleNetworkChange.bind(this));
    } catch (error) {
      throw new WalletError('Failed to connect wallet', 'CONNECTION_ERROR');
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

  async getBalance(assetSymbol?: string): Promise<ethers.BigNumber> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');
    
    if (assetSymbol === 'OMNI') {
      const balance = await getOmniCoinBalance(this.state.address, this.provider);
      return ethers.BigNumber.from(balance);
    }
    
    return this.state.balance;
  }

  async getChainId(): Promise<number> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');
    return this.state.chainId;
  }

  async getProvider(): ethers.providers.Web3Provider {
    return this.provider;
  }

  async sendTransaction(transaction: Transaction): Promise<ethers.providers.TransactionResponse> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');
    
    try {
      const tx = await this.signer.sendTransaction(transaction.toEthersTransaction());
      this.state.nonce++;
      return tx;
    } catch (error) {
      throw new WalletError('Transaction failed', 'TX_ERROR');
    }
  }

  async signTransaction(transaction: Transaction): Promise<string> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');
    return this.signer.signTransaction(transaction.toEthersTransaction());
  }

  async signMessage(message: string): Promise<string> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');
    return this.signer.signMessage(message);
  }

  async getTokenBalance(tokenAddress: string): Promise<ethers.BigNumber> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');
    
    if (tokenAddress.toLowerCase() === OmniCoinMetadata.contractAddress.toLowerCase()) {
      return this.getBalance('OMNI');
    }
    
    const contract = new ethers.Contract(tokenAddress, ['function balanceOf(address) view returns (uint256)'], this.provider);
    return contract.balanceOf(this.state.address);
  }

  async approveToken(tokenAddress: string, spender: string, amount: ethers.BigNumber): Promise<ethers.providers.TransactionResponse> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');
    
    const contract = new ethers.Contract(tokenAddress, ['function approve(address,uint256)'], this.signer);
    return contract.approve(spender, amount);
  }

  async switchNetwork(chainId: number): Promise<void> {
    try {
      await this.provider.send('wallet_switchEthereumChain', [{ chainId: `0x${chainId.toString(16)}` }]);
    } catch (error) {
      throw new WalletError('Failed to switch network', 'NETWORK_ERROR');
    }
  }

  async addNetwork(config: WalletConfig): Promise<void> {
    try {
      await this.provider.send('wallet_addEthereumChain', [{
        chainId: `0x${config.chainId.toString(16)}`,
        chainName: config.network,
        rpcUrls: [config.rpcUrl]
      }]);
    } catch (error) {
      throw new WalletError('Failed to add network', 'NETWORK_ERROR');
    }
  }

  onAccountChange(callback: (address: string) => void): void {
    this.accountChangeCallbacks.push(callback);
  }

  onNetworkChange(callback: (chainId: number) => void): void {
    this.networkChangeCallbacks.push(callback);
  }

  onBalanceChange(callback: (balance: ethers.BigNumber) => void): void {
    this.balanceChangeCallbacks.push(callback);
  }

  async getState(): Promise<WalletState> {
    if (!this.state) throw new WalletError('Wallet not connected', 'NOT_CONNECTED');
    return { ...this.state };
  }

  private async handleAccountChange(accounts: string[]): Promise<void> {
    if (accounts.length === 0) {
      this.state = null;
    } else {
      await this.connect();
    }
    this.accountChangeCallbacks.forEach(cb => cb(accounts[0] || ''));
  }

  private async handleNetworkChange(chainId: string): Promise<void> {
    const newChainId = parseInt(chainId, 16);
    if (this.state) {
      this.state.chainId = newChainId;
    }
    this.networkChangeCallbacks.forEach(cb => cb(newChainId));
  }
}

// Helper function for OmniCoin transfers
export async function sendOmniCoin(wallet: Wallet, to: string, amount: string): Promise<ethers.providers.TransactionResponse> {
  const value = ethers.utils.parseUnits(amount, OmniCoinMetadata.decimals);
  const tx = Transaction.createTokenTransfer(
    OmniCoinMetadata.contractAddress,
    to,
    value
  );
  return wallet.sendTransaction(tx);
} 