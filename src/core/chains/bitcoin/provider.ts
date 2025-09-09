/**
 * Complete Bitcoin Provider Implementation
 * Supports real Bitcoin blockchain operations using bitcoinjs-lib and public APIs
 */

import { BaseProvider } from '../base-provider';
import { NetworkConfig, Transaction, TransactionRequest } from '../../../types';
import * as bitcoin from 'bitcoinjs-lib';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';

// Initialize ECC library for bitcoinjs-lib
// Modern versions of bitcoinjs-lib don't need initEccLib
// bitcoin.initEccLib(ecc);

// Initialize ECPair factory with ecc
const ECPair = ECPairFactory(ecc);

/** Bitcoin network configuration parameters */
export interface BitcoinNetwork {
  /** Message prefix for signed messages */
  messagePrefix: string;
  /** Bech32 address prefix */
  bech32: string;
  /** BIP32 extended key parameters */
  bip32: {
    /** Public key version */
    public: number;
    /** Private key version */
    private: number;
  };
  /** Public key hash version */
  pubKeyHash: number;
  /** Script hash version */
  scriptHash: number;
  /** Wallet Import Format version */
  wif: number;
}

/** Bitcoin network configuration with API endpoints */
export interface BitcoinNetworkConfig extends NetworkConfig {
  /** Bitcoin network parameters */
  network: BitcoinNetwork;
  /** API endpoint URL (Blockstream/Mempool API) */
  apiUrl: string;
  /** Block explorer URL */
  explorer: string;
  /** Minimum amount in satoshis to prevent dust */
  dust: number;
  /** Default fee rate in sat/vB */
  feeRate?: number;
}

/** Unspent Transaction Output */
export interface UTXO {
  /** Transaction ID containing this output */
  txid: string;
  /** Output index in the transaction */
  vout: number;
  /** Value in satoshis */
  value: number;
  /** Associated address */
  address: string;
  /** Number of confirmations */
  confirmations: number;
  /** Script type */
  scriptType?: string;
}

/** Address information from API */
interface AddressInfo {
  address: string;
  chain_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
  mempool_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
}

/** Bitcoin transaction from API */
interface BitcoinApiTransaction {
  txid: string;
  version: number;
  locktime: number;
  vin: Array<{
    txid: string;
    vout: number;
    prevout: {
      scriptpubkey: string;
      scriptpubkey_asm: string;
      scriptpubkey_type: string;
      scriptpubkey_address: string;
      value: number;
    };
    scriptsig: string;
    witness: string[];
    is_coinbase: boolean;
    sequence: number;
  }>;
  vout: Array<{
    scriptpubkey: string;
    scriptpubkey_asm: string;
    scriptpubkey_type: string;
    scriptpubkey_address?: string;
    value: number;
  }>;
  size: number;
  weight: number;
  fee: number;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
}

/**
 * Complete Bitcoin provider implementation with real blockchain APIs
 */
export class BitcoinProvider extends BaseProvider {
  private network: BitcoinNetwork;
  private apiUrl: string;
  private explorer: string;
  private dust: number;
  private defaultFeeRate: number;
  private bip32: ReturnType<typeof BIP32Factory>;

  /**
   * Create new Bitcoin provider instance
   * @param config Bitcoin network configuration
   */
  constructor(config: BitcoinNetworkConfig) {
    super(config);
    this.network = config.network;
    this.apiUrl = config.apiUrl;
    this.explorer = config.explorer;
    this.dust = config.dust ?? 546; // Standard dust limit
    this.defaultFeeRate = config.feeRate ?? 10; // Default 10 sat/vB
    this.bip32 = BIP32Factory(ecc);
  }

  /**
   * Generate Bitcoin address from seed and derivation path
   * @param seed Seed buffer or hex string
   * @param derivationPath HD derivation path
   * @returns Bitcoin account information with address, keys, and type
   */
  getAccount(seed: string, derivationPath = "m/84'/0'/0'/0/0"): {
    address: string;
    publicKey: string;
    addressType: 'P2WPKH' | 'P2PKH' | 'P2SH';
    privateKey: string;
  } {
    try {
      // Convert seed to buffer if it's a hex string
      const seedBuffer = Buffer.isBuffer(seed) ? seed : Buffer.from(seed, 'hex');
      
      // Create master node from seed
      const masterNode = this.bip32.fromSeed(seedBuffer, this.network);
      
      // Derive child node from path
      const childNode = masterNode.derivePath(derivationPath);
      
      // Determine address type based on derivation path
      let address: string;
      let addressType: 'P2WPKH' | 'P2PKH' | 'P2SH';
      
      if (derivationPath.startsWith("m/84'")) {
        // Native SegWit (P2WPKH) - Bech32
        const payment = bitcoin.payments.p2wpkh({ 
          pubkey: Buffer.from(childNode.publicKey), 
          network: this.network 
        });
        if (payment.address === undefined) {
          throw new Error('Failed to generate P2WPKH address');
        }
        address = payment.address;
        addressType = 'P2WPKH';
      } else if (derivationPath.startsWith("m/49'")) {
        // Nested SegWit (P2SH-P2WPKH)
        const payment = bitcoin.payments.p2sh({
          redeem: bitcoin.payments.p2wpkh({ 
            pubkey: Buffer.from(childNode.publicKey), 
            network: this.network 
          }),
          network: this.network
        });
        if (payment.address === undefined) {
          throw new Error('Failed to generate P2SH address');
        }
        address = payment.address;
        addressType = 'P2SH';
      } else {
        // Legacy (P2PKH)
        const payment = bitcoin.payments.p2pkh({ 
          pubkey: Buffer.from(childNode.publicKey), 
          network: this.network 
        });
        if (payment.address === undefined) {
          throw new Error('Failed to generate P2PKH address');
        }
        address = payment.address;
        addressType = 'P2PKH';
      }

      if (childNode.privateKey === undefined) {
        throw new Error('Failed to derive private key');
      }
      
      return {
        address,
        publicKey: Buffer.from(childNode.publicKey).toString('hex'),
        privateKey: childNode.privateKey !== undefined ? Buffer.from(childNode.privateKey).toString('hex') : '',
        addressType
      };
    } catch (error) {
      throw new Error(`Failed to generate Bitcoin account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get balance for a Bitcoin address using Blockstream API
   * @param address Bitcoin address
   * @returns Promise resolving to balance in satoshis as string
   */
  async getBalance(address: string): Promise<string> {
    try {
      const response = await fetch(`${this.apiUrl}/address/${address}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json() as AddressInfo;
      
      // Calculate total balance (confirmed + unconfirmed)
      const confirmedBalance = data.chain_stats?.funded_txo_sum ?? 0;
      const unconfirmedBalance = data.mempool_stats?.funded_txo_sum ?? 0;
      const totalSpent = (data.chain_stats?.spent_txo_sum ?? 0) + (data.mempool_stats?.spent_txo_sum ?? 0);
      
      const balance = confirmedBalance + unconfirmedBalance - totalSpent;
      return Math.max(0, balance).toString();
    } catch (error) {
      console.error('Error fetching Bitcoin balance:', error instanceof Error ? error.message : error);
      throw new Error(`Failed to fetch balance: ${error instanceof Error ? error.message : 'Network error'}`);
    }
  }

  /**
   * Get formatted balance in BTC
   * @param address Bitcoin address
   * @returns Promise resolving to formatted balance string with BTC suffix
   */
  async getFormattedBalance(address: string): Promise<string> {
    const balance = await this.getBalance(address);
    const btc = parseInt(balance) / 100000000; // Convert satoshis to BTC
    return btc.toFixed(8) + ' BTC';
  }

  /**
   * Get UTXOs for an address using Blockstream API
   * @param address Bitcoin address
   * @returns Promise resolving to array of UTXOs
   */
  async getUTXOs(address: string): Promise<UTXO[]> {
    try {
      const response = await fetch(`${this.apiUrl}/address/${address}/utxo`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const utxos = await response.json() as Array<{
        txid: string;
        vout: number;
        status: {
          confirmed: boolean;
          block_height?: number;
        };
        value: number;
      }>;

      return utxos.map(utxo => ({
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.value,
        address: address,
        confirmations: utxo.status.confirmed ? (utxo.status.block_height !== undefined ? 1 : 0) : 0
      }));
    } catch (error) {
      console.error('Error fetching UTXOs:', error);
      throw new Error(`Failed to fetch UTXOs: ${error instanceof Error ? error.message : 'Network error'}`);
    }
  }

  /**
   * Get current fee estimates from API
   * @returns Promise resolving to Map of block targets to fee rates in sat/vB
   */
  async getFeeEstimates(): Promise<Map<number, number>> {
    try {
      const response = await fetch(`${this.apiUrl}/fee-estimates`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const feeData = await response.json() as Record<string, number>;
      const feeMap = new Map<number, number>();
      
      Object.entries(feeData).forEach(([blocks, feeRate]) => {
        feeMap.set(parseInt(blocks), feeRate);
      });
      
      return feeMap;
    } catch (error) {
      console.warn('Error fetching fee estimates, using default:', error);
      // Return default fee estimates
      return new Map([
        [1, 20],   // Fast: 20 sat/vB
        [3, 15],   // Medium: 15 sat/vB  
        [6, 10],   // Slow: 10 sat/vB
      ]);
    }
  }

  /**
   * Estimate transaction fee based on inputs/outputs and fee rate
   * @param txRequest Transaction request
   * @returns Promise resolving to estimated fee in satoshis as string
   */
  async estimateFee(txRequest: TransactionRequest): Promise<string> {
    try {
      const amount = parseInt(txRequest.value ?? '0');
      const _toAddress = txRequest.to;
      
      // Get UTXOs to calculate input count
      // For estimation, we'll assume we need UTXOs from the sender
      // In practice, you'd get the sender's UTXOs
      const inputCount = 1;
      const _selectedValue = 0;
      
      // Simplified UTXO selection - in practice you'd implement coin selection
      // For now, estimate based on typical transaction sizes
      
      // Get current fee rate
      const feeEstimates = await this.getFeeEstimates();
      const feeRate = feeEstimates.get(1) ?? this.defaultFeeRate; // Use fast confirmation
      
      // Calculate transaction size
      // P2WPKH input: ~68 vBytes, P2WPKH output: ~31 vBytes, overhead: ~10 vBytes
      const inputSize = 68; // Average input size for P2WPKH
      const outputSize = 31; // Average output size for P2WPKH
      const outputs = amount > 0 ? 2 : 1; // Recipient + change (if needed)
      const overhead = 10;
      
      const estimatedSize = (inputCount * inputSize) + (outputs * outputSize) + overhead;
      const fee = Math.ceil(estimatedSize * feeRate);
      
      return fee.toString();
    } catch (error) {
      console.error('Error estimating fee:', error);
      return (this.defaultFeeRate * 200).toString(); // Default estimate
    }
  }

  /**
   * Build and sign a Bitcoin transaction
   * @param privateKey Private key in hex format
   * @param txRequest Transaction request
   * @returns Promise resolving to signed transaction hex string
   */
  async signTransaction(privateKey: string, txRequest: TransactionRequest): Promise<string> {
    try {
      const privateKeyBuffer = Buffer.from(privateKey, 'hex');
      const keyPair = ECPair.fromPrivateKey(privateKeyBuffer, { network: this.network });
      
      const amount = parseInt(txRequest.value ?? '0');
      const toAddress = txRequest.to;
      
      // Create payment object to get sender address
      const payment = bitcoin.payments.p2wpkh({ 
        pubkey: Buffer.from(keyPair.publicKey), 
        network: this.network 
      });
      if (payment.address === undefined) {
        throw new Error('Failed to generate sender address');
      }
      const fromAddress = payment.address;
      
      // Get UTXOs for the sender
      const utxos = await this.getUTXOs(fromAddress);
      if (utxos.length === 0) {
        throw new Error('No UTXOs available for transaction');
      }
      
      // Simple coin selection - select first UTXO with enough value
      const selectedUTXOs: UTXO[] = [];
      let totalSelected = 0;
      
      for (const utxo of utxos) {
        selectedUTXOs.push(utxo);
        totalSelected += utxo.value;
        if (totalSelected >= amount + 1000) { // Amount + estimated fee
          break;
        }
      }
      
      if (totalSelected < amount) {
        throw new Error('Insufficient funds');
      }
      
      // Build transaction
      const psbt = new bitcoin.Psbt({ network: this.network });
      
      // Add inputs
      for (const utxo of selectedUTXOs) {
        // Get previous transaction to get the output script
        const prevTxResponse = await fetch(`${this.apiUrl}/tx/${utxo.txid}`);
        const prevTx = await prevTxResponse.json() as BitcoinApiTransaction;
        const prevOutput = prevTx.vout[utxo.vout];
        
        if (prevOutput === undefined || prevOutput.scriptpubkey === undefined) {
          throw new Error(`Invalid UTXO: output not found at index ${utxo.vout}`);
        }
        
        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: Buffer.from(prevOutput.scriptpubkey, 'hex'),
            value: utxo.value,
          },
        });
      }
      
      // Add recipient output
      psbt.addOutput({
        address: toAddress,
        value: amount,
      });
      
      // Calculate fee and add change output if necessary
      const fee = parseInt(await this.estimateFee(txRequest));
      const change = totalSelected - amount - fee;
      
      if (change > this.dust) {
        psbt.addOutput({
          address: fromAddress,
          value: change,
        });
      }
      
      // Sign inputs - Create a compatible signer
      const signer = {
        publicKey: Buffer.from(keyPair.publicKey),
        sign: (hash: Buffer): Buffer => {
          const signature = keyPair.sign(hash);
          return Buffer.from(signature);
        }
      };
      
      for (let i = 0; i < selectedUTXOs.length; i++) {
        psbt.signInput(i, signer);
      }
      
      // Finalize and extract transaction
      psbt.finalizeAllInputs();
      const tx = psbt.extractTransaction();
      
      return tx.toHex();
    } catch (error) {
      throw new Error(`Failed to sign Bitcoin transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Broadcast a signed transaction to the Bitcoin network
   * @param signedTx Signed transaction in hex format
   * @returns Promise resolving to transaction ID
   */
  async sendTransaction(signedTx: string): Promise<string> {
    try {
      const response = await fetch(`${this.apiUrl}/tx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: signedTx,
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Broadcast failed: ${error}`);
      }
      
      const txid = await response.text();
      return txid.trim();
    } catch (error) {
      throw new Error(`Failed to broadcast Bitcoin transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get transaction details by hash
   * @param txHash Transaction hash
   * @returns Promise resolving to transaction details
   */
  async getTransaction(txHash: string): Promise<Transaction> {
    try {
      const response = await fetch(`${this.apiUrl}/tx/${txHash}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const tx = await response.json() as BitcoinApiTransaction;
      
      // Extract from/to addresses and values
      const from = tx.vin[0]?.prevout?.scriptpubkey_address ?? '';
      const to = tx.vout[0]?.scriptpubkey_address ?? '';
      const value = tx.vout[0]?.value?.toString() ?? '0';
      
      const transaction: Transaction = {
        hash: tx.txid,
        from,
        to,
        value,
        fee: tx.fee?.toString() ?? '0',
        status: tx.status.confirmed ? 'confirmed' as const : 'pending' as const
      };

      // Add optional properties only if they exist
      if (tx.status.block_height !== undefined) {
        transaction.blockNumber = tx.status.block_height;
      }
      if (tx.status.block_time !== undefined) {
        transaction.timestamp = tx.status.block_time;
      }

      return transaction;
    } catch (error) {
      throw new Error(`Failed to get Bitcoin transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get transaction history for an address
   * @param address Bitcoin address
   * @param limit Maximum number of transactions to return
   * @returns Promise resolving to array of transaction details
   */
  async getTransactionHistory(address: string, limit = 10): Promise<Transaction[]> {
    try {
      const response = await fetch(`${this.apiUrl}/address/${address}/txs`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const txs = await response.json() as BitcoinApiTransaction[];
      const limitedTxs = txs.slice(0, limit);

      return limitedTxs.map(tx => {
        const transaction: Transaction = {
          hash: tx.txid,
          from: tx.vin[0]?.prevout?.scriptpubkey_address ?? '',
          to: tx.vout[0]?.scriptpubkey_address ?? '',
          value: tx.vout[0]?.value?.toString() ?? '0',
          fee: tx.fee?.toString() ?? '0',
          status: tx.status.confirmed ? 'confirmed' as const : 'pending' as const
        };

        // Add optional properties only if they exist
        if (tx.status.block_height !== undefined) {
          transaction.blockNumber = tx.status.block_height;
        }
        if (tx.status.block_time !== undefined) {
          transaction.timestamp = tx.status.block_time;
        }

        return transaction;
      });
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      throw new Error(`Failed to get transaction history: ${error instanceof Error ? error.message : 'Network error'}`);
    }
  }

  /**
   * Subscribe to new blocks (polling-based for Bitcoin)
   * @param callback Callback function for new blocks
   * @returns Promise resolving to unsubscribe function
   */
  subscribeToBlocks(callback: (blockNumber: number) => void): Promise<() => void> {
    let isSubscribed = true;
    let lastBlock = 0;

    const checkNewBlock = async (): Promise<void> => {
      if (!isSubscribed) return;
      
      try {
        const response = await fetch(`${this.apiUrl}/blocks/tip/height`);
        if (!response.ok) return;
        
        const currentBlock = parseInt(await response.text());
        
        if (currentBlock > lastBlock) {
          lastBlock = currentBlock;
          callback(currentBlock);
        }
      } catch (error) {
        console.error('Error checking for new blocks:', error);
      }
      
      // Schedule next check
      if (isSubscribed) {
        setTimeout((): void => { void checkNewBlock(); }, 30000); // Check every 30 seconds
      }
    };

    // Start checking
    void checkNewBlock();

    // Return unsubscribe function
    return Promise.resolve(() => {
      isSubscribed = false;
    });
  }

  /**
   * Sign a message with Bitcoin private key
   * @param privateKey Private key in hex format
   * @param message Message to sign
   * @returns Promise resolving to signature as hex string
   */
  signMessage(privateKey: string, message: string): Promise<string> {
    try {
      const privateKeyBuffer = Buffer.from(privateKey, 'hex');
      const keyPair = ECPair.fromPrivateKey(privateKeyBuffer, { network: this.network });
      
      // Create message hash
      const messageBuffer = Buffer.from(message, 'utf8');
      const messageHash = bitcoin.crypto.sha256(messageBuffer);
      
      // Sign the hash  
      const signature = keyPair.sign(messageHash);
      
      return Promise.resolve(Buffer.from(signature).toString('hex'));
    } catch (error) {
      throw new Error(`Failed to sign message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get block explorer URL for a transaction
   * @param txHash Transaction hash
   * @returns Block explorer URL for transaction
   */
  getExplorerUrl(txHash: string): string {
    return `${this.explorer}/tx/${txHash}`;
  }

  /**
   * Get block explorer URL for an address
   * @param address Bitcoin address
   * @returns Block explorer URL for address
   */
  getAddressExplorerUrl(address: string): string {
    return `${this.explorer}/address/${address}`;
  }

  /**
   * Validate a Bitcoin address
   * @param address Address to validate
   * @returns True if address is valid, false otherwise
   */
  isValidAddress(address: string): boolean {
    try {
      bitcoin.address.toOutputScript(address, this.network);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Convert satoshis to BTC
   * @param satoshis Amount in satoshis
   * @returns Amount in BTC
   */
  satoshisToBTC(satoshis: number): number {
    return satoshis / 100000000;
  }

  /**
   * Convert BTC to satoshis
   * @param btc Amount in BTC
   * @returns Amount in satoshis
   */
  btcToSatoshis(btc: number): number {
    return Math.round(btc * 100000000);
  }

  /**
   * Get current block height
   * @returns Promise resolving to current block height
   */
  async getBlockHeight(): Promise<number> {
    try {
      const response = await fetch(`${this.apiUrl}/blocks/tip/height`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return parseInt(await response.text());
    } catch (error) {
      throw new Error(`Failed to get block height: ${error instanceof Error ? error.message : 'Network error'}`);
    }
  }

  /**
   * Get network info
   * @returns Network configuration information
   */
  getNetworkInfo(): {
    name: string;
    symbol: string;
    network: BitcoinNetwork;
    apiUrl: string;
    explorer: string;
  } {
    return {
      name: this.config.name,
      symbol: this.config.currency,
      network: this.network,
      apiUrl: this.apiUrl,
      explorer: this.explorer,
    };
  }
}