/**
 * Live Solana Provider with Keyring Integration
 */

import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { SolanaProvider, SolanaNetworkConfig, SPLToken } from './provider';
import { keyringService } from '../../keyring/KeyringService';
import { SOLANA_NETWORKS, POPULAR_SPL_TOKENS } from './networks';

export class LiveSolanaProvider extends SolanaProvider {
  private activeAddress: string | null = null;

  constructor(networkKey: string = 'mainnet') {
    const network = SOLANA_NETWORKS[networkKey];
    if (!network) {
      throw new Error(`Unknown Solana network: ${networkKey}`);
    }
    super(network);
  }

  /**
   * Get current active address
   */
  async getAddress(): Promise<string> {
    if (!this.activeAddress) {
      const activeAccount = keyringService.getActiveAccount();
      if (!activeAccount) {
        throw new Error('No active account');
      }
      this.activeAddress = activeAccount.address;
    }
    return this.activeAddress;
  }

  /**
   * Get all addresses from keyring
   */
  async getAddresses(count: number = 10): Promise<string[]> {
    const accounts = await keyringService.getAccounts('solana');
    return accounts.slice(0, count).map(account => account.address);
  }

  /**
   * Send SOL with keyring
   */
  async sendNativeToken(to: string, lamports: string): Promise<string> {
    const from = await this.getAddress();
    const privateKey = await keyringService.exportPrivateKey(from);

    const transaction: TransactionRequest = {
      from,
      to,
      value: lamports
    };

    const signedTx = await this.signTransaction(privateKey, transaction);
    return await this.sendTransaction(signedTx);
  }

  /**
   * Send SPL token with keyring
   */
  async sendSPLToken(
    to: string,
    mint: string,
    amount: string,
    decimals: number
  ): Promise<string> {
    const from = await this.getAddress();
    const privateKey = await keyringService.exportPrivateKey(from);

    // Convert amount to proper units
    const amountNumber = parseFloat(amount);
    return await this.sendToken(privateKey, to, mint, amountNumber, decimals);
  }

  /**
   * Get balance for active account
   */
  async getActiveBalance(): Promise<string> {
    const address = await this.getAddress();
    return this.getBalance(address);
  }

  /**
   * Get formatted balance for active account
   */
  async getActiveFormattedBalance(): Promise<string> {
    const address = await this.getAddress();
    return this.getFormattedBalance(address);
  }

  /**
   * Get all token balances for active account
   */
  async getActiveTokenBalances(): Promise<SPLToken[]> {
    const address = await this.getAddress();
    const tokens = await this.getTokenBalances(address);
    
    // Enhance with known token metadata
    return tokens.map(token => {
      const knownToken = Object.values(POPULAR_SPL_TOKENS).find(
        t => t.mint === token.mint
      );
      
      if (knownToken) {
        return {
          ...token,
          symbol: knownToken.symbol,
          name: knownToken.name,
          logoURI: knownToken.logoURI,
        };
      }
      
      return token;
    });
  }

  /**
   * Sign message with active account
   */
  async signActiveMessage(message: string): Promise<string> {
    const address = await this.getAddress();
    return keyringService.signMessage(address, message);
  }

  /**
   * Create new SPL token account
   */
  async createTokenAccount(mint: string): Promise<string> {
    const from = await this.getAddress();
    const privateKey = await keyringService.exportPrivateKey(from);
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));

    const { PublicKey } = await import('@solana/web3.js');
    const {
      getAssociatedTokenAddress,
      createAssociatedTokenAccountInstruction,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    } = await import('@solana/spl-token');

    const mintPubkey = new PublicKey(mint);
    const associatedTokenAddress = await getAssociatedTokenAddress(
      mintPubkey,
      keypair.publicKey
    );

    const transaction = new Transaction();
    transaction.add(
      createAssociatedTokenAccountInstruction(
        keypair.publicKey,
        associatedTokenAddress,
        keypair.publicKey,
        mintPubkey,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );

    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = keypair.publicKey;
    transaction.sign(keypair);

    const signature = await this.connection.sendRawTransaction(
      transaction.serialize()
    );
    
    await this.connection.confirmTransaction(signature, this.commitment);
    return associatedTokenAddress.toBase58();
  }

  /**
   * Get transaction history for active account
   */
  async getActiveTransactionHistory(limit?: number): Promise<Transaction[]> {
    const address = await this.getAddress();
    return this.getTransactionHistory(address, limit);
  }

  /**
   * Estimate transaction fee
   */
  async estimateFee(
    to: string,
    amount: string,
    isToken: boolean = false
  ): Promise<string> {
    const { Transaction, SystemProgram, PublicKey } = await import('@solana/web3.js');
    
    const transaction = new Transaction();
    
    if (isToken) {
      // Token transfer requires more complex fee calculation
      // For now, return a typical fee
      return '5000'; // 0.000005 SOL
    } else {
      // SOL transfer
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(await this.getAddress()),
          toPubkey: new PublicKey(to),
          lamports: parseInt(amount),
        })
      );
    }

    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = new PublicKey(await this.getAddress());

    const fee = await transaction.getEstimatedFee(this.connection);
    return fee?.toString() || '5000';
  }

  /**
   * Get current network
   */
  getCurrentNetwork(): SolanaNetworkConfig {
    return this.config as SolanaNetworkConfig;
  }

  /**
   * Switch to different Solana network
   */
  async switchNetwork(networkKey: string): Promise<void> {
    const network = SOLANA_NETWORKS[networkKey];
    if (!network) {
      throw new Error(`Unknown Solana network: ${networkKey}`);
    }

    // Update configuration
    this.config = network;
    this.commitment = network.commitment || 'confirmed';
    
    // Create new connection
    const { Connection } = await import('@solana/web3.js');
    this.connection = new Connection(network.rpcUrl, {
      commitment: this.commitment,
      wsEndpoint: network.wsUrl,
    });
    
    // Clear cached address
    this.activeAddress = null;
  }

  /**
   * Get supported networks
   */
  static getSupportedNetworks(): SolanaNetworkConfig[] {
    return Object.values(SOLANA_NETWORKS);
  }

  /**
   * Check if network is testnet
   */
  isTestnet(): boolean {
    const network = this.getCurrentNetwork();
    return network.chainId.includes('devnet') || network.chainId.includes('testnet');
  }

  /**
   * Request airdrop (testnet only)
   */
  async requestAirdrop(amount: number = 1): Promise<string> {
    if (!this.isTestnet()) {
      throw new Error('Airdrop is only available on testnet/devnet');
    }
    
    const address = await this.getAddress();
    return this.airdrop(address, amount);
  }
}

// Import Transaction type
import { Transaction, TransactionRequest } from '@/types';