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

/**
 *
 */
export interface PolkadotNetworkConfig extends NetworkConfig {
  /**
   *
   */
  prefix: number;
  /**
   *
   */
  genesisHash: string;
  /**
   *
   */
  decimals: number;
  /**
   *
   */
  existentialDeposit: string;
}

/**
 *
 */
export interface SubstrateTransaction {
  /**
   *
   */
  from: string;
  /**
   *
   */
  to: string;
  /**
   *
   */
  value: string;
  /**
   *
   */
  method: string;
  /**
   *
   */
  section: string;
  /**
   *
   */
  args: Array<unknown>;
  /**
   *
   */
  era?: string;
  /**
   *
   */
  nonce?: number;
  /**
   *
   */
  tip?: string;
}

/**
 *
 */
export class PolkadotProvider extends BaseProvider {
  protected api: ApiPromise | null = null;
  protected wsProvider: WsProvider;
  protected keyring: Keyring;
  protected prefix: number;
  protected genesisHash: string;
  protected decimals: number;
  protected existentialDeposit: string;

  /**
   *
   * @param config
   */
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
    if (!this.api) throw new Error('Failed to initialize Polkadot API');
    return this.api;
  }

  /**
   * Get account from private key
   * @param privateKey
   */
  async getAccount(privateKey: string): Promise<{ /**
                                                   *
                                                   */
  address: string; /**
                    *
                    */
  publicKey: string }> {
    const keyPair = this.keyring.addFromUri(privateKey);
    return {
      address: keyPair.address,
      publicKey: u8aToHex(keyPair.publicKey)
    };
  }

  /**
   * Get balance for an address
   * @param address
   */
  async getBalance(address: string): Promise<string> {
    const api = await this.ensureApi();
    const system = (api.query as any)['system'];
    const account = await system?.['account'](address);
    const free = account?.data?.free ?? account?.free;
    return free?.toString?.() ?? '0';
  }

  /**
   * Get formatted balance
   * @param address
   */
  async getFormattedBalance(address: string): Promise<string> {
    const balance = await this.getBalance(address);
    const value = parseInt(balance) / Math.pow(10, this.decimals);
    return `${value.toFixed(4)} ${this.config.currency}`;
  }

  /**
   * Sign transaction
   * @param privateKey
   * @param transaction
   */
  async signTransaction(privateKey: string, transaction: TransactionRequest): Promise<string> {
    const api = await this.ensureApi();
    const keyPair = this.keyring.addFromUri(privateKey);
    
    // Create the transfer
    const transfer = (api.tx as any)['balances']?.['transfer'](transaction.to, transaction.value || '0');
    
    // Sign the transaction
    const signedTx = await transfer.signAsync(keyPair);
    
    return signedTx.toHex();
  }

  /**
   * Send transaction
   * @param signedTransaction
   */
  async sendTransaction(signedTransaction: string): Promise<string> {
    const api = await this.ensureApi();
    const hash = await api.rpc.author.submitExtrinsic(signedTransaction as any);
    return hash.toString();
  }

  /**
   * Get transaction details
   * @param txHash
   */
  async getTransaction(txHash: string): Promise<Transaction> {
    const _api = await this.ensureApi();
    
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
   * @param _address
   * @param _limit
   */
  async getTransactionHistory(_address: string, _limit?: number): Promise<Transaction[]> {
    // This would typically use Subscan API or similar indexing service
    // For now, return empty array
    return [];
  }

  /**
   * Subscribe to new blocks
   * @param callback
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
   * @param privateKey
   * @param message
   */
  async signMessage(privateKey: string, message: string): Promise<string> {
    const keyPair = this.keyring.addFromUri(privateKey);
    const signature = keyPair.sign(hexToU8a(message));
    return u8aToHex(signature);
  }

  /**
   * Encode address with network prefix
   * @param address
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
