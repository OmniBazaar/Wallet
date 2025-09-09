/**
 * Live Polkadot Provider with Keyring Integration
 */

import { PolkadotProvider, PolkadotNetworkConfig, SubstrateTransaction } from './provider';
import { keyringService } from '../../keyring/KeyringService';
import { POLKADOT_NETWORKS } from './networks';
import { encodeAddress } from '@polkadot/util-crypto';
import { WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';

/**
 * Live Polkadot provider that integrates with the wallet's keyring service
 */
export class LivePolkadotProvider extends PolkadotProvider {
  private activeAddress: string | null = null;
  
  /**
   * Get network-specific address prefix
   * @returns SS58 address format prefix
   */
  get networkPrefix(): number {
    return this.prefix;
  }

  /**
   * Create a live Polkadot provider
   * @param networkKey - Network identifier (e.g. 'polkadot', 'kusama')
   */
  constructor(networkKey = 'polkadot') {
    const network = POLKADOT_NETWORKS[networkKey];
    if (network === undefined) {
      throw new Error(`Unknown Polkadot network: ${networkKey}`);
    }
    super(network);
  }

  /**
   * Get current active address
   * @returns Active account address with network-specific encoding
   */
  getAddress(): Promise<string> {
    if (this.activeAddress === null || this.activeAddress === '') {
      const activeAccount = keyringService.getActiveAccount();
      if (activeAccount === null || activeAccount === undefined) {
        throw new Error('No active account');
      }
      // Encode address with proper network prefix
      this.activeAddress = encodeAddress(activeAccount.address, this.networkPrefix);
    }
    return Promise.resolve(this.activeAddress);
  }

  /**
   * Get all addresses from keyring
   * @param count - Maximum number of addresses to return
   * @returns Array of addresses with network-specific encoding
   */
  getAddresses(count = 10): Promise<string[]> {
    const accounts = keyringService.getAccounts('substrate');
    return Promise.resolve(accounts.slice(0, count).map(account => 
      encodeAddress(account.address, this.networkPrefix)
    ));
  }

  /**
   * Send native token
   * @param to - Recipient address
   * @param amount - Amount to send in smallest unit
   * @returns Transaction hash
   */
  async sendNativeToken(to: string, amount: string): Promise<string> {
    const from = await this.getAddress();
    const tx: SubstrateTransaction = {
      from,
      to,
      value: amount,
      section: 'balances',
      method: 'transfer',
      args: []
    };
    return this.signAndSendTransaction(tx);
  }

  /**
   * Get balance for active account
   * @returns Balance in smallest unit
   */
  async getActiveBalance(): Promise<string> {
    const address = await this.getAddress();
    return this.getBalance(address);
  }

  /**
   * Get formatted balance for active account
   * @returns Formatted balance with currency symbol
   */
  async getActiveFormattedBalance(): Promise<string> {
    const address = await this.getAddress();
    return this.getFormattedBalance(address);
  }

  /**
   * Sign and send transaction
   * @param _transaction - Transaction to sign and send
   * @returns Transaction hash
   */
  signAndSendTransaction(_transaction: SubstrateTransaction): Promise<string> {
    // Signing with KeyringService for substrate is pending integration.
    // Prevent silent failures by failing fast here.
    return Promise.reject(new Error('Substrate signing not configured in KeyringService'));
  }

  /**
   * Sign message with active account
   * @param message - Message to sign
   * @returns Signature as hex string
   */
  async signActiveMessage(message: string): Promise<string> {
    const address = await this.getAddress();
    return keyringService.signMessage(address, message);
  }

  /**
   * Get staking information
   * @param address - Address to check staking info for
   * @returns Staking information object
   */
  async getStakingInfo(address?: string): Promise<{ 
    /** Amount of tokens bonded for staking */
    bonded: string;
    /** Amount of tokens unbonding */
    unbonding: string;
    /** List of nominated validator addresses */
    nominators: string[];
  }> {
    const api = await this.ensureApi();
    const addr = address ?? await this.getAddress();

    // Get staking info
    const staking = api.query.staking as unknown as {
      bonded: (address: string) => Promise<{ toString: () => string } | null>;
      nominators: (address: string) => Promise<{ 
        isSome: boolean;
        unwrap: () => { targets: Array<{ toString: () => string }> };
      } | null>;
    };
    const bonded = await staking.bonded(addr);
    const nominators = await staking.nominators(addr);

    return {
      bonded: bonded?.toString() ?? '0',
      unbonding: '0',
      nominators: nominators !== null && nominators.isSome ? nominators.unwrap().targets.map((t) => t.toString()) : []
    };
  }

  /**
   * Bond tokens for staking
   * @param amount - Amount to bond in smallest unit
   * @param payee - Reward destination
   * @returns Transaction hash
   */
  async bondTokens(amount: string, payee: 'Staked' | 'Stash' | 'Controller' = 'Staked'): Promise<string> {
    const transaction: SubstrateTransaction = {
      from: await this.getAddress(),
      to: '', // Not used for staking
      value: amount,
      section: 'staking',
      method: 'bond',
      args: [await this.getAddress(), amount, payee]
    };

    return this.signAndSendTransaction(transaction);
  }

  /**
   * Nominate validators
   * @param validators - Array of validator addresses to nominate
   * @returns Transaction hash
   */
  async nominate(validators: string[]): Promise<string> {
    const transaction: SubstrateTransaction = {
      from: await this.getAddress(),
      to: '', // Not used for nomination
      value: '0',
      section: 'staking',
      method: 'nominate',
      args: [validators]
    };

    return this.signAndSendTransaction(transaction);
  }

  /**
   * Get current network
   * @returns Current network configuration
   */
  getCurrentNetwork(): PolkadotNetworkConfig {
    return this.config as PolkadotNetworkConfig;
  }

  /**
   * Switch to different Polkadot network
   * @param networkKey - Network identifier to switch to
   * @returns Promise that resolves when switch is complete
   */
  async switchNetwork(networkKey: string): Promise<void> {
    const network = POLKADOT_NETWORKS[networkKey];
    if (network === undefined) {
      throw new Error(`Unknown Polkadot network: ${networkKey}`);
    }

    // Disconnect from current network
    await this.disconnect();

    // Update configuration
    this.config = network;
    this.prefix = network.prefix;
    this.genesisHash = network.genesisHash;
    this.decimals = network.decimals;
    this.existentialDeposit = network.existentialDeposit;
    this.wsProvider = new WsProvider(network.rpcUrl);
    this.keyring = new Keyring({ type: 'sr25519', ss58Format: this.prefix });
    
    // Clear cached address
    this.activeAddress = null;
    
    // Reinitialize connection
    await this.init();
  }

  /**
   * Get supported networks
   * @returns Array of supported network configurations
   */
  static getSupportedNetworks(): PolkadotNetworkConfig[] {
    return Object.values(POLKADOT_NETWORKS);
  }
}
