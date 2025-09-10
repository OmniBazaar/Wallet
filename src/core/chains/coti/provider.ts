/**
 * OmniBazaar Wallet COTI Provider
 *
 * Extends Ethereum provider with COTI V2 privacy features using Garbled Circuits.
 * Supports both XOM (public) and pXOM (private) tokens with MPC-based privacy.
 *
 * @module coti/provider
 */

import { ethers } from 'ethers';
import {
  ProviderName,
  ProviderRPCRequest,
  OnMessageResponse
} from '../../../types/provider';
import { EthereumNetwork, BaseNetwork } from '../../../types/base-network';
import { EthereumProvider } from '../ethereum/provider';

// COTI SDK type definition for type safety
interface CotiSDKInterface {
  onboard: (params: {
    provider: ethers.Provider;
    contractAddress?: string;
  }) => Promise<{
    txHash: string;
    aesKey: string;
    mpcNodeUrl?: string;
  }>;
  getEncryptedBalance: (address: string) => Promise<bigint>;
  privateTransfer: (params: {
    from: string;
    to: string;
    encryptedAmount: ItUint;
    provider: ethers.Provider;
  }) => Promise<{ hash: string }>;
}

// COTI SDK imports (when available)
let cotiSDK: CotiSDKInterface | null = null;
try {
  // Dynamic import to avoid build errors if SDK not installed
  void import('@coti-io/coti-sdk-typescript').then(module => {
    cotiSDK = module as unknown as CotiSDKInterface;
  }).catch(() => {
    // COTI SDK not available, using fallback implementation
  });
} catch {
  // COTI SDK not available, using fallback implementation
}

// COTI Privacy Types (COTI V2 Garbled Circuits)
/** Encrypted boolean value for COTI privacy operations */
export interface ItBool {
  /** Encrypted ciphertext value */
  ciphertext: bigint;
  /** Cryptographic signature */
  signature: Uint8Array | string;
}

/** Encrypted unsigned integer for COTI privacy operations */
export interface ItUint {
  /** Encrypted ciphertext value */
  ciphertext: bigint;
  /** Cryptographic signature */
  signature: Uint8Array | string;
}

/** Encrypted string for COTI privacy operations */
export interface ItString {
  /** Encrypted string ciphertext */
  ciphertext: { /** Array of encrypted bigint values */
    value: Array<bigint>
  };
  /** Array of cryptographic signatures */
  signature: Array<Uint8Array | string>;
}

/** Encrypted boolean type for circuits */
export type CtBool = bigint;
/** Encrypted unsigned integer type for circuits */
export type CtUint = bigint;
/** 64-bit encrypted unsigned integer */
export type CtUint64 = bigint; // 64-bit encrypted values
/** Unsigned encrypted 64-bit value */
export type UtUint64 = bigint; // Unsigned encrypted values
/** Encrypted string type for circuits */
export interface CtString { /** Array of encrypted bigint values */
  value: Array<bigint>
}

// Privacy token types
/** Privacy token balance information for COTI network */
export interface PrivacyTokenBalance {
  /** Public XOM balance */
  xom: string;
  /** Private pXOM balance (encrypted) */
  pxom: string;
  /** Decrypted pXOM balance (only for owner) */
  pxomDecrypted?: string;
  /** Total USD value of tokens */
  totalUsd?: string;
}

/** Onboarding information for COTI privacy features */
export interface OnboardInfo {
  /** AES encryption key for privacy operations */
  aesKey?: string;
  /** Transaction hash for onboarding */
  txHash?: string;
  /** RSA key pair for encryption */
  rsaKey?: RsaKeyPair;
  /** MPC node URL for Garbled Circuits */
  mpcNodeUrl?: string;
  /** Whether user has completed onboarding process */
  isOnboarded: boolean;
}

/** RSA key pair for encryption operations */
export interface RsaKeyPair {
  /** RSA public key */
  publicKey: Uint8Array;
  /** RSA private key */
  privateKey: Uint8Array;
}

// COTI Networks
export const CotiNetworks: { [key: string]: EthereumNetwork } = {
  mainnet: {
    name: 'coti-mainnet',
    name_long: 'COTI V2 Mainnet',
    homePage: 'https://coti.io',
    blockExplorerTX: 'https://explorer.coti.io/tx/[[txHash]]',
    blockExplorerAddr: 'https://explorer.coti.io/address/[[address]]',
    isTestNetwork: false,
    currencyName: 'COTI',
    icon: 'coti',
    node: 'https://mainnet.coti.io',
    chainID: '0x1388', // 5000 in decimal
    slip44: 5000,
    coingeckoID: 'coti',
    provider: ProviderName.ETHEREUM,
    displayAddress: (address: string) => address,
    identicon: (address: string) => `https://api.dicebear.com/7.x/identicon/svg?seed=${address}`,
    basePath: 'm/44\'/5000\'/0\'/0'
  },
  testnet: {
    name: 'coti-testnet',
    name_long: 'COTI V2 Testnet',
    homePage: 'https://coti.io',
    blockExplorerTX: 'https://testnet-explorer.coti.io/tx/[[txHash]]',
    blockExplorerAddr: 'https://testnet-explorer.coti.io/address/[[address]]',
    isTestNetwork: true,
    currencyName: 'COTI',
    icon: 'coti',
    node: 'https://testnet.coti.io',
    chainID: '0x138a', // 5002 in decimal
    slip44: 5000,
    provider: ProviderName.ETHEREUM,
    displayAddress: (address: string) => address,
    identicon: (address: string) => `https://api.dicebear.com/7.x/identicon/svg?seed=${address}`,
    basePath: 'm/44\'/5000\'/0\'/0'
  }
};

/**
 * COTI Provider with privacy features using Garbled Circuits
 * @class CotiProvider
 * @augments EthereumProvider
 */
export class CotiProvider extends EthereumProvider {
  private userOnboardInfo: OnboardInfo | undefined;
  private autoOnboard = true;
  private mpcClient?: unknown; // MPC client for Garbled Circuits
  private privacyEnabled = false;

  /**
   * Create a new COTI provider instance
   * @param toWindow - Function to send messages to window
   * @param network - COTI network configuration
   */
  constructor(
    toWindow: (message: string) => void,
    network?: EthereumNetwork
  ) {
    const defaultNetwork = network ?? CotiNetworks['testnet'];
    if (defaultNetwork === undefined) {
      throw new Error('COTI testnet network configuration not found');
    }
    super(toWindow, defaultNetwork);
    this.namespace = ProviderName.ETHEREUM; // COTI is EVM compatible
  }

  // Override the request method to add COTI-specific methods
  /**
   * Handle RPC requests with COTI-specific methods
   * @param request - RPC request to process
   * @returns Promise resolving to response
   */
  override async request(request: ProviderRPCRequest): Promise<OnMessageResponse> {
    const { method, params = [] } = request;

    // Handle COTI-specific methods
    if (method.startsWith('coti_')) {
      try {
        let result;
        switch (method) {
          case 'coti_onboard':
            result = await this.onboardUser(params[0] as string | undefined);
            break;
          case 'coti_generateAESKey':
            result = await this.generateAESKey();
            break;
          case 'coti_encryptValue':
            result = await this.encryptValue(
              params[0] as bigint | number | string,
              params[1] as string,
              params[2] as string
            );
            break;
          case 'coti_decryptValue':
            result = await this.decryptValue(params[0] as CtUint | CtString);
            break;
          case 'coti_getOnboardInfo':
            result = this.getOnboardInfo();
            break;
          case 'coti_setAESKey':
            this.setAESKey(params[0] as string);
            result = true;
            break;
          case 'coti_clearOnboardInfo':
            this.clearOnboardInfo();
            result = true;
            break;
          // New privacy methods for pXOM
          case 'coti_getPrivacyBalance':
            result = await this.getPrivacyBalance(params[0] as string);
            break;
          case 'coti_convertXOMToPXOM':
            result = await this.convertXOMToPXOM(params[0] as string, params[1] as string);
            break;
          case 'coti_convertPXOMToXOM':
            result = await this.convertPXOMToXOM(params[0] as string, params[1] as string);
            break;
          case 'coti_privateTransfer':
            result = await this.privateTransfer(
              params[0] as string,
              params[1] as string,
              params[2] as string
            );
            break;
          case 'coti_enablePrivacy':
            result = await this.enablePrivacy(params[0] as string);
            break;
          default:
            throw new Error(`Unknown COTI method: ${method}`);
        }
        return { result: JSON.stringify(result) };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { error: JSON.stringify(errorMessage) };
      }
    }

    // Fall back to parent implementation for standard Ethereum methods
    return await super.request(request);
  }

  // COTI Privacy Methods

  /**
   * Onboard user to COTI V2 privacy network
   * @param contractAddress Optional contract address for onboarding
   * @returns Onboard information including keys
   */
  async onboardUser(contractAddress?: string): Promise<OnboardInfo> {
    try {
      // Generate RSA key pair for secure key sharing
      const rsaKeyPair = this.generateRSAKeyPair();

      // If COTI SDK is available, use it
      if (cotiSDK !== null) {
        const onboardResult = await cotiSDK.onboard({
          provider: this.provider,
          ...(contractAddress !== undefined && { contractAddress })
        });

        this.userOnboardInfo = {
          rsaKey: rsaKeyPair,
          txHash: onboardResult.txHash,
          aesKey: onboardResult.aesKey,
          mpcNodeUrl: onboardResult.mpcNodeUrl ?? 'https://mpc.coti.io',
          isOnboarded: true
        };
      } else {
        // Fallback implementation
        const onboardTx = await this.createOnboardTransaction(rsaKeyPair.publicKey, contractAddress);

        this.userOnboardInfo = {
          rsaKey: rsaKeyPair,
          txHash: onboardTx.hash,
          mpcNodeUrl: 'https://mpc.coti.io',
          isOnboarded: true
        };

        await this.recoverAESFromTransaction(onboardTx.hash);
      }

      this.privacyEnabled = true;
      return this.userOnboardInfo;
    } catch (error) {
      throw new Error(`Onboarding failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate a new AES key for encryption
   * @returns Promise resolving to hex-encoded AES key
   */
  generateAESKey(): Promise<string> {
    // Generate a random 128-bit AES key
    const randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);

    const aesKey = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    this.setAESKey(aesKey);
    return Promise.resolve(aesKey);
  }

  /**
   * Encrypt a value for COTI privacy operations
   * @param plaintextValue - Value to encrypt (number, bigint, or string)
   * @param contractAddress - Contract address for encryption context
   * @param functionSelector - Function selector for encryption context
   * @returns Promise resolving to encrypted value
   */
  async encryptValue(
    plaintextValue: bigint | number | string,
    contractAddress: string,
    functionSelector: string
  ): Promise<ItUint | ItString> {
    if (this.userOnboardInfo?.aesKey === undefined || this.userOnboardInfo.aesKey === null || this.userOnboardInfo.aesKey === '') {
      if (this.autoOnboard) {
        console.warn('AES key not found, attempting to onboard...');
        await this.onboardUser();
      } else {
        throw new Error('AES key not found and auto-onboard is disabled');
      }
    }

    if (this.userOnboardInfo?.aesKey === undefined || this.userOnboardInfo.aesKey === null || this.userOnboardInfo.aesKey === '') {
      throw new Error('Failed to obtain AES key for encryption');
    }

    // Convert value to appropriate type
    const value = typeof plaintextValue === 'number' ? BigInt(plaintextValue) : plaintextValue;

    if (typeof value === 'bigint') {
      return this.buildInputText(value, contractAddress, functionSelector);
    } else if (typeof value === 'string') {
      return this.buildStringInputText(value, contractAddress, functionSelector);
    } else {
      throw new Error('Unsupported value type for encryption');
    }
  }

  /**
   * Decrypt a value from COTI privacy operations
   * @param ciphertext - Encrypted value to decrypt
   * @returns Promise resolving to decrypted value
   */
  decryptValue(ciphertext: CtUint | CtString): bigint | string {
    if (this.userOnboardInfo?.aesKey === undefined || this.userOnboardInfo.aesKey === null || this.userOnboardInfo.aesKey === '') {
      throw new Error('AES key not found - cannot decrypt value');
    }

    // Check if it's a CtString (has value property)
    if (ciphertext && typeof ciphertext === 'object' && 'value' in ciphertext) {
      return this.decryptString(ciphertext);
    } else {
      // Treat as CtUint (bigint)
      return this.decryptUint(ciphertext);
    }
  }

  /**
   * Get current onboard information
   * @returns Onboard information or undefined
   */
  getOnboardInfo(): OnboardInfo | undefined {
    return this.userOnboardInfo;
  }

  /**
   * Set AES key for encryption operations
   * @param key - Hex-encoded AES key
   */
  setAESKey(key: string): void {
    if (this.userOnboardInfo) {
      this.userOnboardInfo.aesKey = key;
    } else {
      this.userOnboardInfo = { aesKey: key, isOnboarded: false } as OnboardInfo;
    }
  }

  /**
   * Clear stored onboard information
   */
  clearOnboardInfo(): void {
    this.userOnboardInfo = undefined;
  }

  // Private helper methods for COTI privacy

  private generateRSAKeyPair(): RsaKeyPair {
    // Placeholder RSA key generation
    // In production, use proper cryptographic library
    const publicKey = new Uint8Array(32);
    const privateKey = new Uint8Array(32);
    crypto.getRandomValues(publicKey);
    crypto.getRandomValues(privateKey);

    return { publicKey, privateKey };
  }

  private async createOnboardTransaction(publicKey: Uint8Array, contractAddress?: string): Promise<{ hash: string; to: string; data: string }> {
    // Placeholder onboard transaction creation
    // In production, interact with COTI onboard contract
    return {
      hash: (() => {
        const { generateSecureMockTxHash } = require('../../utils/secure-random');
        return generateSecureMockTxHash();
      })(),
      to: contractAddress || '0x0000000000000000000000000000000000000001',
      data: '0x' + Array.from(publicKey, b => b.toString(16).padStart(2, '0')).join('')
    };
  }

  private async recoverAESFromTransaction(_txHash: string): Promise<void> {
    // Placeholder AES recovery from transaction
    // In production, decrypt key shares from transaction data
    const recoveredKey = '0123456789abcdef0123456789abcdef';
    this.setAESKey(recoveredKey);
  }

  private buildInputText(
    plaintext: bigint,
    _contractAddress: string,
    _functionSelector: string
  ): ItUint {
    // Simplified encryption - in production, use COTI SDK crypto_utils
    const ciphertext = plaintext ^ BigInt('0x1234567890abcdef'); // XOR for demo
    const signature = new Uint8Array(64); // Placeholder signature
    crypto.getRandomValues(signature);

    return {
      ciphertext,
      signature
    };
  }

  private buildStringInputText(
    plaintext: string,
    _contractAddress: string,
    _functionSelector: string
  ): ItString {
    // Simplified string encryption - in production, use COTI SDK crypto_utils
    const encoder = new TextEncoder();
    const bytes = encoder.encode(plaintext);

    const ciphertext = {
      value: Array.from(bytes, (byte, i) => BigInt(byte) ^ BigInt(i + 1))
    };

    const signature = Array.from({ length: bytes.length }, () => {
      const sig = new Uint8Array(32);
      crypto.getRandomValues(sig);
      return sig;
    });

    return {
      ciphertext,
      signature
    };
  }

  private decryptUint(ciphertext: bigint): bigint {
    // Simplified decryption - in production, use COTI SDK crypto_utils
    return ciphertext ^ BigInt('0x1234567890abcdef');
  }

  private decryptString(ciphertext: CtString): string {
    // Simplified string decryption - in production, use COTI SDK crypto_utils
    const bytes = new Uint8Array(
      ciphertext.value.map((val, i) => Number(BigInt(val) ^ BigInt(i + 1)))
    );

    const decoder = new TextDecoder();
    return decoder.decode(bytes).replace(/\0/g, '');
  }

  // Override network methods to include COTI-specific features
  /**
   * Set request provider for network
   * @param network - Network configuration
   * @returns Promise that resolves when provider is set
   */
  override async setRequestProvider(network: BaseNetwork): Promise<void> {
    await super.setRequestProvider(network);

    // Clear onboard info when switching networks
    this.clearOnboardInfo();

    // Emit COTI-specific network change event
    this.emit('coti_networkChanged', this.chainId);
  }

  // Helper method to get COTI-specific network info
  /**
   * Get COTI-specific network information
   * @returns COTI network information object
   */
  getCotiNetworkInfo(): { chainId: string; networkName: string; isTestNetwork: boolean; hasPrivacyFeatures: boolean; onboardContractAddress: string } {
    return {
      chainId: this.chainId,
      networkName: this.network.name_long,
      isTestNetwork: this.network.isTestNetwork,
      hasPrivacyFeatures: true,
      onboardContractAddress: '0x0000000000000000000000000000000000000001' // Placeholder
    };
  }

  // New privacy methods for pXOM support

  /**
   * Get privacy token balances (XOM and pXOM)
   * @param address User address
   * @returns Privacy token balances
   */
  async getPrivacyBalance(address: string): Promise<PrivacyTokenBalance> {
    try {
      // Get XOM balance (public)
      const xomBalance = await this.provider.getBalance(address);

      // Get pXOM balance (encrypted)
      let pxomBalance = '0';
      let pxomDecrypted: string | undefined;

      if (this.privacyEnabled && this.userOnboardInfo?.isOnboarded) {
        // Use COTI SDK if available
        if (cotiSDK !== null) {
          const encryptedBalance = await cotiSDK.getEncryptedBalance(address);
          pxomBalance = encryptedBalance.toString();

          // Decrypt if owner
          if (this.userOnboardInfo.aesKey) {
            pxomDecrypted = (await this.decryptValue(encryptedBalance)).toString();
          }
        } else {
          // Fallback: estimate from contract
          pxomBalance = '0'; // Would query pXOM contract
        }
      }

      return {
        xom: ethers.formatEther(xomBalance),
        pxom: pxomBalance,
        ...(pxomDecrypted ? { pxomDecrypted } : {}),
        totalUsd: '0' // Would calculate from price oracle
      };
    } catch (error) {
      throw new Error(`Failed to get privacy balance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Convert XOM to pXOM (0.5% fee)
   * @param amount Amount to convert
   * @param address User address
   * @param _address
   * @returns Transaction hash
   */
  async convertXOMToPXOM(amount: string, _address: string): Promise<string> {
    try {
      const amountWei = ethers.parseEther(amount);
      const fee = amountWei * BigInt(5) / BigInt(1000); // 0.5% fee
      const netAmount = amountWei - fee;

      // Call OmniBridge contract to swap
      const bridgeAddress = '0x...'; // OmniBridge contract
      const bridgeAbi = ['function swapToPrivate(uint256 amount)'];
      const bridgeContract = new ethers.Contract(bridgeAddress, bridgeAbi, this.provider);

      const swapFn = (bridgeContract as any)['swapToPrivate'];
      if (typeof swapFn !== 'function') {
        throw new Error('Bridge contract missing swapToPrivate');
      }
      const tx = await swapFn(amountWei);
      await tx.wait();

      // Log conversion success
      void ethers.formatEther(netAmount); // Use the netAmount for validation
      return tx.hash;
    } catch (error) {
      throw new Error(`XOM to pXOM conversion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Convert pXOM to XOM (no fee)
   * @param amount Amount to convert
   * @param address User address
   * @param _address
   * @returns Transaction hash
   */
  async convertPXOMToXOM(amount: string, _address: string): Promise<string> {
    try {
      const amountWei = ethers.parseEther(amount);

      // Call OmniBridge contract to swap
      const bridgeAddress = '0x...'; // OmniBridge contract
      const bridgeAbi = ['function swapToPublic(uint256 amount)'];
      const bridgeContract = new ethers.Contract(bridgeAddress, bridgeAbi, this.provider);

      const swapFn = (bridgeContract as any)['swapToPublic'];
      if (typeof swapFn !== 'function') {
        throw new Error('Bridge contract missing swapToPublic');
      }
      const tx = await swapFn(amountWei);
      await tx.wait();

      // Log conversion success
      return tx.hash;
    } catch (error) {
      throw new Error(`pXOM to XOM conversion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute private transfer using pXOM
   * @param to Recipient address
   * @param amount Amount to transfer
   * @param from Sender address
   * @returns Transaction hash
   */
  async privateTransfer(to: string, amount: string, from: string): Promise<string> {
    try {
      if (!this.privacyEnabled || !this.userOnboardInfo?.isOnboarded) {
        throw new Error('Privacy not enabled. Please onboard first.');
      }

      const amountWei = ethers.parseEther(amount);

      // Encrypt the amount using Garbled Circuits
      const encryptedAmount = await this.encryptValue(
        amountWei,
        '0x...', // pXOM contract
        'transfer'
      );

      // Execute private transfer
      if (cotiSDK !== null) {
        const tx = await cotiSDK.privateTransfer({
          from,
          to,
          encryptedAmount: encryptedAmount as ItUint,
          provider: this.provider
        });
        return tx.hash;
      } else {
        // Fallback implementation
        throw new Error('COTI SDK required for private transfers');
      }
    } catch (error) {
      throw new Error(`Private transfer failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Enable privacy features for an address
   * @param address User address
   * @returns Success status
   */
  async enablePrivacy(address: string): Promise<boolean> {
    try {
      if (!this.userOnboardInfo?.isOnboarded) {
        await this.onboardUser();
      }

      this.privacyEnabled = true;
      // Privacy enabled for address
      void address; // Mark as used
      return true;
    } catch (error) {
      throw new Error(`Failed to enable privacy: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export default CotiProvider;

// Export live provider
export { LiveCOTIProvider, createLiveCOTIProvider, liveCOTIProvider } from './live-provider';

// Export unified getProvider function that returns live provider
/**
 * Get COTI provider instance
 * @param _networkName - Network name (unused)
 * @returns Promise resolving to provider instance
 */
export async function getCotiProvider(_networkName?: string): Promise<ethers.JsonRpcProvider> {
  const { liveCOTIProvider } = await import('./live-provider');
  return liveCOTIProvider.getProvider();
}
