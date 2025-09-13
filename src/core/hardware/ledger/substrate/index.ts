import type Transport from "@ledgerhq/hw-transport";
import webUsbTransport from "@ledgerhq/hw-transport-webusb";
import { HWwalletCapabilities, NetworkNames } from "../../../types/enkrypt-types";
import { ExtrinsicPayload } from "@polkadot/types/interfaces";
import { u8aToBuffer } from "@polkadot/util";
import { LedgerApps } from "./substrateApps";
import {
  AddressResponse,
  GetAddressRequest,
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
 * Ledger hardware wallet provider for Substrate-based blockchains
 * Handles operations for Polkadot, Kusama, and other Substrate chains
 */
class LedgerSubstrate implements HWWalletProvider {
  transport: Transport | null;

  network: string;

  /**
   * Creates a new LedgerSubstrate instance
   * @param network - The Substrate network to connect to
   */
  constructor(network: string) {
    this.transport = null;
    this.network = network;
  }

  /**
   * Validates the derivation path and network configuration
   * @param options - Request options containing path and network info
   */
  validatePathAndNetwork(options: GetAddressRequest | SignTransactionRequest): void {
    const app = LedgerApps[this.network];
    if (app === undefined)
      throw new Error("ledger-substrate: Invalid network name");
    const pathValues = bip32ToAddressNList(
      options.pathType.path.replace(`{index}`, options.pathIndex.toString()),
    );
    if (pathValues.length < 3)
      throw new Error("ledger-substrate: Invalid path");
  }

  /**
   * Initializes the Ledger transport connection
   * @returns Promise resolving to true if initialization succeeds
   */
  async init(): Promise<boolean> {
    if (this.transport === null) {
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
   * Gets a Substrate address from the Ledger device
   * @param options - Address request options including path and index
   * @returns Promise resolving to address response
   */
  async getAddress(options: GetAddressRequest): Promise<AddressResponse> {
    this.validatePathAndNetwork(options);
    const app = LedgerApps[this.network];
    if (app === undefined) {
      return Promise.reject(new Error("ledger-substrate: App not found for network"));
    }
    if (this.transport === null) {
      return Promise.reject(new Error("ledger-substrate: Transport not initialized"));
    }
    const pathValues = bip32ToAddressNList(
      options.pathType.path.replace(`{index}`, options.pathIndex.toString()),
    );
    const connection = app(this.transport) as {
      getAddress(account: number, addressIndex: number, accountIndex: number, confirmAddress?: boolean): Promise<SubstrateAddressResponse>;
    };
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
   * Signs a message (not implemented for Substrate)
   * @throws Always throws an error as this is not supported
   */
  signMessage(): never {
    throw new Error("Not Supported");
  }

  /**
   * Gets the supported paths
   * @returns Array of supported path types
   */
  getSupportedPaths(): PathType[] {
    return supportedPaths ?? [];
  }

  /**
   * Closes the transport connection
   * @returns Promise that resolves when the transport is closed
   */
  close(): Promise<void> {
    return this.transport?.close().catch(() => {}) ?? Promise.resolve();
  }

  /**
   * Checks if the Ledger is connected for a specific network
   * @param networkName - The network name to check
   * @returns Promise resolving to connection status
   */
  isConnected(networkName: string): Promise<boolean> {
    return ConnectToLedger.bind(this)(networkName);
  }

  /**
   * Signs a personal message (not supported for Substrate)
   * @returns Never resolves as it always throws
   */
  signPersonalMessage(): Promise<string> {
    throw new Error("hw-wallet:substrate: sign Personal message not supported");
  }

  /**
   * Signs a typed message (not supported for Substrate)
   * @param _request - Typed message request (unused)
   * @returns Promise that always rejects
   */
  signTypedMessage(_request: SignTypedMessageRequest): Promise<string> {
    return Promise.reject(
      new Error("ledger-substrate: signTypedMessage not supported"),
    );
  }

  /**
   * Signs a Substrate transaction
   * @param options - Transaction signing options
   * @returns Promise resolving to hex signature
   */
  async signTransaction(options: SignTransactionRequest): Promise<string> {
    this.validatePathAndNetwork(options);
    const pathValues = bip32ToAddressNList(
      options.pathType.path.replace(`{index}`, options.pathIndex.toString()),
    );
    const app = LedgerApps[this.network];
    if (app === undefined) {
      return Promise.reject(new Error("ledger-substrate: App not found for network"));
    }
    if (this.transport === null) {
      return Promise.reject(new Error("ledger-substrate: Transport not initialized"));
    }
    const tx = options.transaction as ExtrinsicPayload;
    const connection = app(this.transport) as {
      sign(account: number, addressIndex: number, accountIndex: number, message: Buffer): Promise<SubstrateSignResponse>;
    };
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
   * Gets the list of supported Substrate networks
   * @returns Array of network names
   */
  static getSupportedNetworks(): NetworkNames[] {
    return Object.keys(LedgerApps) as NetworkNames[];
  }

  /**
   * Gets the capabilities of the Ledger Substrate wallet
   * @returns Array of capability identifiers
   */
  static getCapabilities(): string[] {
    return [HWwalletCapabilities.signTx];
  }
}

export default LedgerSubstrate;
