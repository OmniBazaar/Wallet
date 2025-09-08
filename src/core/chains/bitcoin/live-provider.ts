import { BitcoinProvider, UTXO } from './provider';
import BitcoinNetworks from './networks';
import { KeyringService } from '../../keyring/KeyringService';
import { TransactionRequest, Transaction } from '@/types';

/**
 *
 */
export class LiveBitcoinProvider extends BitcoinProvider {
  private keyring: KeyringService;
  private currentAddress: string | null = null;
  private derivationPath = "m/84'/0'/0'/0/0"; // Native SegWit by default

  /**
   *
   * @param network
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
   * @param path
   */
  setDerivationPath(path: string): void {
    this.derivationPath = path;
  }

  /** Derive and cache the current account/address from the keyring seed. */
  async getCurrentAccount(): Promise<{ address: string; publicKey: string; addressType: 'P2WPKH' | 'P2PKH' | 'P2SH' }> {
    // For now, use a default password - in production this should be properly handled
    const seed = await this.keyring.getSeed('');
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
  override async getBalance(): Promise<string> {
    const { address } = await this.getCurrentAccount();
    return super.getBalance(address);
  }

  /**
   * Get formatted balance for current account
   */
  override async getFormattedBalance(): Promise<string> {
    const { address } = await this.getCurrentAccount();
    return super.getFormattedBalance(address);
  }

  /**
   * Send Bitcoin transaction
   * @param to
   * @param amount
   */
  async sendBitcoin(to: string, amount: string): Promise<string> {
    const { address } = await this.getCurrentAccount();
    const seed = await this.keyring.getSeed('');
    
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
   * Get transaction history for the current account or a supplied address.
   * @param address
   * @param limit
   */
  override async getTransactionHistory(address?: string, limit = 10): Promise<Transaction[]> {
    if (!address) {
      const account = await this.getCurrentAccount();
      address = account.address;
    }
    return super.getTransactionHistory(address, limit);
  }

  /**
   * Sign a message with current account
   * @param message
   */
  override async signMessage(message: string): Promise<string> {
    const seed = await this.keyring.getSeed('');
    if (!seed) {
      throw new Error('No seed available for signing');
    }

    return super.signMessage(seed, message);
  }

  /**
   * Get multiple addresses for the wallet (for privacy)
   * @param count
   */
  async getAddresses(count = 10): Promise<string[]> {
    const seed = await this.keyring.getSeed('');
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
   * @param _wif
   */
  async importFromWIF(_wif: string): Promise<string> {
    // This would be implemented if we want to support importing Bitcoin private keys
    throw new Error('WIF import not yet implemented');
  }

  /** Get the UTXO set for the current account. */
  override async getUTXOs(): Promise<UTXO[]> {
    const { address } = await this.getCurrentAccount();
    return super.getUTXOs(address);
  }

  /**
   * Estimate fee for a transaction
   * @param to
   * @param amount
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
   * @param index
   */
  async getAddressAt(index: number): Promise<string> {
    const seed = await this.keyring.getSeed('');
    if (!seed) {
      throw new Error('No seed available in keyring');
    }

    const path = `m/84'/0'/0'/0/${index}`;
    const account = await this.getAccount(seed, path);
    return account.address;
  }

  /**
   * Check if an address belongs to this wallet
   * @param address
   */
  async isOwnAddress(address: string): Promise<boolean> {
    const addresses = await this.getAddresses(100); // Check first 100 addresses
    return addresses.includes(address);
  }

  /**
   * Get explorer URL for current transaction
   * @param txHash
   */
  override getExplorerUrl(txHash: string): string {
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
