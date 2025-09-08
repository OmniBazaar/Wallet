// Minimal type stubs for Trezor providers to satisfy strict mode

/**
 *
 */
export type PathType = { /**
eeeeeeeeeeeeeeeeeeeeeeeee *
eeeeeeeeeeeeeeeeeeeeeeeee */
basePath: string; /**
bbbbbbbbbbbbbbbbbb *
bbbbbbbbbbbbbbbbbb */
path: string };

/**
 *
 */
export type getAddressRequest = {
  /**
   *
   */
  pathType: PathType;
  /**
   *
   */
  pathIndex: number;
  /**
   *
   */
  confirmAddress?: boolean;
};

/**
 *
 */
export type AddressResponse = { /**
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee *
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee */
address: string; /**
aaaaaaaaaaaaaaaaa *
aaaaaaaaaaaaaaaaa */
publicKey: string };

/**
 *
 */
export type SignTransactionRequest = {
  /**
   *
   */
  pathType: PathType;
  /**
   *
   */
  pathIndex: number;
  /**
   *
   */
  transaction: any;
};

/**
 *
 */
export type SignMessageRequest = {
  /**
   *
   */
  pathType: PathType;
  /**
   *
   */
  pathIndex: number;
  /**
   *
   */
  message: Buffer;
};

/**
 *
 */
export type SignTypedMessageRequest = {
  /**
   *
   */
  primaryType?: string;
  /**
   *
   */
  message?: Record<string, unknown>;
  /**
   *
   */
  types?: Record<string, Array<{ /**
                                  *
                                  */
  name: string; /**
                 *
                 */
  type: string }>>;
  /**
   *
   */
  version?: string;
  /**
   *
   */
  domain?: Record<string, unknown>;
  /**
   *
   */
  pathType: PathType;
  /**
   *
   */
  pathIndex: number;
};

/**
 *
 */
export type BitcoinSignMessage = {
  /**
   *
   */
  pathType: PathType;
  /**
   *
   */
  pathIndex: number;
  /**
   *
   */
  type: 'legacy' | 'bip322-simple';
  /**
   *
   */
  message: Buffer;
};

/**
 *
 */
export type BTCSignTransaction = {
  /**
   *
   */
  psbtTx: { /**
             *
             */
  txInputs: Array<{ /**
                     *
                     */
  hash: Buffer; /**
                 *
                 */
  index: number }>; /**
                     *
                     */
  txOutputs: Array<{ /**
                      *
                      */
  value: number; /**
                  *
                  */
  address: string }> };
};

/**
 *
 */
export type SolSignTransaction = { /**
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee *
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee */
solTx: Buffer };

/**
 *
 */
export interface HWWalletProvider {
  /**
   *
   */
  init(): Promise<boolean>;
  /**
   *
   */
  getAddress(options: getAddressRequest): Promise<AddressResponse>;
  /**
   *
   */
  signPersonalMessage(options: any): Promise<string>;
  /**
   *
   */
  signTransaction(options: SignTransactionRequest): Promise<string>;
  /**
   *
   */
  signTypedMessage(options: SignTypedMessageRequest): Promise<string>;
}

