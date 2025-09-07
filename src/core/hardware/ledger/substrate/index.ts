import type Transport from "@ledgerhq/hw-transport";
import webUsbTransport from "@ledgerhq/hw-transport-webusb";
import { HWwalletCapabilities, NetworkNames } from "../../../types/enkrypt-types";
import { ExtrinsicPayload } from "@polkadot/types/interfaces";
import { u8aToBuffer } from "@polkadot/util";
import { LedgerApps } from "./substrateApps";
import {
  AddressResponse,
  getAddressRequest,
  HWWalletProvider,
  PathType,
  SignTransactionRequest,
  SignTypedMessageRequest,
} from "../types";
import { bip32ToAddressNList } from "./utils";
import { supportedPaths } from "./configs";
import ConnectToLedger from "../ledgerConnect";

// Type definitions for Ledger Substrate responses
interface SubstrateAddressResponse {
  address: string;
  pubKey: string;
}

interface SubstrateSignResponse {
  error_message: string;
  signature: Buffer;
}

/**
 *
 */
class LedgerSubstrate implements HWWalletProvider {
  transport: Transport | null;

  network: string;

  /**
   *
   * @param network
   */
  constructor(network: string) {
    this.transport = null;
    this.network = network;
  }

  /**
   *
   * @param options
   */
  validatePathAndNetwork(options: getAddressRequest | SignTransactionRequest): void {
    if (!LedgerApps[this.network])
      throw new Error("ledger-substrate: Invalid network name");
    const pathValues = bip32ToAddressNList(
      options.pathType.path.replace(`{index}`, options.pathIndex.toString()),
    );
    if (pathValues.length < 3)
      throw new Error("ledger-substrate: Invalid path");
  }

  /**
   *
   */
  async init(): Promise<boolean> {
    if (!this.transport) {
      const support = await webUsbTransport.isSupported();
      if (support) {
        this.transport = await webUsbTransport.create();
      } else {
        return Promise.reject(
          new Error("ledger-substrate: webusb is not supported"),
        );
      }
    }
    return true;
  }

  /**
   *
   * @param options
   */
  async getAddress(options: getAddressRequest): Promise<AddressResponse> {
    this.validatePathAndNetwork(options);
    const app = LedgerApps[this.network];
    if (!app) {
      return Promise.reject(new Error("ledger-substrate: App not found for network"));
    }
    if (!this.transport) {
      return Promise.reject(new Error("ledger-substrate: Transport not initialized"));
    }
    const pathValues = bip32ToAddressNList(
      options.pathType.path.replace(`{index}`, options.pathIndex.toString()),
    );
    const connection = app(this.transport);
    return connection
      .getAddress(
        pathValues[0],
        pathValues[1],
        pathValues[2],
        options.confirmAddress,
      )
      .then((res: SubstrateAddressResponse) => ({
        address: res.address,
        publicKey: `0x${res.pubKey}`,
      }));
  }

  /**
   *
   */
  signMessage(): never {
    throw new Error("Not Supported");
  }

  /**
   * Gets the supported paths
   * @returns Array of supported path types
   */
  getSupportedPaths(): PathType[] {
    return supportedPaths || [];
  }

  /**
   * Closes the transport connection
   * @returns Promise that resolves when the transport is closed
   */
  close(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return this.transport?.close().catch(() => {}) ?? Promise.resolve();
  }

  /**
   *
   * @param networkName
   */
  isConnected(networkName: string): Promise<boolean> {
    return ConnectToLedger.bind(this)(networkName);
  }

  /**
   *
   */
  signPersonalMessage(): Promise<string> {
    throw new Error("hw-wallet:substrate: sign Personal message not supported");
  }

  /**
   *
   * @param _request
   */
  signTypedMessage(_request: SignTypedMessageRequest): Promise<string> {
    return Promise.reject(
      new Error("ledger-substrate: signTypedMessage not supported"),
    );
  }

  /**
   *
   * @param options
   */
  async signTransaction(options: SignTransactionRequest): Promise<string> {
    this.validatePathAndNetwork(options);
    const pathValues = bip32ToAddressNList(
      options.pathType.path.replace(`{index}`, options.pathIndex.toString()),
    );
    const app = LedgerApps[this.network];
    if (!app) {
      return Promise.reject(new Error("ledger-substrate: App not found for network"));
    }
    if (!this.transport) {
      return Promise.reject(new Error("ledger-substrate: Transport not initialized"));
    }
    const tx = options.transaction as ExtrinsicPayload;
    const connection = app(this.transport);
    return connection
      .sign(
        pathValues[0],
        pathValues[1],
        pathValues[2],
        u8aToBuffer(tx.toU8a(true)),
      )
      .then((result: SubstrateSignResponse) => {
        if (result.error_message !== "No errors")
          throw new Error(result.error_message);
        else return `0x${result.signature.toString("hex")}`;
      });
  }

  /**
   *
   */
  static getSupportedNetworks(): NetworkNames[] {
    return Object.keys(LedgerApps) as NetworkNames[];
  }

  /**
   *
   */
  static getCapabilities(): string[] {
    return [HWwalletCapabilities.signTx];
  }
}

export default LedgerSubstrate;
