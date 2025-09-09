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
  Finality,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
} from '@solana/spl-token';
import { BaseProvider } from '../base-provider';
import { NetworkConfig, Transaction as BaseTransaction, TransactionRequest } from '../../../types';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { POPULAR_SPL_TOKENS } from './networks';

/**
 * Solana-specific network configuration
 */
export interface SolanaNetworkConfig extends NetworkConfig {
  /**
   * Transaction commitment level
   */
  commitment?: Finality;
  /**
   * WebSocket URL for real-time updates
   */
  wsUrl?: string;
}

/**
 * Solana-specific transaction interface extending base transaction request
 */
export interface SolanaTransaction extends TransactionRequest {
  /**
   * Raw transaction instructions
   */
  instructions?: { 
    /** Program ID for the instruction */
    programId: string;
    /** Account keys involved in the instruction */
    keys: Array<{ 
      /** Public key of the account */
      pubkey: string;
      /** Whether this account must sign */
      isSigner: boolean;
      /** Whether this account is writable */
      isWritable: boolean; 
    }>;
    /** Instruction data as base58 string */
    data: string;
  }[];
  /**
   * Account that pays for the transaction fee
   */
  feePayer?: string;
  /**
   * Recent blockhash for transaction expiry
   */
  recentBlockhash?: string;
  /**
   * Transaction signatures
   */
  signatures?: string[];
}

/**
 * SPL Token information
 */
export interface SPLToken {
  /**
   * Token mint address
   */
  mint: string;
  /**
   * Token account address
   */
  address?: string;
  /**
   * Token amount in raw units
   */
  amount: string;
  /**
   * Token decimals
   */
  decimals: number;
  /**
   * Token symbol (e.g., USDC)
   */
  symbol?: string;
  /**
   * Token full name
   */
  name?: string;
  /**
   * Token logo URI
   */
  logoURI?: string;
  /**
   * UI-friendly amount
   */
  uiAmount?: number;
}

/**
 * Solana blockchain provider for wallet operations
 */
export class SolanaProvider extends BaseProvider {
  protected connection?: Connection;
  protected commitment: Finality;

  /**
   * Initialize Solana provider with network configuration
   * @param config - Network configuration including RPC URL and optional commitment level
   */
  constructor(config: SolanaNetworkConfig) {
    super(config);
    this.commitment = config.commitment ?? 'confirmed';
    this.initConnection();
  }

  /**
   * Initialize the connection (separated for testing)
   */
  protected initConnection(): void {
    try {
      // Check if Connection is available (might be mocked in tests)
      if (typeof Connection === 'function') {
        this.connection = new Connection(this.config.rpcUrl, {
          commitment: this.commitment,
          ...((this.config as SolanaNetworkConfig).wsUrl !== undefined && { wsEndpoint: (this.config as SolanaNetworkConfig).wsUrl }),
        });
      }
    } catch (error) {
      // Connection initialization failed - likely in test environment
      // Operations requiring connection will throw appropriate errors
    }
  }

  /**
   * Get the connection, throwing error if not initialized
   * @returns Connection instance
   */
  protected getConnection(): Connection {
    if (this.connection === undefined) {
      throw new Error('Solana connection not initialized');
    }
    return this.connection;
  }

  /**
   * Get account from private key
   * @param privateKey - Private key in base58 format
   * @returns Account address and public key
   */
  getAccount(privateKey: string): Promise<{ 
    /** Account address in base58 format */
    address: string;
    /** Public key in base58 format */
    publicKey: string;
  }> {
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    return Promise.resolve({
      address: keypair.publicKey.toBase58(),
      publicKey: keypair.publicKey.toBase58()
    });
  }

  /**
   * Get SOL balance in SOL units (not lamports)
   * @param address - Solana wallet address
   * @returns Balance in SOL as string
   */
  async getBalance(address: string): Promise<string> {
    const publicKey = new PublicKey(address);
    const balance = await this.getConnection().getBalance(publicKey);
    return (balance / LAMPORTS_PER_SOL).toString();
  }

  /**
   * Get formatted balance in SOL
   * @param address - Solana wallet address
   * @returns Formatted balance string with SOL suffix
   */
  async getFormattedBalance(address: string): Promise<string> {
    const balance = await this.getBalance(address);
    const sol = parseFloat(balance);
    return `${sol.toFixed(9)} SOL`;
  }

  /**
   * Get SPL token balances with metadata
   * @param address - Wallet address
   * @returns Array of SPL tokens with enriched metadata
   */
  async getTokenBalances(address: string): Promise<SPLToken[]> {
    const publicKey = new PublicKey(address);
    const tokenAccounts = await this.getConnection().getParsedTokenAccountsByOwner(
      publicKey,
      { programId: TOKEN_PROGRAM_ID }
    );

    const tokens: SPLToken[] = [];
    
    for (const { pubkey, account } of tokenAccounts.value) {
      const parsedData = account.data as {
        parsed: {
          info: {
            mint: string;
            tokenAmount: {
              amount: string;
              decimals: number;
              uiAmount: number;
            };
          };
        };
      };
      const tokenInfo = parsedData.parsed.info;
      
      // Find metadata for known tokens
      const popularToken = Object.values(POPULAR_SPL_TOKENS).find(
        (pt) => pt.mint === tokenInfo.mint
      );
      
      tokens.push({
        mint: tokenInfo.mint,
        address: pubkey.toBase58(),
        amount: tokenInfo.tokenAmount.amount,
        decimals: tokenInfo.tokenAmount.decimals,
        uiAmount: tokenInfo.tokenAmount.uiAmount,
        ...(popularToken !== undefined && {
          symbol: popularToken.symbol,
          name: popularToken.name,
          logoURI: popularToken.logoURI
        })
      });
    }

    return tokens;
  }

  /**
   * Get all token balances including SOL
   * @param address - Wallet address
   * @returns Array of all token balances
   */
  async getAllBalances(address: string): Promise<{
    address: string;
    lamports: number;
    decimals: number;
    mint: string;
    uiAmount: number;
  }[]> {
    const publicKey = new PublicKey(address);
    
    // Get SOL balance
    const solBalance = await this.getConnection().getBalance(publicKey);
    
    // Get SPL token balances
    const tokenBalances = await this.getTokenBalances(address);
    
    const balances: {
      address: string;
      lamports: number;
      decimals: number;
      mint: string;
      uiAmount: number;
    }[] = [
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
   * @param transaction - Transaction parameters
   * @returns Built transaction object
   */
  async buildTransaction(transaction: SolanaTransaction): Promise<Transaction> {
    const tx = new Transaction();
    
    // Add fee payer
    if (transaction.feePayer !== undefined && transaction.feePayer !== null && transaction.feePayer !== '') {
      tx.feePayer = new PublicKey(transaction.feePayer);
    }

    // Add recent blockhash
    if (transaction.recentBlockhash === undefined || transaction.recentBlockhash === null || transaction.recentBlockhash === '') {
      const { blockhash } = await this.getConnection().getLatestBlockhash();
      tx.recentBlockhash = blockhash;
    } else {
      tx.recentBlockhash = transaction.recentBlockhash;
    }

    // Add instructions
    if (transaction.instructions !== undefined) {
      transaction.instructions.forEach(instruction => {
        tx.add(instruction);
      });
    }

    return tx;
  }

  /**
   * Sign transaction
   * @param privateKey - Private key in base58 format
   * @param transaction - Transaction request to sign
   * @returns Signed transaction as base58 string
   */
  async signTransaction(privateKey: string, transaction: TransactionRequest): Promise<string> {
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    
    // Build SOL transfer transaction
    const tx = new Transaction();
    const { blockhash } = await this.getConnection().getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = keypair.publicKey;

    // Add transfer instruction
    tx.add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: new PublicKey(transaction.to),
        lamports: parseInt(transaction.value ?? '0'),
      })
    );

    // Sign transaction
    tx.sign(keypair);
    
    // Serialize to base58
    return bs58.encode(tx.serialize());
  }

  /**
   * Send transaction
   * @param signedTransaction - Signed transaction as base58 string
   * @returns Transaction signature
   */
  async sendTransaction(signedTransaction: string): Promise<string> {
    const transaction = Transaction.from(bs58.decode(signedTransaction));
    const signature = await this.getConnection().sendRawTransaction(transaction.serialize());
    
    // Wait for confirmation
    await this.getConnection().confirmTransaction(signature, this.commitment);
    
    return signature;
  }

  /**
   * Send SOL to another address
   * @param privateKey - Sender's private key in base58 format
   * @param to - Recipient's address
   * @param amount - Amount in SOL (not lamports)
   * @returns Transaction signature
   */
  async sendSOL(
    privateKey: string,
    to: string,
    amount: number
  ): Promise<string> {
    if (amount <= 0 || isNaN(amount)) {
      throw new Error('Invalid amount');
    }
    
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: new PublicKey(to),
        lamports: Math.floor(amount * LAMPORTS_PER_SOL),
      })
    );

    const signature = await sendAndConfirmTransaction(
      this.getConnection(),
      transaction,
      [keypair],
      { commitment: this.commitment }
    );

    return signature;
  }

  /**
   * Send SPL token to another address
   * @param privateKey - Sender's private key in base58 format
   * @param to - Recipient's address
   * @param mint - Token mint address
   * @param amount - Amount in token units (not raw amount)
   * @param decimals - Token decimals
   * @returns Transaction signature
   */
  async sendToken(
    privateKey: string,
    to: string,
    mint: string,
    amount: number,
    decimals: number
  ): Promise<string> {
    if (amount <= 0 || isNaN(amount)) {
      throw new Error('Invalid amount');
    }
    
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
      await getAccount(this.getConnection(), toTokenAccount);
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
        BigInt(Math.floor(amount * Math.pow(10, decimals)))
      )
    );

    const signature = await sendAndConfirmTransaction(
      this.getConnection(),
      transaction,
      [keypair],
      { commitment: this.commitment }
    );

    return signature;
  }

  /**
   * Get transaction details
   * @param txHash - Transaction hash/signature
   * @returns Transaction details
   */
  async getTransaction(txHash: string): Promise<BaseTransaction> {
    const transaction = await this.getConnection().getParsedTransaction(txHash, {
      commitment: this.commitment,
    });

    if (transaction === null) {
      throw new Error('Transaction not found');
    }

    const meta = transaction.meta;
    const instructions = transaction.transaction.message.instructions;
    
    // Find transfer instruction
    let from = '';
    let to = '';
    let value = '0';

    for (const instruction of instructions) {
      if ('parsed' in instruction && instruction.parsed !== null && instruction.parsed !== undefined) {
        const parsed = instruction.parsed as {
          type: string;
          info: {
            source?: string;
            destination?: string;
            lamports?: number;
          };
        };
        if (parsed.type === 'transfer') {
          from = parsed.info.source ?? '';
          to = parsed.info.destination ?? '';
          value = parsed.info.lamports?.toString() ?? '0';
          break;
        }
      }
    }

    const result: BaseTransaction = {
      hash: txHash,
      from,
      to,
      value,
      fee: meta?.fee?.toString() ?? '0',
      status: (meta?.err !== null && meta?.err !== undefined) ? 'failed' as const : 'confirmed' as const,
      blockNumber: transaction.slot
    };

    // Add timestamp only if it exists
    if (transaction.blockTime !== null && transaction.blockTime !== undefined) {
      result.timestamp = transaction.blockTime;
    }

    return result;
  }

  /**
   * Get transaction history
   * @param address - Wallet address
   * @param limit - Maximum number of transactions to return
   * @returns Array of transactions
   */
  async getTransactionHistory(address: string, limit?: number): Promise<BaseTransaction[]> {
    const publicKey = new PublicKey(address);
    const signatures = await this.getConnection().getSignaturesForAddress(
      publicKey,
      { limit: limit ?? 20 }
    );

    const transactions: BaseTransaction[] = [];
    
    for (const sig of signatures) {
      try {
        const tx = await this.getTransaction(sig.signature);
        transactions.push(tx);
      } catch (error) {
        // Skip failed transaction
      }
    }

    return transactions;
  }

  /**
   * Subscribe to new blocks
   * @param callback - Function called with each new block number
   * @returns Unsubscribe function
   */
  subscribeToBlocks(callback: (blockNumber: number) => void): Promise<() => void> {
    const connection = this.getConnection();
    const subscription = connection.onSlotChange((slotInfo: { slot: number }) => {
      callback(slotInfo.slot);
    });

    return Promise.resolve(() => {
      void connection.removeSlotChangeListener(subscription);
    });
  }

  /**
   * Sign message
   * @param privateKey - Private key in base58 format
   * @param message - Message to sign
   * @returns Signature as base58 string
   */
  signMessage(privateKey: string, message: string): Promise<string> {
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    const messageBytes = new TextEncoder().encode(message);
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
    return Promise.resolve(bs58.encode(signature));
  }

  /**
   * Get rent exemption amount
   * @param dataLength - Data length in bytes
   * @returns Rent exemption amount in lamports
   */
  async getRentExemption(dataLength = 0): Promise<number> {
    return await this.getConnection().getMinimumBalanceForRentExemption(dataLength);
  }

  /**
   * Airdrop SOL (testnet/devnet only)
   * @param address - Wallet address to airdrop to
   * @param amount - Amount in SOL (default 1)
   * @returns Transaction signature
   */
  async airdrop(address: string, amount = 1): Promise<string> {
    const publicKey = new PublicKey(address);
    const signature = await this.getConnection().requestAirdrop(
      publicKey,
      amount * LAMPORTS_PER_SOL
    );
    
    await this.getConnection().confirmTransaction(signature, this.commitment);
    return signature;
  }

  /**
   * Switch to a different network
   * @param config New network configuration
   */
  switchNetwork(config: SolanaNetworkConfig): void {
    this.config = config;
    this.commitment = config.commitment ?? 'confirmed';
    this.initConnection();
  }

  /**
   * Get recent blockhash for transaction construction
   * @returns Recent blockhash string
   */
  async getRecentBlockhash(): Promise<string> {
    const { blockhash } = await this.getConnection().getLatestBlockhash();
    return blockhash;
  }

  /**
   * Get network details including explorer URL and native currency info
   * @returns Network details object
   */
  getNetworkDetails(): {
    name: string;
    chainId: string;
    rpcUrl: string;
    explorer: string;
    nativeCurrency: {
      name: string;
      symbol: string;
      decimals: number;
    };
  } {
    const config = this.getConfig() as SolanaNetworkConfig;
    return {
      name: config.name,
      chainId: config.chainId.toString(),
      rpcUrl: config.rpcUrl,
      explorer: config.blockExplorerUrls?.[0] ?? 'https://explorer.solana.com',
      nativeCurrency: {
        name: 'Solana',
        symbol: 'SOL',
        decimals: 9
      }
    };
  }

  /**
   * Estimate transaction fee in SOL
   * @returns Estimated fee in SOL as string
   */
  async estimateFee(): Promise<string> {
    try {
      // Get recent blockhash and fee calculator
      const { blockhash, _lastValidBlockHeight } = await this.getConnection().getLatestBlockhash();
      
      // Create a simple transfer transaction to estimate fees
      const transaction = new Transaction();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = new PublicKey('11111111111111111111111111111111'); // System program
      
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey('11111111111111111111111111111111'),
          toPubkey: new PublicKey('11111111111111111111111111111111'),
          lamports: 1,
        })
      );
      
      // Get fee for this transaction
      const fee = await this.getConnection().getFeeForMessage(
        transaction.compileMessage(),
        this.commitment
      );
      
      if (fee !== null && fee.value !== null) {
        return (fee.value / LAMPORTS_PER_SOL).toString();
      }
      
      // Default fee if unable to calculate
      return '0.000005';
    } catch (error) {
      // Return default fee on error
      return '0.000005';
    }
  }

  /**
   * Get popular token information by symbol
   * @param symbol - Token symbol (e.g., 'USDC')
   * @returns Token info or null if not found
   */
  getPopularTokenInfo(symbol: string): {
    mint: string;
    decimals: number;
    symbol: string;
    name: string;
  } | null {
    const token = POPULAR_SPL_TOKENS[symbol as keyof typeof POPULAR_SPL_TOKENS];
    return token !== undefined ? {
      mint: token.mint,
      decimals: token.decimals,
      symbol: token.symbol,
      name: token.name
    } : null;
  }

  /**
   * Get all SPL tokens for an address with metadata
   * @param address - Wallet address
   * @returns Array of SPL tokens with enriched metadata
   */
  async getAllSPLTokens(address: string): Promise<SPLToken[]> {
    // This method is an alias for getTokenBalances which already enriches metadata
    return this.getTokenBalances(address);
  }

}
