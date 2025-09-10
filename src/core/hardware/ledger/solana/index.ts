import type Transport from "@ledgerhq/hw-transport";
import webUsbTransport from "@ledgerhq/hw-transport-webusb";
import { HWwalletCapabilities, NetworkNames } from "../../../types/enkrypt-types";
import SolApp from "@ledgerhq/hw-app-solana";
import { bufferToHex } from "../../../types/enkrypt-types";
import {
  AddressResponse,
  GetAddressRequest,
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
 * Ledger hardware wallet provider for Solana blockchain
 * Handles Solana-specific operations through Ledger devices
 */
class LedgerSolana implements HWWalletProvider {
  transport: Transport | null;

  network: NetworkNames;

  HDNodes: Record<string, never>; // HDKey not used for Solana

  /**
   * Creates a new LedgerSolana instance
   * @param network - The Solana network to connect to
   */
  constructor(network: NetworkNames) {
    this.transport = null;
    this.network = network;
    this.HDNodes = {};
  }

  /**
   * Initializes the Ledger transport connection
   * @returns Promise resolving to true if initialization succeeds
   */
  async init(): Promise<boolean> {
    if (this.transport === null) {
      const support = await webUsbTransport.isSupported();
      if (support) {
        this.transport = await webUsbTransport.openConnected().then((res) => {
          if (res === null) return webUsbTransport.create();
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
   * Gets a Solana address from the Ledger device
   * @param options - Address request options including path and index
   * @returns Promise resolving to address and public key
   */
  async getAddress(options: GetAddressRequest): Promise<AddressResponse> {
    const paths = supportedPaths[this.network as keyof typeof supportedPaths];
    if (paths === undefined)
      return Promise.reject(new Error("ledger-solana: Invalid network name"));
    if (this.transport === null)
      return Promise.reject(new Error("ledger-solana: Transport not initialized"));
    // @ts-expect-error - SolApp doesn't have type definitions
    const connection = new SolApp(this.transport) as {
      getAddress(path: string, display: boolean): Promise<SolanaAddressResponse>;
    };
    return connection
      .getAddress(
        options.pathType.path.replace(`{index}`, options.pathIndex.toString()),
        false,
      )
      .then((res) => ({
        address: bufferToHex(res.address),
        publicKey: bufferToHex(res.address),
      }));
  }

  /**
   * Signs a personal message using the Ledger device
   * @param options - Message signing options including path and message data
   * @returns Promise resolving to the signature as a hex string
   */
  async signPersonalMessage(options: SignMessageRequest): Promise<string> {
    if (this.transport === null)
      return Promise.reject(new Error("ledger-solana: Transport not initialized"));
    // @ts-expect-error - SolApp doesn't have type definitions
    const connection = new SolApp(this.transport) as {
      signOffchainMessage(path: string, message: Buffer): Promise<SolanaSignResponse>;
    };
    return connection
      .signOffchainMessage(
        options.pathType.path.replace(`{index}`, options.pathIndex.toString()),
        options.message,
      )
      .then((result) => bufferToHex(result.signature));
  }

  /**
   * Signs a Solana transaction using the Ledger device
   * @param options - Transaction signing options including path and transaction data
   * @returns Promise resolving to the signature as a hex string
   */
  async signTransaction(options: SignTransactionRequest): Promise<string> {
    const transactionOptions = options.transaction as SolSignTransaction;
    if (this.transport === null)
      return Promise.reject(new Error("ledger-solana: Transport not initialized"));
    // @ts-expect-error - SolApp doesn't have type definitions
    const connection = new SolApp(this.transport) as {
      signTransaction(path: string, transaction: Buffer): Promise<SolanaSignResponse>;
    };
    return connection
      .signTransaction(
        options.pathType.path.replace(`{index}`, options.pathIndex.toString()),
        transactionOptions.solTx,
      )
      .then((result) => bufferToHex(result.signature));
  }

  /**
   * Signs a typed message (not supported for Solana)
   * @param _request - Typed message request (unused)
   * @returns Promise that always rejects as this is not supported
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
    if (paths === undefined) {
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
   * Checks if the Ledger is connected for a specific network
   * @param networkName - The network to check connection for
   * @returns Promise resolving to true if connected
   */
  isConnected(networkName: NetworkNames): Promise<boolean> {
    return ConnectToLedger.bind(this)(networkName);
  }

  /**
   * Gets the list of supported Solana networks
   * @returns Array of supported network names
   */
  static getSupportedNetworks(): NetworkNames[] {
    return Object.keys(supportedPaths) as NetworkNames[];
  }

  /**
   * Gets the capabilities of the Ledger Solana wallet
   * @returns Array of capability strings
   */
  static getCapabilities(): string[] {
    return [HWwalletCapabilities.signMessage, HWwalletCapabilities.signTx];
  }
}

export default LedgerSolana;
