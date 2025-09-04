// Minimal type stubs to satisfy strict mode for Ledger providers

export type PathType = { basePath: string; path: string };

export type getAddressRequest = {
  pathType: PathType;
  pathIndex: number;
  confirmAddress?: boolean;
};

export type AddressResponse = { address: string; publicKey: string };

export type SignMessageRequest = {
  pathType: PathType;
  pathIndex: number;
  message: Buffer;
};

export type SignTypedMessageRequest = {
  primaryType: string;
  message: Record<string, unknown>;
  types: Record<string, Array<{ name: string; type: string }>>;
  version: string;
  domain: Record<string, unknown>;
  pathType: PathType;
  pathIndex: number;
};

export type SignTransactionRequest = {
  pathType: PathType;
  pathIndex: number;
  transaction: any;
};

export interface HWWalletProvider {
  init(): Promise<boolean>;
  getAddress(options: getAddressRequest): Promise<AddressResponse>;
  signPersonalMessage(options: SignMessageRequest): Promise<string>;
  signTransaction(options: SignTransactionRequest): Promise<string>;
  signTypedMessage(options: SignTypedMessageRequest): Promise<string>;
}

