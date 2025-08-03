import { BitcoinProvider, BitcoinNetworkConfig } from './provider';
import BitcoinNetworks from './networks';
import { KeyringService } from '../../keyring/KeyringService';
import { TransactionRequest } from '@/types';

export class LiveBitcoinProvider extends BitcoinProvider {
  private keyring: KeyringService;
  private currentAddress: string | null = null;
  private derivationPath: string = "m/84'/0'/0'/0/0"; // Native SegWit by default

  constructor(network: 'mainnet' | 'testnet' = 'mainnet') {
    const config = network === 'mainnet' 
      ? BitcoinNetworks.mainnet 
      : BitcoinNetworks.testnet;
    
    super(config);
    this.keyring = KeyringService.getInstance();
  }

  /**
   * Set the derivation path for Bitcoin addresses
   */
  setDerivationPath(path: string): void {
    this.derivationPath = path;
  }

  /**
   * Get current account from keyring
   */
  async getCurrentAccount(): Promise<{ address: string; publicKey: string }> {
    const seed = await this.keyring.getSeed();
    if (!seed) {
      throw new Error('No seed available in keyring');
    }

    const account = await this.getAccount(seed, this.derivationPath);
    this.currentAddress = account.address;
    return account;
  }

  /**
   * Get balance for current account
   */
  async getBalance(): Promise<string> {
    const { address } = await this.getCurrentAccount();
    return super.getBalance(address);
  }

  /**
   * Get formatted balance for current account
   */
  async getFormattedBalance(): Promise<string> {
    const { address } = await this.getCurrentAccount();
    return super.getFormattedBalance(address);
  }

  /**
   * Send Bitcoin transaction
   */
  async sendBitcoin(to: string, amount: string): Promise<string> {
    const { address } = await this.getCurrentAccount();
    const seed = await this.keyring.getSeed();
    
    if (!seed) {
      throw new Error('No seed available for signing');
    }

    const txRequest: TransactionRequest = {
      from: address,
      to,
      value: amount, // Amount in satoshis
      data: '',
    };

    // Sign transaction
    const signedTx = await this.signTransaction(seed, txRequest);
    
    // Send transaction
    return await this.sendTransaction(signedTx);
  }

  /**
   * Get transaction history for current account
   */
  async getTransactionHistory(limit: number = 10): Promise<any[]> {
    const { address } = await this.getCurrentAccount();
    return super.getTransactionHistory(address, limit);
  }

  /**
   * Sign a message with current account
   */
  async signMessage(message: string): Promise<string> {
    const seed = await this.keyring.getSeed();
    if (!seed) {
      throw new Error('No seed available for signing');
    }

    return super.signMessage(seed, message);
  }

  /**
   * Get multiple addresses for the wallet (for privacy)
   */
  async getAddresses(count: number = 10): Promise<string[]> {
    const seed = await this.keyring.getSeed();
    if (!seed) {
      throw new Error('No seed available in keyring');
    }

    const addresses: string[] = [];
    for (let i = 0; i < count; i++) {
      const path = `m/84'/0'/0'/0/${i}`;
      const account = await this.getAccount(seed, path);
      addresses.push(account.address);
    }

    return addresses;
  }

  /**
   * Import wallet from WIF (Wallet Import Format)
   */
  async importFromWIF(wif: string): Promise<string> {
    // This would be implemented if we want to support importing Bitcoin private keys
    throw new Error('WIF import not yet implemented');
  }

  /**
   * Get UTXO set for current account
   */
  async getUTXOs(): Promise<any[]> {
    const { address } = await this.getCurrentAccount();
    return super.getUTXOs(address);
  }

  /**
   * Estimate fee for a transaction
   */
  async estimateTransactionFee(to: string, amount: string): Promise<string> {
    const { address } = await this.getCurrentAccount();
    
    const txRequest: TransactionRequest = {
      from: address,
      to,
      value: amount,
      data: '',
    };

    return super.estimateFee(txRequest);
  }

  /**
   * Get address for a specific derivation index
   */
  async getAddressAt(index: number): Promise<string> {
    const seed = await this.keyring.getSeed();
    if (!seed) {
      throw new Error('No seed available in keyring');
    }

    const path = `m/84'/0'/0'/0/${index}`;
    const account = await this.getAccount(seed, path);
    return account.address;
  }

  /**
   * Check if an address belongs to this wallet
   */
  async isOwnAddress(address: string): Promise<boolean> {
    const addresses = await this.getAddresses(100); // Check first 100 addresses
    return addresses.includes(address);
  }

  /**
   * Get explorer URL for current transaction
   */
  getExplorerUrl(txHash: string): string {
    return super.getExplorerUrl(txHash);
  }

  /**
   * Get explorer URL for current address
   */
  async getCurrentAddressExplorerUrl(): Promise<string> {
    const { address } = await this.getCurrentAccount();
    return super.getAddressExplorerUrl(address);
  }
}