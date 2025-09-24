/**
 * Live Solana Provider with Keyring Integration
 */

import { Connection } from '@solana/web3.js';
import { SolanaProvider, SolanaNetworkConfig, SPLToken } from './provider';
import { keyringService } from '../../keyring/KeyringService';
import { SOLANA_NETWORKS, POPULAR_SPL_TOKENS } from './networks';

/**
 * Live Solana provider that integrates with the wallet keyring.
 * Exposes convenience helpers for native and SPL transfers,
 * balance queries, message signing, and network management.
 */
export class LiveSolanaProvider extends SolanaProvider {
  private activeAddress: string | null = null;

  /**
   * Construct a provider for the given Solana network key.
   * @param networkKey Key of the network from `SOLANA_NETWORKS` (default 'mainnet')
   */
  constructor(networkKey = 'mainnet') {
    const network = SOLANA_NETWORKS[networkKey];
    if (network === null || network === undefined) {
      throw new Error(`Unknown Solana network: ${networkKey}`);
    }
    super(network);
  }

  /**
   * Get current active address
   * @returns Promise resolving to the active address
   */
  getAddress(): Promise<string> {
    if (this.activeAddress === null || this.activeAddress === undefined || this.activeAddress === '') {
      const activeAccount = keyringService.getActiveAccount();
      if (activeAccount === null || activeAccount === undefined) {
        throw new Error('No active account');
      }
      this.activeAddress = activeAccount.address;
    }
    return Promise.resolve(this.activeAddress);
  }

  /**
   * Get addresses from the keyring, limited by count
   * @param count - Max number of addresses to return (default 10)
   * @returns Promise resolving to array of addresses
   */
  getAddresses(count = 10): Promise<string[]> {
    const accounts = keyringService.getAccounts('solana');
    return Promise.resolve(accounts.slice(0, count).map(account => account.address));
  }

  /**
   * Send native SOL using the active keyring account
   * @param _to - Recipient base58 address
   * @param _lamports - Amount in lamports as string
   * @returns Promise resolving to transaction signature
   */
  sendNativeToken(_to: string, _lamports: string): Promise<string> {
    // TODO: Integrate Solana signing with KeyringService secret management.
    return Promise.reject(new Error('Solana signing not configured in KeyringService'));
  }

  /**
   * Send an SPL token using the active keyring account
   * @param _to - Recipient base58 address
   * @param _mint - Token mint address
   * @param _amount - Human-readable amount as string
   * @param _decimals - Token decimals used for conversion
   * @returns Promise resolving to transaction signature
   */
  sendSPLToken(
    _to: string,
    _mint: string,
    _amount: string,
    _decimals: number
  ): Promise<string> {
    // TODO: Integrate Solana signing with KeyringService secret management.
    return Promise.reject(new Error('Solana signing not configured in KeyringService'));
  }

  /**
   * Get native balance for the active account
   * @returns Promise resolving to balance in lamports as string
   */
  async getActiveBalance(): Promise<string> {
    const address = await this.getAddress();
    return this.getBalance(address);
  }

  /**
   * Get formatted native balance for the active account
   * @returns Promise resolving to formatted balance with SOL suffix
   */
  async getActiveFormattedBalance(): Promise<string> {
    const address = await this.getAddress();
    return this.getFormattedBalance(address);
  }

  /**
   * Get SPL token balances for the active account, enriched with metadata
   * @returns Promise resolving to array of SPL token information
   */
  async getActiveTokenBalances(): Promise<SPLToken[]> {
    const address = await this.getAddress();
    const tokens = await this.getTokenBalances(address);
    
    // Enhance with known token metadata
    return tokens.map(token => {
      const knownToken = Object.values(POPULAR_SPL_TOKENS).find(
        t => t.mint === token.mint
      );
      
      if (knownToken !== null && knownToken !== undefined) {
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
   * Sign a UTF‑8 message with the active account
   * @param message - Message to sign
   * @returns Promise resolving to the signature
   */
  async signActiveMessage(message: string): Promise<string> {
    const address = await this.getAddress();
    return keyringService.signMessage(address, message);
  }

  /**
   * Create an associated token account for the given mint.
   * @param _mint - Token mint address
   * @returns Associated token account address (base58)
   */
  createTokenAccount(_mint: string): Promise<string> {
    // TODO: Integrate Solana signing with KeyringService secret management.
    return Promise.reject(new Error('Solana signing not configured in KeyringService'));
  }

  /**
   * Get transaction history for the active account
   * @param limit - Optional max items to return
   * @returns Promise resolving to array of transactions
   */
  async getActiveTransactionHistory(limit?: number): Promise<BaseTransaction[]> {
    const address = await this.getAddress();
    return this.getTransactionHistory(address, limit);
  }

  /**
   * Estimate the fee for a transfer
   * @returns Promise resolving to fee estimate in lamports as string
   */
  override estimateFee(): Promise<string> {
    // Return typical Solana transaction fee
    return Promise.resolve('5000'); // 0.000005 SOL
  }

  /**
   * Estimate the fee for a specific transfer.
   * @param to - Recipient address
   * @param amount - Amount in lamports (native) or human amount (token)
   * @param isToken - Whether estimating for an SPL token transfer
   * @returns Fee estimate in lamports as string
   */
  async estimateTransferFee(
    to: string,
    amount: string,
    isToken = false
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

    const connection = this.connection;
    if (connection === undefined) {
      throw new Error('No connection available');
    }
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = new PublicKey(await this.getAddress());

    const fee = await transaction.getEstimatedFee(connection);
    return fee?.toString() ?? '5000';
  }

  /**
   * Get the current Solana network configuration.
   * @returns Current network configuration
   */
  getCurrentNetwork(): SolanaNetworkConfig {
    return this.config as SolanaNetworkConfig;
  }

  /**
   * Switch to a different Solana network.
   * @param config Network configuration
   */
  override switchNetwork(config: SolanaNetworkConfig): void {
    if (config === null || config === undefined) {
      throw new Error('Network config is required');
    }

    // Update configuration
    this.config = config;
    this.commitment = config.commitment ?? 'confirmed';
    
    // Create new connection
    this.connection = new Connection(config.rpcUrl, {
      commitment: this.commitment,
      ...(config.wsUrl !== undefined && config.wsUrl !== null && config.wsUrl !== '' && { wsEndpoint: config.wsUrl }),
    });
    
    // Clear cached address
    this.activeAddress = null;
  }

  /**
   * Return the list of supported Solana networks.
   * @returns Array of supported network configurations
   */
  static getSupportedNetworks(): SolanaNetworkConfig[] {
    return Object.values(SOLANA_NETWORKS);
  }

  /**
   * Check if the current network is a devnet/testnet.
   * @returns True if on testnet/devnet
   */
  isTestnet(): boolean {
    const network = this.getCurrentNetwork();
    const id = String(network.chainId);
    return id.includes('devnet') || id.includes('testnet');
  }

  /**
   * Request a SOL airdrop for the active address (testnet/devnet only).
   * @param amount - Amount in SOL to request (default 1)
   * @returns Transaction signature
   */
  async requestAirdrop(amount = 1): Promise<string> {
    if (!this.isTestnet()) {
      throw new Error('Airdrop is only available on testnet/devnet');
    }
    
    const address = await this.getAddress();
    return this.airdrop(address, amount);
  }
}

// Import Transaction type
import { Transaction as BaseTransaction } from '../../../types';
