import type Transport from "@ledgerhq/hw-transport";
import webUsbTransport from "@ledgerhq/hw-transport-webusb";
import { HWwalletCapabilities, NetworkNames } from "../../../types/enkrypt-types";
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

// Stub for Solana App when module is not available
interface SolanaApp {
  getAddress(path: string, display: boolean): Promise<SolanaAddressResponse>;
  signOffchainMessage(path: string, message: Buffer): Promise<SolanaSignResponse>;
  signTransaction(path: string, transaction: Buffer): Promise<SolanaSignResponse>;
}

// Dynamic import for optional Ledger Solana support
let SolApp: (new (transport: Transport) => SolanaApp) | undefined;

/**
 * Creates a Solana App instance
 * @param transport - The transport to use
 * @returns A new SolanaApp instance
 */
async function createSolanaApp(transport: Transport): Promise<SolanaApp> {
  // Load module on first use if not already loaded
  if (SolApp === undefined) {
    try {
      const module = await import("@ledgerhq/hw-app-solana");
      SolApp = module.default as new (transport: Transport) => SolanaApp;
    } catch {
      throw new Error("Ledger Solana support is not available. Please ensure @ledgerhq/hw-app-solana is installed.");
    }
  }

  // Runtime check for Ledger Solana support
  if (SolApp !== undefined) {
    return new SolApp(transport);
  } else {
    // Provide stub implementation when module is not available
    return {
      getAddress: () => Promise.reject(new Error("Ledger Solana support not available")),
      signOffchainMessage: () => Promise.reject(new Error("Ledger Solana support not available")),
      signTransaction: () => Promise.reject(new Error("Ledger Solana support not available")),
    };
  }
}

/**
 * Ledger hardware wallet provider for Solana network
 */
class LedgerSolana implements HWWalletProvider {
  transport: Transport | null;
  network: string;
  HDNodes: Record<string, never>;

  /**
   * Creates a new LedgerSolana instance
   */
  constructor() {
    this.transport = null;
    this.network = NetworkNames.Solana;
    this.HDNodes = {};
  }

  /**
   * Initializes the Ledger transport and connects to the device
   * @returns Promise resolving to true when connection is successful
   */
  async init(): Promise<boolean> {
    this.transport = await webUsbTransport.create();
    return ConnectToLedger.call(this, this.network);
  }

  /**
   * Gets an address from the Ledger device for a given derivation path
   * @param options - Address request options including path type and index
   * @returns Promise resolving to the address and public key
   */
  async getAddress(options: GetAddressRequest): Promise<AddressResponse> {
    const paths = supportedPaths[this.network];
    if (paths === undefined)
      return Promise.reject(new Error("ledger-solana: Invalid network name"));
    if (this.transport === null)
      return Promise.reject(new Error("ledger-solana: Transport not initialized"));
    
    const connection = await createSolanaApp(this.transport);
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
    
    const connection = await createSolanaApp(this.transport);
    return connection
      .signOffchainMessage(
        options.pathType.path.replace(`{index}`, options.pathIndex.toString()),
        options.message,
      )
      .then((res) => bufferToHex(res.signature));
  }

  /**
   * Signs a transaction using the Ledger device
   * @param options - Transaction signing options including path and transaction data
   * @returns Promise resolving to the signature as a hex string
   */
  async signTransaction(options: SignTransactionRequest): Promise<string> {
    const transaction = options.transaction as SolSignTransaction;
    if (this.transport === null)
      return Promise.reject(new Error("ledger-solana: Transport not initialized"));
    
    const connection = await createSolanaApp(this.transport);
    return connection
      .signTransaction(
        options.pathType.path.replace(`{index}`, options.pathIndex.toString()),
        transaction.solTx,
      )
      .then((res) => bufferToHex(res.signature));
  }

  /**
   * Signs a typed message - not supported by Solana
   * @param _options - Typed message signing options (unused)
   * @returns Promise rejecting with not supported error
   */
  signTypedMessage(_options: SignTypedMessageRequest): Promise<string> {
    return Promise.reject(new Error("ledger-solana: signTypedMessage not supported"));
  }

  /**
   * Returns the supported derivation paths for Solana
   * @returns Array of supported path types
   */
  getSupportedPaths(): PathType[] {
    return supportedPaths[this.network] ?? [];
  }

  /**
   * Gets the list of supported Solana networks
   * @returns Array of network names
   */
  static getSupportedNetworks(): NetworkNames[] {
    return Object.keys(supportedPaths) as NetworkNames[];
  }

  /**
   * Gets the capabilities of the Ledger Solana wallet
   * @returns Array of capability identifiers
   */
  static getCapabilities(): string[] {
    return [HWwalletCapabilities.signTx];
  }
}

export default LedgerSolana;