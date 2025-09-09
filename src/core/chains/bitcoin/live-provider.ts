import { BitcoinProvider, UTXO } from './provider';
import BitcoinNetworks from './networks';
import { KeyringService } from '../../keyring/KeyringService';
import { TransactionRequest, Transaction } from '../../../types';

/**
 * Live Bitcoin provider implementation that extends BitcoinProvider
 * Manages Bitcoin transactions and account operations using a keyring service
 */
export class LiveBitcoinProvider extends BitcoinProvider {
  private keyring: KeyringService;
  private currentAddress: string | null = null;
  private derivationPath = "m/84'/0'/0'/0/0"; // Native SegWit by default

  /**
   * Create a new LiveBitcoinProvider instance
   * @param network - Bitcoin network type (mainnet or testnet)
   */
  constructor(network: 'mainnet' | 'testnet' = 'mainnet') {
    const config = network === 'mainnet' 
      ? BitcoinNetworks.mainnet 
      : BitcoinNetworks.testnet;
    
    super(config);
    this.keyring = KeyringService.getInstance();
  }

  /**
   * Set the derivation path for Bitcoin addresses
   * @param path - HD wallet derivation path
   */
  setDerivationPath(path: string): void {
    this.derivationPath = path;
  }

  /**
   * Derive and cache the current account/address from the keyring seed
   * @returns Promise resolving to account information
   */
  async getCurrentAccount(): Promise<{ address: string; publicKey: string; addressType: 'P2WPKH' | 'P2PKH' | 'P2SH' }> {
    // For now, use a default password - in production this should be properly handled
    const seed = await this.keyring.getSeed('');
    if (seed === null || seed === undefined) {
      throw new Error('No seed available in keyring');
    }

    const account = this.getAccount(seed, this.derivationPath);
    this.currentAddress = account.address;
    return account;
  }

  /**
   * Get balance for current account
   * @returns Promise resolving to balance in satoshis
   */
  override async getBalance(): Promise<string> {
    const { address } = await this.getCurrentAccount();
    return super.getBalance(address);
  }

  /**
   * Get formatted balance for current account
   * @returns Promise resolving to formatted balance string
   */
  override async getFormattedBalance(): Promise<string> {
    const { address } = await this.getCurrentAccount();
    return super.getFormattedBalance(address);
  }

  /**
   * Send Bitcoin transaction
   * @param to - Destination Bitcoin address
   * @param amount - Amount to send in satoshis
   * @returns Promise resolving to transaction hash
   */
  async sendBitcoin(to: string, amount: string): Promise<string> {
    const { address } = await this.getCurrentAccount();
    const seed = await this.keyring.getSeed('');
    
    if (seed === null || seed === undefined) {
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
   * Get transaction history for the current account or a supplied address
   * @param address - Bitcoin address to query (optional, uses current account if not provided)
   * @param limit - Maximum number of transactions to return
   * @returns Promise resolving to array of transactions
   */
  override async getTransactionHistory(address?: string, limit = 10): Promise<Transaction[]> {
    if (address === null || address === undefined || address === '') {
      const account = await this.getCurrentAccount();
      address = account.address;
    }
    return super.getTransactionHistory(address, limit);
  }

  /**
   * Sign a message with current account
   * @param message - Message to sign
   * @returns Promise resolving to message signature
   */
  override async signMessage(message: string): Promise<string> {
    const seed = await this.keyring.getSeed('');
    if (seed === null || seed === undefined) {
      throw new Error('No seed available for signing');
    }

    return super.signMessage(seed, message);
  }

  /**
   * Get multiple addresses for the wallet (for privacy)
   * @param count - Number of addresses to generate
   * @returns Promise resolving to array of Bitcoin addresses
   */
  async getAddresses(count = 10): Promise<string[]> {
    const seed = await this.keyring.getSeed('');
    if (seed === null || seed === undefined) {
      throw new Error('No seed available in keyring');
    }

    const addresses: string[] = [];
    for (let i = 0; i < count; i++) {
      const path = `m/84'/0'/0'/0/${i}`;
      const account = this.getAccount(seed, path);
      addresses.push(account.address);
    }

    return addresses;
  }

  /**
   * Import wallet from WIF (Wallet Import Format)
   * @param _wif - Wallet Import Format private key
   * @returns Promise resolving to imported address
   */
  importFromWIF(_wif: string): Promise<string> {
    // This would be implemented if we want to support importing Bitcoin private keys
    throw new Error('WIF import not yet implemented');
  }

  /**
   * Get the UTXO set for the current account
   * @returns Promise resolving to array of UTXOs
   */
  override async getUTXOs(): Promise<UTXO[]> {
    const { address } = await this.getCurrentAccount();
    return super.getUTXOs(address);
  }

  /**
   * Estimate fee for a transaction
   * @param to - Destination Bitcoin address
   * @param amount - Amount to send in satoshis
   * @returns Promise resolving to estimated fee in satoshis
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
   * @param index - Derivation path index
   * @returns Promise resolving to Bitcoin address
   */
  async getAddressAt(index: number): Promise<string> {
    const seed = await this.keyring.getSeed('');
    if (seed === null || seed === undefined) {
      throw new Error('No seed available in keyring');
    }

    const path = `m/84'/0'/0'/0/${index}`;
    const account = this.getAccount(seed, path);
    return account.address;
  }

  /**
   * Check if an address belongs to this wallet
   * @param address - Bitcoin address to check
   * @returns Promise resolving to true if address belongs to this wallet
   */
  async isOwnAddress(address: string): Promise<boolean> {
    const addresses = await this.getAddresses(100); // Check first 100 addresses
    return addresses.includes(address);
  }

  /**
   * Get explorer URL for current transaction
   * @param txHash - Transaction hash
   * @returns Block explorer URL for the transaction
   */
  override getExplorerUrl(txHash: string): string {
    return super.getExplorerUrl(txHash);
  }

  /**
   * Get explorer URL for current address
   * @returns Promise resolving to block explorer URL for current address
   */
  async getCurrentAddressExplorerUrl(): Promise<string> {
    const { address } = await this.getCurrentAccount();
    return super.getAddressExplorerUrl(address);
  }
}
