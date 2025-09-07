import type Transport from "@ledgerhq/hw-transport";
import webUsbTransport from "@ledgerhq/hw-transport-webusb";
import { HWwalletCapabilities, NetworkNames } from "../../../types/enkrypt-types";
import SolApp from "@ledgerhq/hw-app-solana";
import HDKey from "hdkey";
import { bufferToHex } from "../../../types/enkrypt-types";
import {
  AddressResponse,
  getAddressRequest,
  HWWalletProvider,
  PathType,
  SignMessageRequest,
  SignTransactionRequest,
  SignTypedMessageRequest,
  SolSignTransaction,
} from "../types";
import { supportedPaths } from "./configs";
import ConnectToLedger from "../ledgerConnect";

// Type definitions for Ledger Solana responses
interface SolanaAddressResponse {
  address: Buffer;
}

interface SolanaSignResponse {
  signature: Buffer;
}

/**
 *
 */
class LedgerSolana implements HWWalletProvider {
  transport: Transport | null;

  network: NetworkNames;

  HDNodes: Record<string, InstanceType<typeof HDKey>>;

  /**
   *
   * @param network
   */
  constructor(network: NetworkNames) {
    this.transport = null;
    this.network = network;
    this.HDNodes = {};
  }

  /**
   *
   */
  async init(): Promise<boolean> {
    if (!this.transport) {
      const support = await webUsbTransport.isSupported();
      if (support) {
        this.transport = await webUsbTransport.openConnected().then((res) => {
          if (!res) return webUsbTransport.create();
          return res;
        });
      } else {
        return Promise.reject(
          new Error("ledger-solana: webusb is not supported"),
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
    if (!supportedPaths[this.network as keyof typeof supportedPaths])
      return Promise.reject(new Error("ledger-solana: Invalid network name"));
    if (!this.transport)
      return Promise.reject(new Error("ledger-solana: Transport not initialized"));
    const connection = new SolApp(this.transport);
    return connection
      .getAddress(
        options.pathType.path.replace(`{index}`, options.pathIndex.toString()),
        false,
      )
      .then((res: SolanaAddressResponse) => ({
        address: bufferToHex(res.address),
        publicKey: bufferToHex(res.address),
      }));
  }

  /**
   *
   * @param options
   */
  async signPersonalMessage(options: SignMessageRequest): Promise<string> {
    if (!this.transport)
      return Promise.reject(new Error("ledger-solana: Transport not initialized"));
    const connection = new SolApp(this.transport);
    return connection
      .signOffchainMessage(
        options.pathType.path.replace(`{index}`, options.pathIndex.toString()),
        options.message,
      )
      .then((result: SolanaSignResponse) => bufferToHex(result.signature));
  }

  /**
   *
   * @param options
   */
  async signTransaction(options: SignTransactionRequest): Promise<string> {
    if (!this.transport)
      return Promise.reject(new Error("ledger-solana: Transport not initialized"));
    const connection = new SolApp(this.transport);
    return connection
      .signTransaction(
        options.pathType.path.replace(`{index}`, options.pathIndex.toString()),
        (options.transaction as SolSignTransaction).solTx,
      )
      .then((result: SolanaSignResponse) => bufferToHex(result.signature));
  }

  /**
   *
   * @param _request
   */
  signTypedMessage(_request: SignTypedMessageRequest): Promise<string> {
    return Promise.reject(
      new Error("ledger-solana: signTypedMessage not supported"),
    );
  }

  /**
   * Gets the supported paths for the current network
   * @returns Array of supported path types
   */
  getSupportedPaths(): PathType[] {
    const paths = supportedPaths[this.network as keyof typeof supportedPaths];
    if (!paths) {
      return [];
    }
    return paths;
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
  isConnected(networkName: NetworkNames): Promise<boolean> {
    return ConnectToLedger.bind(this)(networkName);
  }

  /**
   *
   */
  static getSupportedNetworks(): NetworkNames[] {
    return Object.keys(supportedPaths) as NetworkNames[];
  }

  /**
   *
   */
  static getCapabilities(): string[] {
    return [HWwalletCapabilities.signMessage, HWwalletCapabilities.signTx];
  }
}

export default LedgerSolana;
