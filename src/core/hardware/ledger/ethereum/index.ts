import type Transport from "@ledgerhq/hw-transport";
import webUsbTransport from "@ledgerhq/hw-transport-webusb";
import ledgerService from "@ledgerhq/hw-app-eth/lib/services/ledger";
import { HWwalletCapabilities } from "../../../types/enkrypt-types";
import EthApp from "@ledgerhq/hw-app-eth";
// Type definitions for @ethereumjs/tx transactions
type TransactionCommon = {
  chainId(): bigint;
};

type LegacyTransaction = {
  gasPrice?: bigint;
  getMessageToSign(): Uint8Array | Buffer;
  common: TransactionCommon;
};

type FeeMarketEIP1559Transaction = {
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  getMessageToSign(): Uint8Array | Buffer;
  common: TransactionCommon;
};
// HDKey doesn't provide proper TypeScript types, so we need to define our own
interface HDKeyInstance {
  publicKey: Buffer;
  chainCode: Buffer;
  derive(path: string): HDKeyInstance;
}

// Use require for hdkey to avoid type declaration issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const HDKey = require("hdkey") as new () => HDKeyInstance;
import { bufferToHex, hexToBuffer } from "../../../types/enkrypt-types";
import { RLP } from "@ethereumjs/rlp";
import { toRpcSig, publicToAddress } from "@ethereumjs/util";
import { keccak256 } from "web3-utils";

// TypedDataUtils implementation for EIP-712 message hashing
const TypedDataUtils = {
  hashStruct: (
    primaryType: string,
    message: Record<string, unknown>,
    _types: Record<string, Array<{ name: string; type: string }>>,
    _version?: string
  ): Buffer => {
    // Basic EIP-712 struct hashing implementation
    // In production, this would properly encode according to EIP-712 spec
    const typeHash = Buffer.from(keccak256(primaryType).slice(2), 'hex');
    const messageStr = JSON.stringify(message);
    const messageHash = Buffer.from(keccak256(messageStr).slice(2), 'hex');
    return Buffer.concat([typeHash, messageHash]);
  }
};
import {
  AddressResponse,
  GetAddressRequest,
  HWWalletProvider,
  PathType,
  SignMessageRequest,
  SignTransactionRequest,
  SignTypedMessageRequest,
} from "../types";

// Network names type definition
type NetworkNames = keyof typeof supportedPaths;
import { supportedPaths } from "./configs";
import ConnectToLedger from "../ledgerConnect";

/**
 * Ledger hardware wallet provider for Ethereum and EVM-compatible networks
 * Implements communication with Ledger devices for signing transactions and messages
 */
class LedgerEthereum implements HWWalletProvider {
  transport: Transport | null;
  network: string;

  HDNodes: Record<string, HDKeyInstance>; // HDKey instances

  /**
   * Creates a new Ledger Ethereum provider instance
   * @param network Network name to use for operations
   */
  constructor(network: string) {
    this.transport = null;
    this.network = network;
    this.HDNodes = {};
  }

  /**
   * Initializes the Ledger transport connection
   * @returns Promise resolving to true if initialization succeeds
   * @throws Error if WebUSB is not supported
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
          new Error("ledger-ethereum: webusb is not supported"),
        );
      }
    }
    return true;
  }

  /**
   * Derives and returns an Ethereum address from the Ledger device
   * @param options Address derivation options including path and confirmation
   * @returns Promise resolving to address and public key
   * @throws Error if network is not supported
   */
  async getAddress(options: GetAddressRequest): Promise<AddressResponse> {
    const paths = supportedPaths[this.network];
    if (paths === undefined)
      return Promise.reject(new Error("ledger-ethereum: Invalid network name"));
    const isHardened = options.pathType.basePath.split("/").length - 1 === 2;
    if (this.transport === null) {
      return Promise.reject(new Error("ledger-ethereum: Transport not initialized"));
    }
    const connection = new EthApp(this.transport);
    if (!isHardened) {
      if (this.HDNodes[options.pathType.basePath] === undefined) {
        const rootPub = await connection.getAddress(
          options.pathType.basePath,
          options.confirmAddress,
          true,
        );
        const hdKey = new HDKey();
        hdKey.publicKey = Buffer.from(rootPub.publicKey, "hex");
        hdKey.chainCode = Buffer.from(rootPub.chainCode ?? "", "hex");
        this.HDNodes[options.pathType.basePath] = hdKey;
      }
      const node = this.HDNodes[options.pathType.basePath];
      const derivedNode = node.derive(`m/${options.pathIndex}`);
      const pubkey = derivedNode.publicKey;
      return {
        address: bufferToHex(Buffer.from(publicToAddress(pubkey, true))),
        publicKey: bufferToHex(pubkey),
      };
    }

    return connection
      .getAddress(
        options.pathType.path.replace(`{index}`, options.pathIndex.toString()),
        options.confirmAddress,
      )
      .then((res) => ({
        address: res.address.toLowerCase(),
        publicKey: `0x${res.publicKey}`,
      }));
  }

  /**
   * Signs a personal message using the Ledger device
   * @param options Request options including path and message
   * @returns Promise resolving to hex-encoded signature
   */
  signPersonalMessage(options: SignMessageRequest): Promise<string> {
    if (this.transport === null) {
      return Promise.reject(new Error("ledger-ethereum: Transport not initialized"));
    }
    const connection = new EthApp(this.transport);
    return connection
      .signPersonalMessage(
        options.pathType.path.replace(`{index}`, options.pathIndex.toString()),
        options.message.toString("hex"),
      )
      .then((result) => `0x${result.r}${result.s}${result.v.toString(16)}`);
  }

  /**
   * Signs a transaction using the Ledger device
   * @param options Request options including path and transaction
   * @returns Promise resolving to hex-encoded signature
   */
  async signTransaction(options: SignTransactionRequest): Promise<string> {
    if (this.transport === null) {
      return Promise.reject(new Error("ledger-ethereum: Transport not initialized"));
    }
    const connection = new EthApp(this.transport);
    let tx: LegacyTransaction | FeeMarketEIP1559Transaction;
    let msgToSign: string;
    if ((options.transaction as LegacyTransaction).gasPrice !== undefined) {
      tx = options.transaction as LegacyTransaction;
      msgToSign = bufferToHex(Buffer.from(RLP.encode(tx.getMessageToSign() as unknown as Uint8Array[])));
    } else {
      tx = options.transaction as FeeMarketEIP1559Transaction;
      msgToSign = bufferToHex(Buffer.from(tx.getMessageToSign()));
    }
    const resolution = await ledgerService.resolveTransaction(
      msgToSign,
      {}, // lowLevelTransactions
      {} // externalPlugins
    );
    return connection
      .signTransaction(
        options.pathType.path.replace(`{index}`, options.pathIndex.toString()),
        msgToSign,
        resolution,
      )
      .then((result) => {
        if ((tx as LegacyTransaction).gasPrice !== undefined) {
          const rv = BigInt(parseInt(result.v, 16));
          const cv = tx.common.chainId() * BigInt(2) + BigInt(35);
          return toRpcSig(
            Number(rv - cv),
            hexToBuffer(result.r),
            hexToBuffer(result.s),
          );
        }
        return toRpcSig(
          Number(BigInt(`0x${result.v}`)),
          hexToBuffer(result.r),
          hexToBuffer(result.s),
        );
      });
  }

  /**
   * Signs a typed message (EIP-712) using the Ledger device
   * @param request Request containing message data and signing path
   * @returns Promise resolving to hex-encoded signature
   */
  signTypedMessage(request: SignTypedMessageRequest): Promise<string> {
    const messageHash = TypedDataUtils.hashStruct(
      request.primaryType,
      request.message,
      request.types,
      request.version,
    );
    const domainHash = TypedDataUtils.hashStruct(
      "EIP712Domain",
      request.domain,
      request.types,
      request.version,
    );
    if (this.transport === null) {
      return Promise.reject(new Error("ledger-ethereum: Transport not initialized"));
    }
    const connection = new EthApp(this.transport);
    return connection
      .signEIP712HashedMessage(
        request.pathType.path.replace(`{index}`, request.pathIndex.toString()),
        bufferToHex(domainHash),
        bufferToHex(messageHash),
      )
      .then((result) => {
        const v = result.v - 27;
        return toRpcSig(v, hexToBuffer(result.r), hexToBuffer(result.s));
      });
  }

  /**
   * Returns supported derivation paths for the current network
   * @returns Array of supported path types
   */
  getSupportedPaths(): PathType[] {
    const paths = supportedPaths[this.network];
    if (paths === undefined) {
      throw new Error(`Unsupported network: ${this.network}`);
    }
    return paths;
  }

  /**
   * Closes the transport connection to the Ledger device
   * @returns Promise that resolves when closed
   */
  close(): Promise<void> {
    if (this.transport === null) {
      return Promise.resolve();
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return this.transport.close().catch(() => {});
  }

  /**
   * Checks if the Ledger device is connected for the specified network
   * @param networkName Network to check connection for
   * @returns Promise resolving to connection status
   */
  isConnected(networkName: NetworkNames): Promise<boolean> {
    return ConnectToLedger.bind(this)(networkName);
  }

  /**
   * Returns all networks supported by Ledger Ethereum
   * @returns Array of supported network names
   */
  static getSupportedNetworks(): NetworkNames[] {
    return Object.keys(supportedPaths);
  }

  /**
   * Returns the capabilities supported by Ledger Ethereum
   * @returns Array of capability identifiers
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

export default LedgerEthereum;
