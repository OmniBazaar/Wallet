import { HWwalletCapabilities, NetworkNames } from "../../../types/enkrypt-types";
import HDKey from "hdkey";
// HDKey instance type
type HDKeyInstance = HDKey;
import { bigIntToHex, bufferToHex, hexToBuffer } from "../../../types/enkrypt-types";
import { publicToAddress, toRpcSig } from "@ethereumjs/util";
// import type { FeeMarketEIP1559Transaction, LegacyTransaction } from "@ethereumjs/tx"; - unused imports
import type { TrezorConnect } from "@trezor/connect-web";
import transformTypedData from "@trezor/connect-plugin-ethereum";

// Transaction interface to avoid using 'any'
interface EthereumTransaction {
  to: { toString(): string };
  value: bigint;
  nonce: bigint;
  gasLimit: bigint;
  data: Buffer;
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  common: { chainId(): bigint };
}
import {
  AddressResponse,
  GetAddressRequest,
  HWWalletProvider,
  PathType,
  SignMessageRequest,
  SignTransactionRequest,
  SignTypedMessageRequest,
} from "../types";
import { supportedPaths } from "./configs";
import getTrezorConnect from "../trezorConnect";

/**
 * Trezor hardware wallet provider for Ethereum and EVM-compatible chains
 */
class TrezorEthereum implements HWWalletProvider {
  network: string;
  TrezorConnect!: TrezorConnect;
  HDNodes: Record<string, HDKeyInstance>;

  /**
   * Creates a new Trezor Ethereum provider instance
   * @param network Network name (e.g., Ethereum, Matic, Avalanche)
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
    if (!supportedPaths[this.network])
      return Promise.reject(new Error("trezor-ethereum: Invalid network name"));

    if (!this.HDNodes[options.pathType.basePath]) {
      const rootPub = await this.TrezorConnect.ethereumGetPublicKey({
        path: options.pathType.basePath,
        showOnTrezor: options.confirmAddress,
      }) as {
        success: boolean;
        payload?: {
          publicKey: string;
          chainCode: string;
          error?: string;
        };
      };
      if (!rootPub.payload) {
        throw new Error("popup failed to open");
      }
      if (!rootPub.success) throw new Error(rootPub.payload.error || "Unknown error");

      const hdKey = new HDKey();
      hdKey.publicKey = Buffer.from(rootPub.payload.publicKey, "hex");
      hdKey.chainCode = Buffer.from(rootPub.payload.chainCode, "hex");
      this.HDNodes[options.pathType.basePath] = hdKey;
    }
    const pubkey = this.HDNodes[options.pathType.basePath].derive(
      `m/${options.pathIndex}`,
    ).publicKey;
    return {
      address: bufferToHex(publicToAddress(pubkey, true)),
      publicKey: bufferToHex(pubkey),
    };
  }

  /**
   * Get supported derivation paths for the current network
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
   * Signs a personal message with the hardware wallet
   * @param options Message signing options including path and message
   * @returns Promise with hex-encoded signature
   */
  async signPersonalMessage(options: SignMessageRequest): Promise<string> {
    const result = await this.TrezorConnect.ethereumSignMessage({
      path: options.pathType.path.replace(`{index}`, options.pathIndex.toString()),
      message: options.message.toString("hex"),
      hex: true,
    }) as {
      success: boolean;
      payload: {
        error?: string;
        signature?: string;
      };
    };
    if (!result.success || !result.payload.signature) throw new Error(result.payload.error || "Failed to sign message");
    return bufferToHex(hexToBuffer(result.payload.signature));
  }

  /**
   * Signs an Ethereum transaction with the hardware wallet
   * @param options Transaction signing options
   * @returns Promise with serialized signature
   */
  async signTransaction(options: SignTransactionRequest): Promise<string> {
    let tx = options.transaction as EthereumTransaction;

    const txObject = {
      to: tx.to.toString(),
      value: bigIntToHex(tx.value),
      chainId: Number(tx.common.chainId()),
      nonce: bigIntToHex(tx.nonce),
      gasLimit: bigIntToHex(tx.gasLimit),
      data: bufferToHex(tx.data),
    };
    if ((options.transaction as EthereumTransaction).gasPrice) {
      return this.TrezorConnect.ethereumSignTransaction({
        path: options.pathType.path.replace(`{index}`, options.pathIndex.toString()),
        transaction: { ...txObject, gasPrice: bigIntToHex(tx.gasPrice || 0n) },
      }).then((result: unknown) => {
        const typedResult = result as { success: boolean; payload: { error?: string; v: string; r: string; s: string } };
        if (!typedResult.success) throw new Error(typedResult.payload.error || 'Transaction failed');
        const rv = BigInt(parseInt(typedResult.payload.v, 16));
        const cv = tx.common.chainId() * 2n + 35n;
        return toRpcSig(
          Number(rv - cv),
          hexToBuffer(typedResult.payload.r),
          hexToBuffer(typedResult.payload.s),
        );
      });
    }

    tx = options.transaction as EthereumTransaction;
    return this.TrezorConnect.ethereumSignTransaction({
      path: options.pathType.path.replace(`{index}`, options.pathIndex.toString()),
      transaction: {
        ...txObject,
        maxFeePerGas: bigIntToHex(tx.maxFeePerGas || 0n),
        maxPriorityFeePerGas: bigIntToHex(tx.maxPriorityFeePerGas || 0n),
      },
    }).then((result: unknown) => {
      const typedResult = result as { success: boolean; payload: { error?: string; v: string; r: string; s: string } };
      if (!typedResult.success) throw new Error(typedResult.payload.error || 'Transaction failed');
      return toRpcSig(
        Number(typedResult.payload.v),
        hexToBuffer(typedResult.payload.r),
        hexToBuffer(typedResult.payload.s),
      );
    });
  }

  /**
   * Signs EIP-712 typed data with the hardware wallet
   * @param request Typed message signing request
   * @returns Promise with hex-encoded signature
   */
  async signTypedMessage(request: SignTypedMessageRequest): Promise<string> {
    const eip712Data = {
      types: request.types,
      primaryType: request.primaryType,
      domain: request.domain,
      message: request.message,
    };
    const transformedData = (transformTypedData as (data: { domain: Record<string, unknown>; message: Record<string, unknown> }, flag: boolean) => { domain_separator_hash: string; message_hash: string })(
      eip712Data as { domain: Record<string, unknown>; message: Record<string, unknown> },
      true,
    );
    
    const result = await this.TrezorConnect.ethereumSignTypedData({
      path: request.pathType.path.replace(`{index}`, request.pathIndex.toString()),
      data: eip712Data as { domain: Record<string, unknown>; message: Record<string, unknown> },
      metamask_v4_compat: true,
      domain_separator_hash: transformedData.domain_separator_hash,
      message_hash: transformedData.message_hash,
    }) as {
      success: boolean;
      payload: {
        error?: string;
        signature?: string;
      };
    };
    if (!result.success || !result.payload.signature) throw new Error(result.payload.error || "Failed to sign typed data");
    return bufferToHex(hexToBuffer(result.payload.signature));
  }

  /**
   * Gets the list of supported network names
   * @returns Array of supported network names
   */
  static getSupportedNetworks(): NetworkNames[] {
    return Object.keys(supportedPaths) as NetworkNames[];
  }

  /**
   * Gets the capabilities of this hardware wallet provider
   * @returns Array of capability strings
   */
  static getCapabilities(): string[] {
    return [
      HWwalletCapabilities.eip1559,
      HWwalletCapabilities.signMessage,
      HWwalletCapabilities.signTx,
      HWwalletCapabilities.typedMessage,
    ];
  }
}

export default TrezorEthereum;
