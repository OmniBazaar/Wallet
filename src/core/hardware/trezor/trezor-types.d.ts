/**
 * Type definitions for Trezor Connect packages
 */

declare module "@trezor/connect-web" {
  /**
   *
   */
  export interface TrezorConnect {
    /**
     *
     */
    init(config: any): Promise<void>;
    /**
     *
     */
    ethereumGetPublicKey(params: any): Promise<any>;
    /**
     *
     */
    ethereumSignMessage(params: any): Promise<any>;
    /**
     *
     */
    ethereumSignTransaction(params: any): Promise<any>;
    /**
     *
     */
    ethereumSignTypedData(params: any): Promise<any>;
    /**
     *
     */
    getAddress(params: any): Promise<any>;
    /**
     *
     */
    signMessage(params: any): Promise<any>;
    /**
     *
     */
    signTransaction(params: any): Promise<any>;
    /**
     *
     */
    solanaGetAddress(params: any): Promise<any>;
    /**
     *
     */
    solanaSignTransaction(params: any): Promise<any>;
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
  function transformTypedData(params: any): any;
  export default transformTypedData;
}

declare module "@ethereumjs/tx" {
  /**
   *
   */
  export class FeeMarketEIP1559Transaction {
    /**
     *
     */
    constructor(txData: any, opts?: any);
    /**
     *
     */
    serialize(): Buffer;
    /**
     *
     */
    getMessageToSign(): Buffer;
    /**
     *
     */
    raw(): any[];
  }
  
  /**
   *
   */
  export class LegacyTransaction {
    /**
     *
     */
    constructor(txData: any, opts?: any);
    /**
     *
     */
    serialize(): Buffer;
    /**
     *
     */
    getMessageToSign(): Buffer;
    /**
     *
     */
    raw(): any[];
  }
  
  export const TransactionFactory: {
    /**
     *
     */
    fromTxData(txData: any, opts?: any): LegacyTransaction | FeeMarketEIP1559Transaction;
  };
}

declare module "@ethereumjs/util" {
  export function publicToAddress(pubKey: Buffer, sanitize?: boolean): Buffer;
  export function toRpcSig(v: number, r: Buffer, s: Buffer, chainId?: number): string;
}