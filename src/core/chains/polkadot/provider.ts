/**
 * Polkadot/Substrate Provider
 * Extracted and adapted from Enkrypt
 */

import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { hexToU8a, u8aToHex } from '@polkadot/util';
import { encodeAddress, decodeAddress } from '@polkadot/util-crypto';
import { BaseProvider } from '../base-provider';
import { NetworkConfig, Transaction, TransactionRequest } from '@/types';

export interface PolkadotNetworkConfig extends NetworkConfig {
  prefix: number;
  genesisHash: string;
  decimals: number;
  existentialDeposit: string;
}

export interface SubstrateTransaction {
  from: string;
  to: string;
  value: string;
  method: string;
  section: string;
  args: any[];
  era?: string;
  nonce?: number;
  tip?: string;
}

export class PolkadotProvider extends BaseProvider {
  protected api: ApiPromise | null = null;
  protected wsProvider: WsProvider;
  protected keyring: Keyring;
  protected prefix: number;
  protected genesisHash: string;
  protected decimals: number;
  protected existentialDeposit: string;

  constructor(config: PolkadotNetworkConfig) {
    super(config);
    this.prefix = config.prefix;
    this.genesisHash = config.genesisHash;
    this.decimals = config.decimals;
    this.existentialDeposit = config.existentialDeposit;
    this.wsProvider = new WsProvider(config.rpcUrl);
    this.keyring = new Keyring({ type: 'sr25519', ss58Format: this.prefix });
  }

  /**
   * Initialize the API connection
   */
  async init(): Promise<void> {
    if (!this.api) {
      this.api = await ApiPromise.create({ provider: this.wsProvider });
      await this.api.isReady;
    }
  }

  /**
   * Ensure API is initialized
   */
  protected async ensureApi(): Promise<ApiPromise> {
    if (!this.api) {
      await this.init();
    }
    return this.api!;
  }

  /**
   * Get account from private key
   */
  async getAccount(privateKey: string): Promise<{ address: string; publicKey: string }> {
    const keyPair = this.keyring.addFromUri(privateKey);
    return {
      address: keyPair.address,
      publicKey: u8aToHex(keyPair.publicKey)
    };
  }

  /**
   * Get balance for an address
   */
  async getBalance(address: string): Promise<string> {
    const api = await this.ensureApi();
    const { data: balance } = await api.query.system.account(address);
    return balance.free.toString();
  }

  /**
   * Get formatted balance
   */
  async getFormattedBalance(address: string): Promise<string> {
    const balance = await this.getBalance(address);
    const value = parseInt(balance) / Math.pow(10, this.decimals);
    return `${value.toFixed(4)} ${this.config.currency}`;
  }

  /**
   * Sign transaction
   */
  async signTransaction(privateKey: string, transaction: TransactionRequest): Promise<string> {
    const api = await this.ensureApi();
    const keyPair = this.keyring.addFromUri(privateKey);
    
    // Create the transfer
    const transfer = api.tx.balances.transfer(transaction.to, transaction.value || '0');
    
    // Sign the transaction
    const signedTx = await transfer.signAsync(keyPair);
    
    return signedTx.toHex();
  }

  /**
   * Send transaction
   */
  async sendTransaction(signedTransaction: string): Promise<string> {
    const api = await this.ensureApi();
    
    return new Promise((resolve, reject) => {
      api.rpc.author.submitExtrinsic(signedTransaction).subscribe({
        next: (result) => {
          if (result.isInBlock || result.isFinalized) {
            resolve(result.toString());
          }
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  }

  /**
   * Get transaction details
   */
  async getTransaction(txHash: string): Promise<Transaction> {
    const api = await this.ensureApi();
    
    // This would typically use Subscan API or similar
    // For now, return a basic structure
    return {
      hash: txHash,
      from: '',
      to: '',
      value: '0',
      status: 'confirmed'
    };
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(address: string, limit?: number): Promise<Transaction[]> {
    // This would typically use Subscan API or similar indexing service
    // For now, return empty array
    return [];
  }

  /**
   * Subscribe to new blocks
   */
  async subscribeToBlocks(callback: (blockNumber: number) => void): Promise<() => void> {
    const api = await this.ensureApi();
    
    const unsubscribe = await api.rpc.chain.subscribeNewHeads((header) => {
      callback(header.number.toNumber());
    });

    return () => {
      unsubscribe();
    };
  }

  /**
   * Sign message
   */
  async signMessage(privateKey: string, message: string): Promise<string> {
    const keyPair = this.keyring.addFromUri(privateKey);
    const signature = keyPair.sign(hexToU8a(message));
    return u8aToHex(signature);
  }

  /**
   * Encode address with network prefix
   */
  encodeAddress(address: string): string {
    return encodeAddress(decodeAddress(address), this.prefix);
  }

  /**
   * Get existential deposit
   */
  getExistentialDeposit(): string {
    return this.existentialDeposit;
  }

  /**
   * Disconnect from the network
   */
  async disconnect(): Promise<void> {
    if (this.api) {
      await this.api.disconnect();
      this.api = null;
    }
  }
}