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
   * Get transaction details using Subscan API
   * @param txHash
   */
  async getTransaction(txHash: string): Promise<Transaction> {
    try {
      // Use Subscan API for transaction details
      const subscanUrl = this.getSubscanUrl();
      const response = await fetch(`${subscanUrl}/api/scan/extrinsic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.SUBSCAN_API_KEY || ''
        },
        body: JSON.stringify({
          hash: txHash
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as {
        data?: {
          extrinsic_hash: string;
          account_id: string;
          call_module: string;
          call_module_function: string;
          params?: Array<{ name: string; value: any }>;
          success: boolean;
          block_num: number;
          block_timestamp: number;
        };
      };

      if (!data.data) {
        throw new Error('Transaction not found');
      }

      const extrinsic = data.data;
      
      // Extract recipient from transfer parameters
      let to = '';
      let value = '0';
      
      if (extrinsic.call_module === 'balances' && extrinsic.call_module_function === 'transfer') {
        const params = extrinsic.params || [];
        const destParam = params.find(p => p.name === 'dest');
        const valueParam = params.find(p => p.name === 'value');
        
        if (destParam && destParam.value?.Id) {
          to = destParam.value.Id;
        }
        if (valueParam) {
          value = valueParam.value?.toString() || '0';
        }
      }

      return {
        hash: extrinsic.extrinsic_hash,
        from: extrinsic.account_id,
        to,
        value,
        blockNumber: extrinsic.block_num,
        timestamp: extrinsic.block_timestamp,
        status: extrinsic.success ? 'confirmed' : 'failed'
      };
    } catch (error) {
      console.error('Error fetching transaction:', error);
      // Fallback to basic structure
      return {
        hash: txHash,
        from: '',
        to: '',
        value: '0',
        status: 'pending'
      };
    }
  }

  /**
   * Get transaction history using Subscan API
   * @param address
   * @param limit
   */
  async getTransactionHistory(address: string, limit = 10): Promise<Transaction[]> {
    try {
      const subscanUrl = this.getSubscanUrl();
      const response = await fetch(`${subscanUrl}/api/scan/transfers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.SUBSCAN_API_KEY || ''
        },
        body: JSON.stringify({
          address,
          row: limit,
          page: 0
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as {
        data?: {
          transfers: Array<{
            hash: string;
            from: string;
            to: string;
            amount: string;
            success: boolean;
            block_num: number;
            block_timestamp: number;
          }>;
        };
      };

      if (!data.data) {
        return [];
      }

      return data.data.transfers.map(tx => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: tx.amount,
        blockNumber: tx.block_num,
        timestamp: tx.block_timestamp,
        status: tx.success ? 'confirmed' : 'failed'
      }));
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      return [];
    }
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
   * Get Subscan API URL based on network
   */
  private getSubscanUrl(): string {
    // Map network names to Subscan URLs
    const subscanUrls: Record<string, string> = {
      'polkadot': 'https://polkadot.api.subscan.io',
      'kusama': 'https://kusama.api.subscan.io',
      'westend': 'https://westend.api.subscan.io',
      'rococo': 'https://rococo.api.subscan.io'
    };

    const networkName = this.config.name.toLowerCase();
    return subscanUrls[networkName] || 'https://polkadot.api.subscan.io';
  }

  /**
   * Get network information
   */
  getNetworkInfo(): {
    name: string;
    currency: string;
    prefix: number;
    decimals: number;
    genesisHash: string;
    existentialDeposit: string;
    rpcUrl: string;
    subscanUrl: string;
  } {
    return {
      name: this.config.name,
      currency: this.config.currency,
      prefix: this.prefix,
      decimals: this.decimals,
      genesisHash: this.genesisHash,
      existentialDeposit: this.existentialDeposit,
      rpcUrl: this.config.rpcUrl,
      subscanUrl: this.getSubscanUrl()
    };
  }

  /**
   * Get account nonce
   * @param address
   */
  async getNonce(address: string): Promise<number> {
    const api = await this.ensureApi();
    const system = (api.query as any)['system'];
    const account = await system?.['account'](address);
    return account?.nonce?.toNumber() || 0;
  }

  /**
   * Estimate transaction fees
   * @param transaction
   */
  async estimateFee(transaction: TransactionRequest): Promise<string> {
    try {
      const api = await this.ensureApi();
      const transfer = (api.tx as any)['balances']?.['transfer'](transaction.to, transaction.value || '0');
      
      if (!transfer) {
        throw new Error('Failed to create transaction');
      }

      const info = await transfer.paymentInfo('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'); // Dummy address for fee estimation
      return info.partialFee.toString();
    } catch (error) {
      console.error('Error estimating fee:', error);
      return '0';
    }
  }

  /**
   * Check if address is valid for this network
   * @param address
   */
  isValidAddress(address: string): boolean {
    try {
      const decoded = decodeAddress(address);
      return decoded.length === 32;
    } catch (error) {
      return false;
    }
  }

  /**
   * Format balance with network decimals
   * @param amount
   */
  formatBalance(amount: string | number): string {
    const value = typeof amount === 'string' ? parseInt(amount) : amount;
    const formatted = value / Math.pow(10, this.decimals);
    return `${formatted.toFixed(4)} ${this.config.currency}`;
  }

  /**
   * Parse amount to smallest unit
   * @param amount
   */
  parseAmount(amount: string): string {
    const value = parseFloat(amount);
    return (value * Math.pow(10, this.decimals)).toString();
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
