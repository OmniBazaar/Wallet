import KeyRing from '@enkryptcom/keyring';
import { InternalStorageNamespace } from '@/types/provider';
import BrowserStorage from '../common/browser-storage';
import type { EnkryptAccount, HWWalletAdd, KeyPairAdd, KeyRecordAdd, MnemonicWithExtraWord, SignOptions } from '@enkryptcom/types';
import { SignerType, WalletType } from '@enkryptcom/types';

/**
 * Base keyring class that provides core wallet functionality
 * Handles account creation, signing, encryption, and hardware wallet integration
 * @example
 * ```typescript
 * const keyring = new KeyRingBase();
 * await keyring.init({ mnemonic: '...', password: 'secure-password' });
 * const account = await keyring.getNewAccount({ basePath: "m/44'/60'/0'/0", signerType: SignerType.secp256k1 });
 * ```
 */
export class KeyRingBase {
  /** Private keyring instance from Enkrypt library */
  #keyring: any;
  
  /**
   * Creates a new keyring base instance with browser storage
   */
  constructor() {
    const browserStorage = new BrowserStorage(InternalStorageNamespace.KEYRING);
    this.#keyring = new KeyRing(browserStorage);
  }
  /**
   * Initializes the keyring with a mnemonic phrase and password
   * @param options - Initialization options
   * @param options.mnemonic - The BIP39 mnemonic phrase
   * @param options.password - Password to encrypt the keyring
   * @param options.extraWord - Optional extra word for additional security
   * @returns Promise that resolves when initialization is complete
   * @throws {Error} When initialization fails
   */
  init(options: {
    mnemonic: string;
    password: string;
    extraWord?: string;
  }): Promise<void> {
    return this.#keyring.init(options.password, {
      mnemonic: options.mnemonic,
      extraWord: options.extraWord,
    });
  }
  /**
   * Resets all keyring data by clearing all storage namespaces
   * @returns Promise that resolves when reset is complete
   * @example
   * ```typescript
   * await keyring.reset(); // Clears all wallet data
   * ```
   */
  async reset(): Promise<void> {
    const resetPromises = Object.values(InternalStorageNamespace).map(name =>
      new BrowserStorage(name).clear(),
    );
    await Promise.all(resetPromises);
  }
  /**
   * Creates a new account from the mnemonic with specified derivation path
   * @param options - Account creation options
   * @param options.basePath - HD wallet derivation path (e.g., "m/44'/60'/0'/0")
   * @param options.signerType - Type of cryptographic signer to use
   * @returns Promise resolving to the new EnkryptAccount
   * @example
   * ```typescript
   * const account = await keyring.getNewAccount({
   *   basePath: "m/44'/60'/0'/0",
   *   signerType: SignerType.secp256k1
   * });
   * ```
   */
  getNewAccount(options: {
    basePath: string;
    signerType: SignerType;
  }): Promise<EnkryptAccount> {
    return this.#keyring.createKey({
      name: '',
      basePath: options.basePath,
      signerType: options.signerType,
      walletType: WalletType.mnemonic,
    });
  }
  /**
   * Creates and saves a new account with the given options
   * @param options - Key record creation options
   * @returns Promise resolving to the saved EnkryptAccount
   */
  saveNewAccount(options: KeyRecordAdd): Promise<EnkryptAccount> {
    return this.#keyring.createAndSaveKey(options);
  }
  /**
   * Signs a hex-encoded message with the specified account
   * @param hexMessage - The message to sign in hex format
   * @param options - Signing options including account address and password
   * @returns Promise resolving to the hex-encoded signature
   * @throws {Error} When signing fails or account is locked
   * @example
   * ```typescript
   * const signature = await keyring.sign('0x1234...', {
   *   address: '0x742d35Cc...',
   *   password: 'account-password'
   * });
   * ```
   */
  sign(
    hexMessage: `0x${string}`,
    options: SignOptions,
  ): Promise<`0x${string}`> {
    return this.#keyring
      .sign(hexMessage, options)
      .then((hex: string) => hex as `0x${string}`);
  }
  /**
   * Gets the Ethereum encryption public key for the specified account
   * @param options - Options including account address and password
   * @returns Promise resolving to the base64-encoded public key
   * @throws {Error} When account is not found or locked
   */
  getEthereumEncryptionPublicKey(options: SignOptions): Promise<string> {
    return this.#keyring.getEthereumEncryptionPublicKey(options);
  }
  /**
   * Decrypts an Ethereum-encrypted message using the account's private key
   * @param encryptedMessage - The encrypted message to decrypt
   * @param options - Decryption options including account address and password
   * @returns Promise resolving to the decrypted message
   * @throws {Error} When decryption fails or account is locked
   */
  ethereumDecrypt(
    encryptedMessage: string,
    options: SignOptions,
  ): Promise<string> {
    return this.#keyring.ethereumDecrypt(encryptedMessage, options);
  }
  /**
   * Gets all stored accounts as an array
   * @returns Promise resolving to array of EnkryptAccount objects
   */
  getKeysArray(): Promise<EnkryptAccount[]> {
    return this.#keyring.getKeysArray();
  }
  /**
   * Gets all stored accounts as an object mapping addresses to accounts
   * @returns Promise resolving to object with address keys and EnkryptAccount values
   */
  getKeysObject(): Promise<{ [key: string]: EnkryptAccount }> {
    return this.#keyring.getKeysObject();
  }
  /**
   * Adds a hardware wallet account to the keyring
   * @param account - Hardware wallet account details
   * @returns Promise resolving to the added EnkryptAccount
   * @throws {Error} When hardware wallet connection fails
   */
  addHWAccount(account: HWWalletAdd): Promise<EnkryptAccount> {
    return this.#keyring.addHWAccount(account);
  }
  /**
   * Adds a key pair account to the keyring
   * @param account - Key pair account details
   * @param password - Password to encrypt the key pair
   * @returns Promise resolving to the added EnkryptAccount
   * @throws {Error} When key pair is invalid or password is wrong
   */
  addKeyPair(account: KeyPairAdd, password: string): Promise<EnkryptAccount> {
    return this.#keyring.addKeyPair(account, password);
  }
  /**
   * Checks if the keyring is currently locked
   * @returns True if keyring is locked, false if unlocked
   */
  isLocked(): boolean {
    return this.#keyring.isLocked();
  }
  /**
   * Unlocks the keyring with the provided password
   * @param password - The keyring password
   * @returns Promise that resolves when unlock is successful
   * @throws {Error} When password is incorrect
   */
  unlock(password: string): Promise<void> {
    return this.#keyring.unlockMnemonic(password);
  }
  /**
   * Locks the keyring, clearing all decrypted data from memory
   */
  lock(): void {
    return this.#keyring.lock();
  }
  /**
   * Retrieves the mnemonic phrase (requires correct password)
   * @param password - The keyring password
   * @returns Promise resolving to the mnemonic phrase and extra word
   * @throws {Error} When password is incorrect
   * @example
   * ```typescript
   * const { mnemonic, extraWord } = await keyring.getMnemonic('password');
   * ```
   */
  getMnemonic(password: string): Promise<MnemonicWithExtraWord> {
    return this.#keyring.getMnemonic(password);
  }
  /**
   * Checks if the keyring has been initialized with a mnemonic
   * @returns Promise resolving to true if initialized, false otherwise
   */
  isInitialized(): Promise<boolean> {
    return this.#keyring.isInitialized();
  }
  /**
   * Renames an existing account
   * @param address - The account address to rename
   * @param newName - The new name for the account
   * @returns Promise resolving to the updated EnkryptAccount
   * @throws {Error} When account address is not found
   */
  renameAccount(address: string, newName: string): Promise<EnkryptAccount> {
    return this.#keyring.renameAccount(address, newName);
  }
  /**
   * Deletes an account from the keyring
   * @param address - The account address to delete
   * @returns Promise that resolves when deletion is complete
   * @throws {Error} When account address is not found
   */
  deleteAccount(address: string): Promise<void> {
    return this.#keyring.deleteAccount(address);
  }
}

/**
 * Base keyring class for wallet operations
 */
export default KeyRingBase;
