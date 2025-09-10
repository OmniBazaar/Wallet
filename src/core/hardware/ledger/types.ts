// Minimal type stubs to satisfy strict mode for Ledger providers

/**
 * Path type for Ledger derivation paths
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
 * Address response from Ledger device
 */
export type AddressResponse = {
  /** Derived address */
  address: string;
  /** Public key for the address */
  publicKey: string;
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
  primaryType: string;
  /** Message content */
  message: Record<string, unknown>;
  /** Type definitions */
  types: Record<string, Array<{
    /** Field name */
    name: string;
    /** Field type */
    type: string;
  }>>;
  /** EIP-712 version */
  version: string;
  /** Domain separator */
  domain: Record<string, unknown>;
  /** Path type for derivation */
  pathType: PathType;
  /** Index in the derivation path */
  pathIndex: number;
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
 * Hardware wallet provider interface
 */
export interface HWWalletProvider {
  /** Initialize the hardware wallet connection */
  init(): Promise<boolean>;
  /** Get address from the hardware wallet */
  getAddress(options: GetAddressRequest): Promise<AddressResponse>;
  /** Sign a personal message */
  signPersonalMessage(options: SignMessageRequest): Promise<string>;
  /** Sign a transaction */
  signTransaction(options: SignTransactionRequest): Promise<string>;
  /** Sign a typed message (EIP-712) */
  signTypedMessage(options: SignTypedMessageRequest): Promise<string>;
}

/**
 * Bitcoin sign message request
 */
export interface BitcoinSignMessage extends SignMessageRequest {
  /** Message type */
  type?: string;
  /** PSBT transaction */
  psbtTx?: {
    /** Convert to base64 */
    toBase64(): string;
    /** Transaction data */
    data: unknown;
    /** Update global data */
    updateGlobal(data: unknown): void;
    /** Update input data */
    updateInput(index: number, data: unknown): void;
    /** Finalize all inputs */
    finalizeAllInputs(): void;
    /** Extract the transaction */
    extractTransaction(): unknown;
    /** Transaction outputs */
    txOutputs?: unknown[];
    /** Transaction inputs */
    txInputs?: unknown[];
  };
}

/**
 * Bitcoin sign transaction request
 */
export interface BTCSignTransaction extends SignTransactionRequest {
  /** PSBT transaction */
  psbtTx?: BitcoinSignMessage['psbtTx'];
  /** Transaction outputs */
  outputs?: Array<{
    /** Output value */
    value: number;
    /** Output address */
    address: string;
  }>;
  /** Additional data */
  data?: string;
  /** Raw transactions */
  rawTxs?: string[];
}

/**
 * Solana sign transaction request
 */
export interface SolSignTransaction {
  /** Solana transaction buffer */
  solTx: Buffer;
}