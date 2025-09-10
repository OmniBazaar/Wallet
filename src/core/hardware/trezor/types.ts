// Minimal type stubs for Trezor providers to satisfy strict mode

/**
 * Path type for Trezor derivation paths
 */
export type PathType = {
  /** Base derivation path */
  basePath: string;
  /** Full derivation path template */
  path: string;
};

/**
 * Get address request parameters
 */
export type GetAddressRequest = {
  /** Path type for derivation */
  pathType: PathType;
  /** Index in the derivation path */
  pathIndex: number;
  /** Whether to confirm address on device */
  confirmAddress?: boolean;
};

/**
 * Address response from Trezor device
 */
export type AddressResponse = {
  /** Derived address */
  address: string;
  /** Public key for the address */
  publicKey: string;
};

/**
 * Sign transaction request parameters
 */
export type SignTransactionRequest = {
  /** Path type for derivation */
  pathType: PathType;
  /** Index in the derivation path */
  pathIndex: number;
  /** Transaction to sign */
  transaction: unknown;
};

/**
 * Sign message request parameters
 */
export type SignMessageRequest = {
  /** Path type for derivation */
  pathType: PathType;
  /** Index in the derivation path */
  pathIndex: number;
  /** Message to sign */
  message: Buffer;
};

/**
 * Sign typed message request parameters
 */
export type SignTypedMessageRequest = {
  /** Primary type of the message */
  primaryType?: string;
  /** Message content */
  message?: Record<string, unknown>;
  /** Type definitions */
  types?: Record<string, Array<{
    /** Field name */
    name: string;
    /** Field type */
    type: string;
  }>>;
  /** EIP-712 version */
  version?: string;
  /** Domain separator */
  domain?: Record<string, unknown>;
  /** Path type for derivation */
  pathType: PathType;
  /** Index in the derivation path */
  pathIndex: number;
};

/**
 * Bitcoin sign message parameters
 */
export type BitcoinSignMessage = {
  /** Path type for derivation */
  pathType: PathType;
  /** Index in the derivation path */
  pathIndex: number;
  /** Signature type */
  type: 'legacy' | 'bip322-simple';
  /** Message to sign */
  message: Buffer;
};

/**
 * Bitcoin transaction signing parameters
 */
export type BTCSignTransaction = {
  /** PSBT transaction data */
  psbtTx: {
    /** Transaction inputs */
    txInputs: Array<{
      /** Input hash */
      hash: Buffer;
      /** Input index */
      index: number;
    }>;
    /** Transaction outputs */
    txOutputs: Array<{
      /** Output value */
      value: number;
      /** Output address */
      address: string;
    }>;
  };
};

/**
 * Solana transaction signing parameters
 */
export type SolSignTransaction = {
  /** Solana transaction buffer */
  solTx: Buffer;
};

/**
 * Hardware wallet provider interface
 */
export interface HWWalletProvider {
  /** Initialize the hardware wallet connection */
  init(): Promise<boolean>;
  /** Get address from the hardware wallet */
  getAddress(options: GetAddressRequest): Promise<AddressResponse>;
  /** Sign a personal message */
  signPersonalMessage(options: unknown): Promise<string>;
  /** Sign a transaction */
  signTransaction(options: SignTransactionRequest): Promise<string>;
  /** Sign a typed message (EIP-712) */
  signTypedMessage(options: SignTypedMessageRequest): Promise<string>;
}