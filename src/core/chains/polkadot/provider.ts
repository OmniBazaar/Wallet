/**
 * Polkadot/Substrate Provider
 * Extracted and adapted from Enkrypt
 */

import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { hexToU8a, u8aToHex } from '@polkadot/util';
import { encodeAddress, decodeAddress } from '@polkadot/util-crypto';
import { BaseProvider } from '../base-provider';
import { NetworkConfig, Transaction, TransactionRequest } from '../../../types';

/**
 * Configuration specific to Polkadot/Substrate networks extending base network config
 */
export interface PolkadotNetworkConfig extends NetworkConfig {
  /**
   * SS58 address format prefix for this network
   */
  prefix: number;
  /**
   * Genesis block hash identifying the specific network
   */
  genesisHash: string;
  /**
   * Number of decimal places for the native currency
   */
  decimals: number;
  /**
   * Minimum balance required to keep an account alive
   */
  existentialDeposit: string;
}

/**
 * Transaction structure for Substrate-based networks
 */
export interface SubstrateTransaction {
  /**
   * Transaction sender address
   */
  from: string;
  /**
   * Transaction recipient address
   */
  to: string;
  /**
   * Transaction value in smallest unit
   */
  value: string;
  /**
   * Transaction method name (e.g., 'transfer')
   */
  method: string;
  /**
   * Transaction pallet/module name (e.g., 'balances')
   */
  section: string;
  /**
   * Transaction arguments as an array of values
   */
  args: Array<unknown>;
  /**
   * Transaction validity period
   */
  era?: string;
  /**
   * Account nonce for transaction ordering
   */
  nonce?: number;
  /**
   * Optional tip to prioritize transaction
   */
  tip?: string;
}

/**
 * Provider implementation for Polkadot/Substrate network interactions
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
   * Initialize Polkadot provider with network configuration
   * @param config - Network-specific configuration including prefix, genesis hash, etc.
   */
  constructor(config: PolkadotNetworkConfig) {
    super(config);
    this.prefix = config.prefix;
    this.genesisHash = config.genesisHash;
    this.decimals = config.decimals;
    this.existentialDeposit = config.existentialDeposit;
    this.wsProvider = new WsProvider(this.config.rpcUrl);
    this.keyring = new Keyring({ type: 'sr25519', ss58Format: this.prefix });
  }

  /**
   * Initialize the API connection
   * @returns Promise that resolves when initialization is complete
   */
  async init(): Promise<void> {
    if (this.api === null) {
      this.api = await ApiPromise.create({ provider: this.wsProvider });
      await this.api.isReady;
    }
  }

  /**
   * Ensure API is initialized and available
   * @returns Initialized API instance
   */
  protected async ensureApi(): Promise<ApiPromise> {
    if (this.api === null) {
      await this.init();
    }
    if (this.api === null) throw new Error('Failed to initialize Polkadot API');
    return this.api;
  }

  /**
   * Get account from private key
   * @param privateKey - Private key or seed phrase
   * @returns Account address and public key
   */
  getAccount(privateKey: string): Promise<{ 
    /** Account address in SS58 format */
    address: string;
    /** Public key as hex string */
    publicKey: string;
  }> {
    const keyPair = this.keyring.addFromUri(privateKey);
    return Promise.resolve({
      address: keyPair.address,
      publicKey: u8aToHex(keyPair.publicKey)
    });
  }

  /**
   * Get balance for an address
   * @param address - Account address to check
   * @returns Balance as string in smallest unit
   */
  async getBalance(address: string): Promise<string> {
    const api = await this.ensureApi();
    const system = api.query.system as unknown as {
      account: (address: string) => Promise<{
        data?: { free: { toString: () => string } };
        free?: { toString: () => string };
      }>;
    };
    const account = await system.account(address);
    const free = account?.data?.free ?? account?.free;
    return free?.toString() ?? '0';
  }

  /**
   * Get formatted balance
   * @param address - Account address to check
   * @returns Formatted balance string with currency symbol
   */
  async getFormattedBalance(address: string): Promise<string> {
    const balance = await this.getBalance(address);
    const value = parseInt(balance) / Math.pow(10, this.decimals);
    return `${value.toFixed(4)} ${this.config.currency}`;
  }

  /**
   * Sign transaction
   * @param privateKey - Private key or seed phrase
   * @param transaction - Transaction request object
   * @returns Signed transaction as hex string
   */
  async signTransaction(privateKey: string, transaction: TransactionRequest): Promise<string> {
    const api = await this.ensureApi();
    const keyPair = this.keyring.addFromUri(privateKey);
    
    // Create the transfer
    const tx = api.tx as unknown as {
      balances: {
        transfer: (to: string, value: string) => {
          signAsync: (signer: unknown) => Promise<{ toHex: () => string }>;
        };
      };
    };
    const transfer = tx.balances.transfer(transaction.to, transaction.value ?? '0');
    
    // Sign the transaction
    const signedTx = await transfer.signAsync(keyPair);
    
    return signedTx.toHex();
  }

  /**
   * Send transaction
   * @param signedTransaction - Signed transaction as hex string
   * @returns Transaction hash
   */
  async sendTransaction(signedTransaction: string): Promise<string> {
    const api = await this.ensureApi();
    const hash = await api.rpc.author.submitExtrinsic(signedTransaction);
    return hash.toString();
  }

  /**
   * Get transaction details using Subscan API
   * @param txHash - Transaction hash to look up
   * @returns Transaction details
   */
  async getTransaction(txHash: string): Promise<Transaction> {
    try {
      // Use Subscan API for transaction details
      const subscanUrl = this.getSubscanUrl();
      const response = await fetch(`${subscanUrl}/api/scan/extrinsic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.SUBSCAN_API_KEY ?? ''
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
          params?: Array<{ name: string; value: unknown }>;
          success: boolean;
          block_num: number;
          block_timestamp: number;
        };
      };

      if (data.data === null || data.data === undefined) {
        throw new Error('Transaction not found');
      }

      const extrinsic = data.data;
      
      // Extract recipient from transfer parameters
      let to = '';
      let value = '0';
      
      if (extrinsic.call_module === 'balances' && extrinsic.call_module_function === 'transfer') {
        const params = extrinsic.params ?? [];
        const destParam = params.find(p => p.name === 'dest');
        const valueParam = params.find(p => p.name === 'value');
        
        if (destParam !== null && destParam !== undefined && typeof destParam.value === 'object' && destParam.value !== null && 'Id' in destParam.value) {
          to = String(destParam.value.Id);
        }
        if (valueParam !== undefined && valueParam.value !== null && valueParam.value !== undefined) {
          value = String(valueParam.value);
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
   * @param address - Address to get transaction history for
   * @param limit - Maximum number of transactions to return
   * @returns Array of transactions
   */
  async getTransactionHistory(address: string, limit = 10): Promise<Transaction[]> {
    try {
      const subscanUrl = this.getSubscanUrl();
      const response = await fetch(`${subscanUrl}/api/scan/transfers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.SUBSCAN_API_KEY ?? ''
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

      if (data.data === null || data.data === undefined) {
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
      return [];
    }
  }

  /**
   * Subscribe to new blocks
   * @param callback - Function called with each new block number
   * @returns Unsubscribe function
   */
  async subscribeToBlocks(callback: (blockNumber: number) => void): Promise<() => void> {
    const api = await this.ensureApi();
    
    const unsubscribe = await api.rpc.chain.subscribeNewHeads((header: { number: { toNumber: () => number } }) => {
      callback(header.number.toNumber());
    });

    return () => {
      unsubscribe();
    };
  }

  /**
   * Sign message
   * @param privateKey - Private key or seed phrase
   * @param message - Message to sign as hex string
   * @returns Signature as hex string
   */
  signMessage(privateKey: string, message: string): Promise<string> {
    const keyPair = this.keyring.addFromUri(privateKey);
    const signature = keyPair.sign(hexToU8a(message));
    return Promise.resolve(u8aToHex(signature));
  }

  /**
   * Encode address with network prefix
   * @param address - Address to encode
   * @returns Encoded address with network prefix
   */
  encodeAddress(address: string): string {
    return encodeAddress(decodeAddress(address), this.prefix);
  }

  /**
   * Get existential deposit
   * @returns Existential deposit amount as string
   */
  getExistentialDeposit(): string {
    return this.existentialDeposit;
  }

  /**
   * Get Subscan API URL based on network
   * @returns Subscan API URL for the current network
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
    return subscanUrls[networkName] ?? 'https://polkadot.api.subscan.io';
  }

  /**
   * Get network information
   * @returns Network configuration details
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
   * @param address - Account address
   * @returns Account nonce number
   */
  async getNonce(address: string): Promise<number> {
    const api = await this.ensureApi();
    const system = api.query.system as unknown as {
      account: (address: string) => Promise<{
        nonce?: { toNumber: () => number };
      }>;
    };
    const account = await system.account(address);
    return account?.nonce?.toNumber() ?? 0;
  }

  /**
   * Estimate transaction fees
   * @param transaction - Transaction request to estimate fees for
   * @returns Fee estimate as string in smallest unit
   */
  async estimateFee(transaction: TransactionRequest): Promise<string> {
    try {
      const api = await this.ensureApi();
      const tx = api.tx as unknown as {
        balances: {
          transfer: (to: string, value: string) => {
            paymentInfo: (address: string) => Promise<{
              partialFee: { toString: () => string };
            }>;
          };
        };
      };
      const transfer = tx.balances.transfer(transaction.to, transaction.value ?? '0');
      
      const info = await transfer.paymentInfo('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'); // Dummy address for fee estimation
      return info.partialFee.toString();
    } catch (error) {
      return '0';
    }
  }

  /**
   * Check if address is valid for this network
   * @param address - Address to validate
   * @returns True if address is valid
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
   * @param amount - Amount in smallest unit
   * @returns Formatted balance string with currency
   */
  formatBalance(amount: string | number): string {
    const value = typeof amount === 'string' ? parseInt(amount) : amount;
    const formatted = value / Math.pow(10, this.decimals);
    return `${formatted.toFixed(4)} ${this.config.currency}`;
  }

  /**
   * Parse amount to smallest unit
   * @param amount - Human-readable amount
   * @returns Amount in smallest unit as string
   */
  parseAmount(amount: string): string {
    const value = parseFloat(amount);
    return (value * Math.pow(10, this.decimals)).toString();
  }

  /**
   * Disconnect from the network
   * @returns Promise that resolves when disconnected
   */
  async disconnect(): Promise<void> {
    if (this.api !== null) {
      await this.api.disconnect();
      this.api = null;
    }
  }
}
