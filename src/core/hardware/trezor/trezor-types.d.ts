/**
 * Type definitions for Trezor Connect packages
 */

declare module "@trezor/connect-web" {
  /**
   * Trezor Connect interface for web applications
   */
  export interface TrezorConnect {
    /** Initialize Trezor Connect with configuration */
    init(config: unknown): Promise<void>;
    /** Get Ethereum public key from device */
    ethereumGetPublicKey(params: unknown): Promise<unknown>;
    /** Sign Ethereum message */
    ethereumSignMessage(params: unknown): Promise<unknown>;
    /** Sign Ethereum transaction */
    ethereumSignTransaction(params: unknown): Promise<unknown>;
    /** Sign Ethereum typed data (EIP-712) */
    ethereumSignTypedData(params: unknown): Promise<unknown>;
    /** Get address for various cryptocurrencies */
    getAddress(params: unknown): Promise<unknown>;
    /** Sign message for various cryptocurrencies */
    signMessage(params: unknown): Promise<unknown>;
    /** Sign transaction for various cryptocurrencies */
    signTransaction(params: unknown): Promise<unknown>;
    /** Get Solana address from device */
    solanaGetAddress(params: unknown): Promise<unknown>;
    /** Sign Solana transaction */
    solanaSignTransaction(params: unknown): Promise<unknown>;
  }
  
  const TrezorConnect: TrezorConnect;
  export default TrezorConnect;
}

declare module "@trezor/connect-webextension" {
  import type { TrezorConnect } from "@trezor/connect-web";
  const TrezorConnect: TrezorConnect;
  export default TrezorConnect;
}

declare module "@trezor/connect/lib/utils/pathUtils" {
  export function getHDPath(path: string): string;
}

declare module "@trezor/connect-plugin-ethereum" {
  function transformTypedData(params: unknown): unknown;
  export default transformTypedData;
}

declare module "@ethereumjs/tx" {
  /**
   * EIP-1559 transaction with fee market
   */
  export class FeeMarketEIP1559Transaction {
    /** Create new EIP-1559 transaction */
    constructor(txData: unknown, opts?: unknown);
    /** Serialize transaction to buffer */
    serialize(): Buffer;
    /** Get message to sign */
    getMessageToSign(): Buffer;
    /** Get raw transaction data */
    raw(): unknown[];
  }
  
  /**
   * Legacy transaction format
   */
  export class LegacyTransaction {
    /** Create new legacy transaction */
    constructor(txData: unknown, opts?: unknown);
    /** Serialize transaction to buffer */
    serialize(): Buffer;
    /** Get message to sign */
    getMessageToSign(): Buffer;
    /** Get raw transaction data */
    raw(): unknown[];
  }
  
  export const TransactionFactory: {
    /** Create transaction from data */
    fromTxData(txData: unknown, opts?: unknown): LegacyTransaction | FeeMarketEIP1559Transaction;
  };
}

declare module "@ethereumjs/util" {
  export function publicToAddress(pubKey: Buffer, sanitize?: boolean): Buffer;
  export function toRpcSig(v: number, r: Buffer, s: Buffer, chainId?: number): string;
}