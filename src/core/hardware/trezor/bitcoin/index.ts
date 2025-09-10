import { HWwalletCapabilities } from "../../../types/enkrypt-types";
import HDKey from "hdkey";

interface HDKeyInstance {
  publicKey: Buffer;
  chainCode: Buffer;
  derive(path: string): HDKeyInstance;
}

import { bufferToHex } from "../../../types/enkrypt-types";
import type { TrezorConnect } from "@trezor/connect-web";

// Simple implementation of getHDPath since the package is not available
const getHDPath = (path: string): number[] => {
  const parts = path.split('/').slice(1); // Remove 'm' prefix
  return parts.map(part => {
    const hardened = part.endsWith("'");
    const index = parseInt(hardened ? part.slice(0, -1) : part, 10);
    return hardened ? index | 0x80000000 : index;
  });
};
import {
  AddressResponse,
  BitcoinSignMessage,
  BTCSignTransaction,
  GetAddressRequest,
  HWWalletProvider,
  PathType,
  SignTransactionRequest,
  SignTypedMessageRequest,
} from "../types";
import { supportedPaths, TrezorNetworkConfigs } from "./configs";
import getTrezorConnect from "../trezorConnect";

/**
 * Trezor hardware wallet provider for Bitcoin-based cryptocurrencies
 * Supports Bitcoin, Litecoin, and Dogecoin
 */
class TrezorBitcoin implements HWWalletProvider {
  network: string;
  TrezorConnect!: TrezorConnect;
  HDNodes: Record<string, HDKeyInstance>;

  /**
   * Creates a new Trezor Bitcoin provider instance
   * @param network Network name (Bitcoin, Litecoin, or Dogecoin)
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
   * Derives and returns an address from the hardware wallet
   * @param options Address request options including path and index
   * @returns Promise with address and public key
   */
  async getAddress(options: GetAddressRequest): Promise<AddressResponse> {
    if (supportedPaths[this.network] === undefined)
      return Promise.reject(new Error("trezor-bitcoin: Invalid network name"));

    if (this.HDNodes[options.pathType.basePath] === undefined) {
      const rootPub = await this.TrezorConnect.getAddress({
        path: options.pathType.basePath,
        showOnTrezor: options.confirmAddress,
      } as { path: string; showOnTrezor: boolean }) as {
        success: boolean;
        payload?: {
          publicKey: string;
          chainCode: string;
          error?: string;
        };
      };
      if (rootPub.payload === undefined || rootPub.payload === null) {
        throw new Error("popup failed to open");
      }
      if (!rootPub.success)
        throw new Error(rootPub.payload.error ?? "Unknown error");

      const hdKey = new HDKey() as unknown as HDKeyInstance;
      hdKey.publicKey = Buffer.from(rootPub.payload.publicKey, "hex");
      hdKey.chainCode = Buffer.from(rootPub.payload.chainCode, "hex");
      this.HDNodes[options.pathType.basePath] = hdKey;
    }
    const hdNode = this.HDNodes[options.pathType.basePath];
    const derivedNode = hdNode.derive(
      `m/${options.pathIndex}`,
    );
    const pubkey = derivedNode.publicKey;
    return {
      address: bufferToHex(pubkey),
      publicKey: bufferToHex(pubkey),
    };
  }

  /**
   * Get supported derivation paths for the current network
   * @returns Array of supported path types
   */
  getSupportedPaths(): PathType[] {
    return supportedPaths[this.network] ?? [];
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
   * Signs a personal message with the hardware wallet
   * @param options Signing options including path and message
   * @returns Promise with hex-encoded signature
   * @throws Error if bip322 signing is requested
   */
  async signPersonalMessage(options: BitcoinSignMessage): Promise<string> {
    if (options.type === "bip322-simple") {
      throw new Error("trezor-bitcoin: bip322 signing not supported");
    }
    const result = await this.TrezorConnect.signMessage({
      path: options.pathType.path.replace(`{index}`, options.pathIndex.toString()),
      message: options.message.toString("hex"),
      hex: true,
    } as { path: string; message: string; hex: boolean }) as {
      success: boolean;
      payload: {
        error?: string;
        signature?: string;
      };
    };
    if (!result.success || result.payload.signature === undefined || result.payload.signature === '')
      throw new Error(result.payload.error ?? "Failed to sign message");
    return bufferToHex(Buffer.from(result.payload.signature, "base64"));
  }

  /**
   * Signs a Bitcoin transaction with the hardware wallet
   * @param options Transaction signing options
   * @returns Promise with serialized signed transaction
   */
  async signTransaction(options: SignTransactionRequest): Promise<string> {
    const transactionOptions = options.transaction as BTCSignTransaction;
    const addressN = getHDPath(
      options.pathType.path.replace(`{index}`, options.pathIndex.toString()),
    );
    return this.TrezorConnect.signTransaction({
      coin: TrezorNetworkConfigs[this.network as keyof typeof TrezorNetworkConfigs]?.symbol ?? "btc",
      inputs: transactionOptions.psbtTx.txInputs.map((tx) => ({
        address_n: addressN,
        prev_hash: tx.hash.reverse().toString("hex"),
        prev_index: tx.index,
        amount: 0, // doesnt seem like this do anything
        script_type: TrezorNetworkConfigs[this.network as keyof typeof TrezorNetworkConfigs]?.isSegwit
          ? "SPENDWITNESS"
          : "SPENDADDRESS",
      })),
      outputs: transactionOptions.psbtTx.txOutputs.map(
        (out) =>
          ({
            amount: out.value,
            address: out.address,
            script_type: "PAYTOADDRESS",
          }) as { amount: number; address: string; script_type: string },
      ),
    }).then((res: unknown) => {
      const result = res as { success: boolean; payload: { error?: string; serializedTx?: string } };
      if (!result.success) throw new Error(result.payload.error ?? 'Transaction failed');
      if (result.payload.serializedTx === undefined || result.payload.serializedTx === '') {
        throw new Error('No serialized transaction received');
      }
      return result.payload.serializedTx;
    });
  }

  /**
   * Signs a typed message (not supported for Bitcoin)
   * @param _request Typed message request (unused)
   * @returns Promise that rejects with unsupported error
   */
  signTypedMessage(_request: SignTypedMessageRequest): Promise<string> {
    return Promise.reject(
      new Error("trezor-bitcoin: signTypedMessage not supported"),
    );
  }

  /**
   * Gets the list of supported network names
   * @returns Array of supported network names
   */
  static getSupportedNetworks(): string[] {
    return Object.keys(supportedPaths);
  }

  /**
   * Gets the capabilities of this hardware wallet provider
   * @returns Array of capability strings
   */
  static getCapabilities(): string[] {
    return [HWwalletCapabilities.signMessage, HWwalletCapabilities.signTx];
  }
}

export default TrezorBitcoin;
