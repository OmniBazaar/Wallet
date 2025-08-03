import { BaseProvider } from '../base-provider';
import { NetworkConfig, Transaction, TransactionRequest } from '@/types';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { BIP32Factory } from 'bip32';
import axios from 'axios';

const ECPair = ECPairFactory(ecc);
const bip32 = BIP32Factory(ecc);

export interface BitcoinNetworkConfig extends NetworkConfig {
  network: bitcoin.Network;
  apiUrl: string;
  explorer: string;
  dust: number;
  feeRate?: number;
}

export interface UTXO {
  txid: string;
  vout: number;
  value: number;
  address: string;
  confirmations: number;
}

export class BitcoinProvider extends BaseProvider {
  private network: bitcoin.Network;
  private apiUrl: string;
  private explorer: string;
  private dust: number;

  constructor(config: BitcoinNetworkConfig) {
    super(config);
    this.network = config.network;
    this.apiUrl = config.apiUrl;
    this.explorer = config.explorer;
    this.dust = config.dust || 546; // Default dust limit in satoshis
  }

  /**
   * Get account from derivation path
   */
  async getAccount(privateKey: string, derivationPath: string = "m/84'/0'/0'/0/0"): Promise<{ address: string; publicKey: string }> {
    try {
      // Parse the master seed
      const seed = Buffer.from(privateKey, 'hex');
      const root = bip32.fromSeed(seed, this.network);
      
      // Derive the key
      const child = root.derivePath(derivationPath);
      
      // Get P2WPKH address (native segwit)
      const { address } = bitcoin.payments.p2wpkh({
        pubkey: child.publicKey,
        network: this.network
      });

      return {
        address: address!,
        publicKey: child.publicKey.toString('hex')
      };
    } catch (error) {
      throw new Error(`Failed to get Bitcoin account: ${error.message}`);
    }
  }

  /**
   * Get balance for an address
   */
  async getBalance(address: string): Promise<string> {
    try {
      const response = await axios.get(`${this.apiUrl}/address/${address}`);
      const balance = response.data.chain_stats.funded_txo_sum - response.data.chain_stats.spent_txo_sum;
      return balance.toString();
    } catch (error) {
      console.error('Error fetching Bitcoin balance:', error);
      return '0';
    }
  }

  /**
   * Get formatted balance in BTC
   */
  async getFormattedBalance(address: string): Promise<string> {
    const balance = await this.getBalance(address);
    return (parseInt(balance) / 100000000).toFixed(8); // Convert satoshis to BTC
  }

  /**
   * Get UTXOs for an address
   */
  async getUTXOs(address: string): Promise<UTXO[]> {
    try {
      const response = await axios.get(`${this.apiUrl}/address/${address}/utxo`);
      return response.data.map((utxo: any) => ({
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.value,
        address: address,
        confirmations: utxo.status.confirmed ? utxo.status.block_height : 0
      }));
    } catch (error) {
      console.error('Error fetching UTXOs:', error);
      return [];
    }
  }

  /**
   * Estimate transaction fee
   */
  async estimateFee(txRequest: TransactionRequest): Promise<string> {
    try {
      // Get current fee rates
      const feeResponse = await axios.get(`${this.apiUrl}/fee-estimates`);
      const feeRate = feeResponse.data['1'] || 10; // sat/vB
      
      // Estimate transaction size (simplified)
      // P2WPKH input: ~68 vBytes, P2WPKH output: ~31 vBytes
      const inputs = 1; // Simplified - would need to calculate based on amount
      const outputs = 2; // Recipient + change
      const estimatedSize = (inputs * 68) + (outputs * 31) + 10; // +10 for overhead
      
      const fee = Math.ceil(estimatedSize * feeRate);
      return fee.toString();
    } catch (error) {
      console.error('Error estimating fee:', error);
      return '1000'; // Default fee
    }
  }

  /**
   * Build and sign a transaction
   */
  async signTransaction(
    privateKey: string,
    txRequest: TransactionRequest
  ): Promise<string> {
    try {
      const seed = Buffer.from(privateKey, 'hex');
      const root = bip32.fromSeed(seed, this.network);
      const child = root.derivePath("m/84'/0'/0'/0/0");
      
      const keyPair = ECPair.fromPrivateKey(child.privateKey!);
      
      // Get UTXOs
      const utxos = await this.getUTXOs(txRequest.from);
      if (utxos.length === 0) {
        throw new Error('No UTXOs available');
      }

      // Build transaction
      const psbt = new bitcoin.Psbt({ network: this.network });
      
      let totalInput = 0;
      const amount = parseInt(txRequest.value);
      const fee = parseInt(await this.estimateFee(txRequest));
      
      // Add inputs
      for (const utxo of utxos) {
        if (totalInput >= amount + fee) break;
        
        // Fetch transaction hex
        const txResponse = await axios.get(`${this.apiUrl}/tx/${utxo.txid}/hex`);
        
        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: bitcoin.payments.p2wpkh({ 
              pubkey: child.publicKey,
              network: this.network 
            }).output!,
            value: utxo.value,
          },
        });
        
        totalInput += utxo.value;
      }

      if (totalInput < amount + fee) {
        throw new Error('Insufficient balance');
      }

      // Add outputs
      psbt.addOutput({
        address: txRequest.to,
        value: amount,
      });

      // Add change output if needed
      const change = totalInput - amount - fee;
      if (change > this.dust) {
        psbt.addOutput({
          address: txRequest.from,
          value: change,
        });
      }

      // Sign all inputs
      psbt.signAllInputs(keyPair);
      psbt.finalizeAllInputs();

      // Get the signed transaction hex
      return psbt.extractTransaction().toHex();
    } catch (error) {
      throw new Error(`Failed to sign Bitcoin transaction: ${error.message}`);
    }
  }

  /**
   * Send a signed transaction
   */
  async sendTransaction(signedTx: string): Promise<string> {
    try {
      const response = await axios.post(`${this.apiUrl}/tx`, signedTx);
      return response.data; // Returns transaction ID
    } catch (error) {
      throw new Error(`Failed to send Bitcoin transaction: ${error.message}`);
    }
  }

  /**
   * Get transaction by hash
   */
  async getTransaction(txHash: string): Promise<Transaction> {
    try {
      const response = await axios.get(`${this.apiUrl}/tx/${txHash}`);
      const tx = response.data;
      
      return {
        hash: tx.txid,
        from: tx.vin[0]?.prevout?.scriptpubkey_address || '',
        to: tx.vout[0]?.scriptpubkey_address || '',
        value: tx.vout[0]?.value?.toString() || '0',
        fee: tx.fee?.toString() || '0',
        blockNumber: tx.status.block_height,
        timestamp: tx.status.block_time,
        status: tx.status.confirmed ? 'confirmed' : 'pending'
      };
    } catch (error) {
      throw new Error(`Failed to get Bitcoin transaction: ${error.message}`);
    }
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(address: string, limit: number = 10): Promise<Transaction[]> {
    try {
      const response = await axios.get(`${this.apiUrl}/address/${address}/txs`);
      const txs = response.data.slice(0, limit);
      
      return txs.map((tx: any) => ({
        hash: tx.txid,
        from: tx.vin[0]?.prevout?.scriptpubkey_address || '',
        to: tx.vout[0]?.scriptpubkey_address || '',
        value: tx.vout[0]?.value?.toString() || '0',
        fee: tx.fee?.toString() || '0',
        blockNumber: tx.status.block_height,
        timestamp: tx.status.block_time,
        status: tx.status.confirmed ? 'confirmed' : 'pending'
      }));
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      return [];
    }
  }

  /**
   * Subscribe to new blocks (not real-time for Bitcoin)
   */
  async subscribeToBlocks(callback: (blockNumber: number) => void): Promise<() => void> {
    let intervalId: NodeJS.Timeout;
    let lastBlock = 0;

    const checkNewBlock = async () => {
      try {
        const response = await axios.get(`${this.apiUrl}/blocks/tip/height`);
        const currentBlock = parseInt(response.data);
        
        if (currentBlock > lastBlock) {
          lastBlock = currentBlock;
          callback(currentBlock);
        }
      } catch (error) {
        console.error('Error checking for new blocks:', error);
      }
    };

    // Check every 30 seconds
    intervalId = setInterval(checkNewBlock, 30000);
    checkNewBlock(); // Initial check

    // Return unsubscribe function
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }

  /**
   * Sign a message
   */
  async signMessage(privateKey: string, message: string): Promise<string> {
    try {
      const seed = Buffer.from(privateKey, 'hex');
      const root = bip32.fromSeed(seed, this.network);
      const child = root.derivePath("m/84'/0'/0'/0/0");
      
      const keyPair = ECPair.fromPrivateKey(child.privateKey!);
      
      const messagePrefix = '\x18Bitcoin Signed Message:\n';
      const messageBuffer = Buffer.from(message, 'utf8');
      const hash = bitcoin.crypto.hash256(
        Buffer.concat([
          Buffer.from(messagePrefix),
          Buffer.from(messageBuffer.length.toString()),
          messageBuffer
        ])
      );
      
      const signature = keyPair.sign(hash);
      return signature.toString('hex');
    } catch (error) {
      throw new Error(`Failed to sign message: ${error.message}`);
    }
  }

  /**
   * Get explorer URL for a transaction
   */
  getExplorerUrl(txHash: string): string {
    return `${this.explorer}/tx/${txHash}`;
  }

  /**
   * Get explorer URL for an address
   */
  getAddressExplorerUrl(address: string): string {
    return `${this.explorer}/address/${address}`;
  }
}