import type { TrezorConnect } from "@trezor/connect-web";
import { HWwalletCapabilities } from "../../../types/enkrypt-types";
import HDKey from "hdkey";
// @ts-ignore - Using any for HDKey instance type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HDKeyInstance = any;
import base58 from "bs58";
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
import getTrezorConnect from "../trezorConnect";

/**
 * Trezor hardware wallet provider for Solana blockchain
 */
class TrezorSolana implements HWWalletProvider {
  network: string;
  TrezorConnect!: TrezorConnect;
  HDNodes: Record<string, HDKeyInstance>;

  /**
   * Creates a new Trezor Solana provider instance
   * @param network Network name (must be "Solana")
   */
  constructor(network: string) {
    this.network = network;
    this.HDNodes = {};
  }

  /**
   * Initializes the Trezor connection
   * @returns Promise that resolves to true when initialized
   */
  async init(): Promise<boolean> {
    this.TrezorConnect = await getTrezorConnect();
    return true;
  }

  /**
   * Derives and returns a Solana address from the hardware wallet
   * @param options Address request options including path and index
   * @returns Promise with address and public key
   */
  async getAddress(options: getAddressRequest): Promise<AddressResponse> {
    if (!supportedPaths[this.network])
      return Promise.reject(new Error("trezor-solana: Invalid network name"));
    const res = await this.TrezorConnect.solanaGetAddress({
      path: options.pathType.path.replace(`{index}`, options.pathIndex.toString()),
      showOnTrezor: options.confirmAddress,
    });
    return {
      address: bufferToHex(Buffer.from(base58.decode((res.payload as { address: string }).address))),
      publicKey: bufferToHex(Buffer.from(base58.decode((res.payload as { address: string }).address))),
    };
  }

  /**
   * Get supported derivation paths for Solana
   * @returns Array of supported path types
   */
  getSupportedPaths(): PathType[] {
    return supportedPaths[this.network] || [];
  }

  /**
   * Closes the hardware wallet connection
   * @returns Promise that resolves when closed
   */
  close(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Checks if the hardware wallet is connected
   * @returns Promise that resolves to connection status
   */
  isConnected(): Promise<boolean> {
    return Promise.resolve(true);
  }

  /**
   * Signs a personal message (not supported for Solana)
   * @param _options Message signing options (unused)
   * @returns Promise that rejects with unsupported error
   */
  async signPersonalMessage(_options: SignMessageRequest): Promise<string> {
    throw new Error("trezor-solana: message signing not supported");
  }

  /**
   * Signs a Solana transaction with the hardware wallet
   * @param options Transaction signing options
   * @returns Promise with transaction signature
   */
  async signTransaction(options: SignTransactionRequest): Promise<string> {
    return this.TrezorConnect.solanaSignTransaction({
      path: options.pathType.path.replace(`{index}`, options.pathIndex.toString()),
      serializedTx: (options.transaction as SolSignTransaction).solTx.toString(
        "hex",
      ),
    }).then((result: { success: boolean; payload: { error?: string; signature?: string } }) => {
      if (!result.success) throw new Error(result.payload.error || 'Transaction failed');
      return result.payload.signature || '';
    });
  }

  /**
   * Signs a typed message (not supported for Solana)
   * @param _request Typed message request (unused)
   * @returns Promise that rejects with unsupported error
   */
  signTypedMessage(_request: SignTypedMessageRequest): Promise<string> {
    return Promise.reject(
      new Error("trezor-solana: signTypedMessage not supported"),
    );
  }

  /**
   * Gets the list of supported network names
   * @returns Array containing "Solana"
   */
  static getSupportedNetworks(): string[] {
    return Object.keys(supportedPaths);
  }

  /**
   * Gets the capabilities of this hardware wallet provider
   * @returns Array of capability strings
   */
  static getCapabilities(): string[] {
    return [HWwalletCapabilities.signTx];
  }
}

export default TrezorSolana;
