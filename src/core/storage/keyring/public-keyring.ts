import { SignerType, Errors, WalletType } from '@enkryptcom/types';
import type { EnkryptAccount } from '@enkryptcom/types';
// Declare dev flag to satisfy type-check in strict mode
declare const __IS_DEV__: boolean;
import { KeyRingBase } from './keyring';

/**
 * Public interface for keyring operations that don't require unlocking
 * Provides read-only access to account information and development test accounts
 * @example
 * ```typescript
 * const publicKeyring = new PublicKeyRing();
 * const accounts = await publicKeyring.getAccounts();
 * const isLocked = publicKeyring.isLocked();
 * ```
 */
class PublicKeyRing {
  /** Private keyring instance for secure operations */
  #keyring: KeyRingBase;
  
  /**
   * Creates a new public keyring interface
   */
  constructor() {
    this.#keyring = new KeyRingBase();
  }
  /**
   * Retrieves all stored account keys with development test accounts in dev mode
   * @returns Object mapping addresses to EnkryptAccount objects
   * @private
   */
  private async getKeysObject(): Promise<{ [key: string]: EnkryptAccount }> {
    const allKeys = await this.#keyring.getKeysObject();
    if (__IS_DEV__) {
      allKeys['0x99999990d598b918799f38163204bbc30611b6b6'] = {
        address: '0x99999990d598b918799f38163204bbc30611b6b6',
        basePath: "m/44'/60'/1'/0",
        name: 'fake account #1',
        pathIndex: 0,
        publicKey: '0x0',
        signerType: SignerType.secp256k1,
        walletType: WalletType.mnemonic,
        isHardware: false,
        isTestWallet: true,
      };
      allKeys['0xb1ea5a3e5ea7fa1834d48058ecda26d8c59e8251'] = {
        address: '0xb1ea5a3e5ea7fa1834d48058ecda26d8c59e8251', //optimism nfts
        basePath: "m/44'/60'/2'/0",
        name: 'fake account #2',
        pathIndex: 0,
        publicKey: '0x0',
        signerType: SignerType.secp256k1,
        walletType: WalletType.mnemonic,
        isHardware: false,
        isTestWallet: true,
      };
      allKeys['0xe5dc07bdcdb8c98850050c7f67de7e164b1ea391'] = {
        address: '0xe5dc07bdcdb8c98850050c7f67de7e164b1ea391',
        basePath: "m/44'/60'/1'/1",
        name: 'fake ledger account #3',
        pathIndex: 0,
        publicKey: '0x0',
        signerType: SignerType.secp256k1,
        walletType: WalletType.ledger,
        isHardware: true,
        isTestWallet: true,
      };
      allKeys['5E56EZk6jmpq1q3Har3Ms99D9TLN9ra2inFh7Q1Hj6GpUx6D'] = {
        address: '5E56EZk6jmpq1q3Har3Ms99D9TLN9ra2inFh7Q1Hj6GpUx6D',
        basePath: '//',
        name: 'fake ledger account #2',
        pathIndex: 0,
        publicKey: '0x0',
        signerType: SignerType.sr25519,
        walletType: WalletType.ledger,
        isHardware: true,
        isTestWallet: true,
      };
      allKeys['5E56EZk6jmpq1q3Har3Ms99D9TLN9ra2inFh7Q1Hj6GpUx6D'] = {
        address: '5CFnoCsP3pDK2thhSqYPwKELJFLQ1hBodqzSUypexyh7eHkB',
        basePath: '//',
        name: 'fake account #4',
        pathIndex: 0,
        publicKey: '0x0',
        signerType: SignerType.sr25519,
        walletType: WalletType.mnemonic,
        isHardware: false,
        isTestWallet: true,
      };
      allKeys[
        'bc1puzz9tmxawd7zdd7klfgtywrgpma3u22fz5ecxhucd4j8tygqe5ms2vdd9y'
      ] = {
        address:
          'bc1puzz9tmxawd7zdd7klfgtywrgpma3u22fz5ecxhucd4j8tygqe5ms2vdd9y',
        basePath: "m/49'/2'/0'/1",
        name: 'fake ltc account #4',
        pathIndex: 0,
        publicKey: '0x0',
        signerType: SignerType.secp256k1btc,
        walletType: WalletType.mnemonic,
        isHardware: false,
        isTestWallet: true,
      };
      allKeys['77hREDDaAiimedtD9bR1JDMgYLW3AA5yPvD91pvrueRp'] = {
        address: '77hREDDaAiimedtD9bR1JDMgYLW3AA5yPvD91pvrueRp',
        basePath: "m/44'/501'/0'/1",
        name: 'fake sol acc 1',
        pathIndex: 0,
        publicKey: '0x0',
        signerType: SignerType.ed25519sol,
        walletType: WalletType.mnemonic,
        isHardware: false,
        isTestWallet: true,
      };
      allKeys['tQvduDby4rvC6VU4rSirhVWuRYxbJz3rvUrVMkUWsZP'] = {
        address: 'tQvduDby4rvC6VU4rSirhVWuRYxbJz3rvUrVMkUWsZP',
        basePath: "m/44'/501'/0'/1",
        name: 'fake sol acc 2',
        pathIndex: 0,
        publicKey: '0x0',
        signerType: SignerType.ed25519sol,
        walletType: WalletType.mnemonic,
        isHardware: false,
        isTestWallet: true,
      };
    }
    return allKeys;
  }
  /**
   * Gets all accounts, optionally filtered by signer type
   * @param types - Optional array of signer types to filter by
   * @returns Array of EnkryptAccount objects
   * @example
   * ```typescript
   * const allAccounts = await publicKeyring.getAccounts();
   * const evmAccounts = await publicKeyring.getAccounts([SignerType.secp256k1]);
   * ```
   */
  async getAccounts(types?: SignerType[]): Promise<EnkryptAccount[]> {
    return this.getKeysObject().then(keysObject => {
      const records = Object.values(keysObject);
      return types
        ? records.filter(r => types.includes(r.signerType))
        : records;
    });
  }
  /**
   * Gets a specific account by address
   * @param address - The account address to retrieve
   * @returns The EnkryptAccount for the specified address
   * @throws {Error} When address doesn't exist in keyring
   * @example
   * ```typescript
   * const account = await publicKeyring.getAccount('0x742d35Cc...');
   * ```
   */
  async getAccount(address: string): Promise<EnkryptAccount> {
    const allKeys = await this.getKeysObject();
    if (!allKeys[address]) {
      throw new Error(Errors.KeyringErrors.AddressDoesntExists);
    }
    return allKeys[address];
  }
  /**
   * Checks if the keyring is currently locked
   * @returns True if keyring is locked, false otherwise
   */
  isLocked(): boolean {
    return this.#keyring.isLocked();
  }
  /**
   * Checks if the keyring has been initialized
   * @returns Promise resolving to true if keyring is initialized
   */
  isInitialized(): Promise<boolean> {
    return this.#keyring.isInitialized();
  }
  /**
   * Checks if an account with the given address already exists
   * @param newAddress - The address to check for existing account
   * @returns Promise resolving to true if account already exists
   * @example
   * ```typescript
   * const exists = await publicKeyring.accountAlreadyAdded('0x742d35Cc...');
   * if (!exists) {
   *   // Safe to add new account
   * }
   * ```
   */
  async accountAlreadyAdded(newAddress: string): Promise<boolean> {
    newAddress = newAddress.toLowerCase();

    const allAccounts = await this.getAccounts();

    let alreadyExists = false;

    for (const account of allAccounts) {
      if (account.address.toLowerCase() === newAddress) {
        alreadyExists = true;
        break;
      }
    }

    return alreadyExists;
  }
}

/**
 * Public keyring interface for read-only wallet operations
 */
export default PublicKeyRing;
