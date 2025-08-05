/**
 * Solana Provider
 * Full Solana ecosystem support including SPL tokens and NFTs
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  Keypair,
  ParsedAccountData,
  TokenAccountBalancePair,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
} from '@solana/spl-token';
import { BaseProvider } from '../base-provider';
import { NetworkConfig, Transaction as BaseTransaction, TransactionRequest } from '@/types';
import bs58 from 'bs58';

export interface SolanaNetworkConfig extends NetworkConfig {
  commitment?: 'processed' | 'confirmed' | 'finalized';
  wsUrl?: string;
}

export interface SolanaTransaction extends TransactionRequest {
  instructions?: { programId: string; keys: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>; data: string }[];
  feePayer?: string;
  recentBlockhash?: string;
  signatures?: string[];
}

export interface SPLToken {
  mint: string;
  address: string;
  amount: string;
  decimals: number;
  symbol?: string;
  name?: string;
  logoURI?: string;
}

export class SolanaProvider extends BaseProvider {
  protected connection: Connection;
  protected commitment: 'processed' | 'confirmed' | 'finalized';

  constructor(config: SolanaNetworkConfig) {
    super(config);
    this.commitment = config.commitment || 'confirmed';
    this.connection = new Connection(config.rpcUrl, {
      commitment: this.commitment,
      wsEndpoint: config.wsUrl,
    });
  }

  /**
   * Get account from private key
   */
  async getAccount(privateKey: string): Promise<{ address: string; publicKey: string }> {
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    return {
      address: keypair.publicKey.toBase58(),
      publicKey: keypair.publicKey.toBase58()
    };
  }

  /**
   * Get SOL balance
   */
  async getBalance(address: string): Promise<string> {
    const publicKey = new PublicKey(address);
    const balance = await this.connection.getBalance(publicKey);
    return balance.toString();
  }

  /**
   * Get formatted balance in SOL
   */
  async getFormattedBalance(address: string): Promise<string> {
    const balance = await this.getBalance(address);
    const sol = parseInt(balance) / LAMPORTS_PER_SOL;
    return `${sol.toFixed(9)} SOL`;
  }

  /**
   * Get SPL token balances
   */
  async getTokenBalances(address: string): Promise<SPLToken[]> {
    const publicKey = new PublicKey(address);
    const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
      publicKey,
      { programId: TOKEN_PROGRAM_ID }
    );

    const tokens: SPLToken[] = [];
    
    for (const { pubkey, account } of tokenAccounts.value) {
      const parsedData = account.data as ParsedAccountData;
      const tokenInfo = parsedData.parsed.info;
      
      tokens.push({
        mint: tokenInfo.mint,
        address: pubkey.toBase58(),
        amount: tokenInfo.tokenAmount.amount,
        decimals: tokenInfo.tokenAmount.decimals,
      });
    }

    return tokens;
  }

  /**
   * Get all token balances including SOL
   */
  async getAllBalances(address: string): Promise<TokenAccountBalancePair[]> {
    const publicKey = new PublicKey(address);
    
    // Get SOL balance
    const solBalance = await this.connection.getBalance(publicKey);
    
    // Get SPL token balances
    const tokenBalances = await this.getTokenBalances(address);
    
    const balances: TokenAccountBalancePair[] = [
      {
        address: publicKey.toBase58(),
        lamports: solBalance,
        decimals: 9,
        mint: 'So11111111111111111111111111111111111111112', // SOL mint
        uiAmount: solBalance / LAMPORTS_PER_SOL,
      }
    ];

    // Add SPL tokens
    for (const token of tokenBalances) {
      balances.push({
        address: token.address,
        lamports: parseInt(token.amount),
        decimals: token.decimals,
        mint: token.mint,
        uiAmount: parseInt(token.amount) / Math.pow(10, token.decimals),
      });
    }

    return balances;
  }

  /**
   * Build transaction
   */
  async buildTransaction(transaction: SolanaTransaction): Promise<Transaction> {
    const tx = new Transaction();
    
    // Add fee payer
    if (transaction.feePayer) {
      tx.feePayer = new PublicKey(transaction.feePayer);
    }

    // Add recent blockhash
    if (!transaction.recentBlockhash) {
      const { blockhash } = await this.connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
    } else {
      tx.recentBlockhash = transaction.recentBlockhash;
    }

    // Add instructions
    if (transaction.instructions) {
      transaction.instructions.forEach(instruction => {
        tx.add(instruction);
      });
    }

    return tx;
  }

  /**
   * Sign transaction
   */
  async signTransaction(privateKey: string, transaction: TransactionRequest): Promise<string> {
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    
    // Build SOL transfer transaction
    const tx = new Transaction();
    const { blockhash } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = keypair.publicKey;

    // Add transfer instruction
    tx.add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: new PublicKey(transaction.to),
        lamports: parseInt(transaction.value || '0'),
      })
    );

    // Sign transaction
    tx.sign(keypair);
    
    // Serialize to base58
    return bs58.encode(tx.serialize());
  }

  /**
   * Send transaction
   */
  async sendTransaction(signedTransaction: string): Promise<string> {
    const transaction = Transaction.from(bs58.decode(signedTransaction));
    const signature = await this.connection.sendRawTransaction(transaction.serialize());
    
    // Wait for confirmation
    await this.connection.confirmTransaction(signature, this.commitment);
    
    return signature;
  }

  /**
   * Send SOL
   */
  async sendSOL(
    privateKey: string,
    to: string,
    amount: number
  ): Promise<string> {
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: new PublicKey(to),
        lamports: amount * LAMPORTS_PER_SOL,
      })
    );

    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [keypair],
      { commitment: this.commitment }
    );

    return signature;
  }

  /**
   * Send SPL token
   */
  async sendToken(
    privateKey: string,
    to: string,
    mint: string,
    amount: number,
    decimals: number
  ): Promise<string> {
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    const fromPubkey = keypair.publicKey;
    const toPubkey = new PublicKey(to);
    const mintPubkey = new PublicKey(mint);

    // Get associated token accounts
    const fromTokenAccount = await getAssociatedTokenAddress(
      mintPubkey,
      fromPubkey
    );
    const toTokenAccount = await getAssociatedTokenAddress(
      mintPubkey,
      toPubkey
    );

    const transaction = new Transaction();

    // Check if recipient token account exists
    try {
      await getAccount(this.connection, toTokenAccount);
    } catch (error) {
      // Create associated token account for recipient
      transaction.add(
        createAssociatedTokenAccountInstruction(
          fromPubkey,
          toTokenAccount,
          toPubkey,
          mintPubkey
        )
      );
    }

    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        fromPubkey,
        amount * Math.pow(10, decimals)
      )
    );

    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [keypair],
      { commitment: this.commitment }
    );

    return signature;
  }

  /**
   * Get transaction details
   */
  async getTransaction(txHash: string): Promise<BaseTransaction> {
    const transaction = await this.connection.getParsedTransaction(txHash, {
      commitment: this.commitment,
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    const meta = transaction.meta;
    const instructions = transaction.transaction.message.instructions;
    
    // Find transfer instruction
    let from = '';
    let to = '';
    let value = '0';

    for (const instruction of instructions) {
      if ('parsed' in instruction && instruction.parsed) {
        if (instruction.parsed.type === 'transfer') {
          from = instruction.parsed.info.source;
          to = instruction.parsed.info.destination;
          value = instruction.parsed.info.lamports?.toString() || '0';
          break;
        }
      }
    }

    return {
      hash: txHash,
      from,
      to,
      value,
      fee: meta?.fee?.toString() || '0',
      status: meta?.err ? 'failed' : 'confirmed',
      blockNumber: transaction.slot,
      timestamp: transaction.blockTime || undefined,
    };
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(address: string, limit?: number): Promise<BaseTransaction[]> {
    const publicKey = new PublicKey(address);
    const signatures = await this.connection.getSignaturesForAddress(
      publicKey,
      { limit: limit || 20 }
    );

    const transactions: BaseTransaction[] = [];
    
    for (const sig of signatures) {
      try {
        const tx = await this.getTransaction(sig.signature);
        transactions.push(tx);
      } catch (error) {
        console.error('Error fetching transaction:', error);
      }
    }

    return transactions;
  }

  /**
   * Subscribe to new blocks
   */
  async subscribeToBlocks(callback: (blockNumber: number) => void): Promise<() => void> {
    const subscription = this.connection.onSlotChange((slotInfo) => {
      callback(slotInfo.slot);
    });

    return () => {
      this.connection.removeSlotChangeListener(subscription);
    };
  }

  /**
   * Sign message
   */
  async signMessage(privateKey: string, message: string): Promise<string> {
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    const messageBytes = new TextEncoder().encode(message);
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
    return bs58.encode(signature);
  }

  /**
   * Get rent exemption amount
   */
  async getRentExemption(dataLength = 0): Promise<number> {
    return await this.connection.getMinimumBalanceForRentExemption(dataLength);
  }

  /**
   * Airdrop SOL (testnet/devnet only)
   */
  async airdrop(address: string, amount = 1): Promise<string> {
    const publicKey = new PublicKey(address);
    const signature = await this.connection.requestAirdrop(
      publicKey,
      amount * LAMPORTS_PER_SOL
    );
    
    await this.connection.confirmTransaction(signature, this.commitment);
    return signature;
  }
}

// Import nacl for message signing
import nacl from 'tweetnacl';