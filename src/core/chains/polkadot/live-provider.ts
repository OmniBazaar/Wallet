/**
 * Live Polkadot Provider with Keyring Integration
 */

import { PolkadotProvider, PolkadotNetworkConfig, SubstrateTransaction } from './provider';
import { keyringService } from '../../keyring/KeyringService';
import { POLKADOT_NETWORKS } from './networks';
import { encodeAddress } from '@polkadot/util-crypto';

/**
 *
 */
export class LivePolkadotProvider extends PolkadotProvider {
  private activeAddress: string | null = null;

  /**
   *
   * @param networkKey
   */
  constructor(networkKey = 'polkadot') {
    const network = POLKADOT_NETWORKS[networkKey];
    if (!network) {
      throw new Error(`Unknown Polkadot network: ${networkKey}`);
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
      // Encode address with proper network prefix
      this.activeAddress = encodeAddress(activeAccount.address, this.prefix);
    }
    return this.activeAddress;
  }

  /**
   * Get all addresses from keyring
   * @param count
   */
  async getAddresses(count = 10): Promise<string[]> {
    const accounts = await keyringService.getAccounts('substrate');
    return accounts.slice(0, count).map(account => 
      encodeAddress(account.address, this.prefix)
    );
  }

  /**
   * Send native token
   * @param to
   * @param amount
   */
  async sendNativeToken(to: string, amount: string): Promise<string> {
    const from = await this.getAddress();
    const privateKey = await keyringService.exportPrivateKey(from);

    const transaction: TransactionRequest = {
      from,
      to,
      value: amount
    };

    const signedTx = await this.signTransaction(privateKey, transaction);
    return await this.sendTransaction(signedTx);
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
   * Sign and send transaction
   * @param transaction
   */
  async signAndSendTransaction(transaction: SubstrateTransaction): Promise<string> {
    const from = await this.getAddress();
    const privateKey = await keyringService.exportPrivateKey(from);

    const api = await this.ensureApi();
    const keyPair = this.keyring.addFromUri(privateKey);

    // Create the appropriate transaction based on method and section
    let tx;
    if (transaction.section === 'balances' && transaction.method === 'transfer') {
      tx = api.tx.balances.transfer(transaction.to, transaction.value);
    } else {
      // Handle other transaction types
      tx = api.tx[transaction.section][transaction.method](...transaction.args);
    }

    // Add tip if specified
    if (transaction.tip) {
      tx = tx.addTip(transaction.tip);
    }

    // Sign and send
    return new Promise((resolve, reject) => {
      tx.signAndSend(keyPair, ({ status, dispatchError }) => {
        if (status.isFinalized) {
          if (dispatchError) {
            reject(new Error(`Transaction failed: ${dispatchError.toString()}`));
          } else {
            resolve(status.asFinalized.toString());
          }
        }
      }).catch(reject);
    });
  }

  /**
   * Sign message with active account
   * @param message
   */
  async signActiveMessage(message: string): Promise<string> {
    const address = await this.getAddress();
    return keyringService.signMessage(address, message);
  }

  /**
   * Get staking information
   * @param address
   */
  async getStakingInfo(address?: string): Promise<{ /**
                                                     *
                                                     */
  bonded: string; /**
                   *
                   */
  unbonding: string; /**
                      *
                      */
  nominators: string[] }> {
    const api = await this.ensureApi();
    const addr = address || await this.getAddress();

    // Get staking info
    const [stakingInfo, nominators] = await Promise.all([
      api.query.staking.bonded(addr),
      api.query.staking.nominators(addr)
    ]);

    return {
      bonded: stakingInfo.toString(),
      isNominator: nominators.isSome,
      targets: nominators.isSome ? nominators.unwrap().targets.map(t => t.toString()) : []
    };
  }

  /**
   * Bond tokens for staking
   * @param amount
   * @param payee
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
   * @param validators
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
   */
  getCurrentNetwork(): PolkadotNetworkConfig {
    return this.config as PolkadotNetworkConfig;
  }

  /**
   * Switch to different Polkadot network
   * @param networkKey
   */
  async switchNetwork(networkKey: string): Promise<void> {
    const network = POLKADOT_NETWORKS[networkKey];
    if (!network) {
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
   */
  static getSupportedNetworks(): PolkadotNetworkConfig[] {
    return Object.values(POLKADOT_NETWORKS);
  }
}