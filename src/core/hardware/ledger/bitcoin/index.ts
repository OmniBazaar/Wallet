import type Transport from "@ledgerhq/hw-transport";
import webUsbTransport from "@ledgerhq/hw-transport-webusb";
// import bs58 from "bs58"; // Currently unused, may be needed for AppClient implementation
// import { AppClient, DefaultWalletPolicy } from "ledger-bitcoin";
import { HWwalletCapabilities, NetworkNames } from "../../../types/enkrypt-types";
import BtcApp from "@ledgerhq/hw-app-btc";
// HDKey doesn't provide proper TypeScript types, so we need to define our own
interface HDKeyInstance {
  publicKey: Buffer;
  chainCode: Buffer;
  derive(path: string): HDKeyInstance;
}

// Use require for hdkey to avoid type declaration issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const HDKey = require("hdkey") as new () => HDKeyInstance;
import type { CreateTransactionArg } from "@ledgerhq/hw-app-btc/lib/createTransaction";
import { serializeTransactionOutputs } from "@ledgerhq/hw-app-btc/lib/serializeTransaction";
import { bufferToHex } from "../../../types/enkrypt-types";
import {
  pathStringToArray,
  pathArrayToString,
  // pubkeyFromXpub,
} from "@ledgerhq/hw-app-btc/lib/bip32";
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
import { supportedPaths } from "./configs";
import ConnectToLedger from "../ledgerConnect";

/**
 * Ledger Bitcoin hardware wallet provider
 * Handles Bitcoin transactions and address generation through Ledger devices
 */
class LedgerBitcoin implements HWWalletProvider {
  transport: Transport | null;

  network: NetworkNames;

  HDNodes: Record<string, HDKeyInstance>;

  isSegwit: boolean;

  /**
   * Creates a new LedgerBitcoin instance
   * @param network - Bitcoin network to use (mainnet, testnet, etc.)
   */
  constructor(network: NetworkNames) {
    this.transport = null;
    this.network = network;
    this.HDNodes = {};
    this.isSegwit = !!(
      this.network === NetworkNames.Bitcoin ||
      this.network === NetworkNames.Litecoin
    );
  }

  /**
   * Initializes the Ledger transport connection
   * @returns Promise that resolves to true if initialization succeeds
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
          new Error("ledger-bitcoin: webusb is not supported"),
        );
      }
    }
    return true;
  }

  /**
   * Gets a Bitcoin address from the Ledger device
   * @param options - Request options including path type and index
   * @returns Promise resolving to address response with address and public key
   */
  async getAddress(options: GetAddressRequest): Promise<AddressResponse> {
    if (supportedPaths[this.network] === undefined)
      return Promise.reject(new Error("ledger-bitcoin: Invalid network name"));
    const isHardened = options.pathType.basePath.split("/").length - 1 === 2;
    
    if (this.transport === null) {
      return Promise.reject(new Error("ledger-bitcoin: Transport not initialized"));
    }
    
    const connection = new BtcApp({ transport: this.transport });
    const hdKey = new HDKey();
    if (!isHardened) {
      if (this.HDNodes[options.pathType.basePath] === undefined) {
        const rootPub = await connection.getWalletPublicKey(
          options.pathType.basePath,
          { format: this.isSegwit ? "bech32" : "legacy" },
        );
        hdKey.publicKey = Buffer.from(rootPub.publicKey, "hex");
        hdKey.chainCode = Buffer.from(rootPub.chainCode, "hex");
        this.HDNodes[options.pathType.basePath] = hdKey;
      }
      const node = this.HDNodes[options.pathType.basePath];
      const derivedNode = node.derive(`m/${options.pathIndex}`);
      const pubkey = derivedNode.publicKey;
      return {
        address: bufferToHex(pubkey),
        publicKey: bufferToHex(pubkey),
      };
    }

    return connection
      .getWalletPublicKey(
        options.pathType.path.replace(`{index}`, options.pathIndex.toString()),
        { format: this.isSegwit ? "bech32" : "legacy" },
      )
      .then((res) => {
        hdKey.publicKey = Buffer.from(res.publicKey, "hex");
        hdKey.chainCode = Buffer.from(res.chainCode, "hex");
        return {
          address: bufferToHex(hdKey.publicKey),
          publicKey: bufferToHex(hdKey.publicKey),
        };
      });
  }

  /**
   * Signs a personal message using the Ledger device
   * @param options - Message signing options including path, message, and type
   * @returns Promise resolving to the signed message as a hex string
   */
  async signPersonalMessage(options: BitcoinSignMessage): Promise<string> {
    if (options.type === "bip322-simple") {
      if (options.psbtTx === null || options.psbtTx === undefined) {
        return Promise.reject(
          new Error("ledger-bitcoin: psbt not set for message signing"),
        );
      }
      // TODO: AppClient functionality needs to be implemented
      // const client = new AppClient(this.transport as Transport);
      if (this.transport === null) {
        return Promise.reject(new Error("ledger-bitcoin: Transport not initialized"));
      }
      const connection = new BtcApp({ transport: this.transport });
      
      // BtcApp doesn't have getMasterFingerprint method, using a placeholder
      // This should be replaced when proper AppClient is implemented
      const fpr = 'deadbeef';
      
      const accountPath = options.pathType.path.replace(
        `{index}`,
        options.pathIndex.toString(),
      );
      const pathElems: number[] = pathStringToArray(accountPath);
      const rootPath = pathElems.slice(0, -2);
      
      // Use getWalletPublicKey instead of non-existent getExtendedPubkey
      const rootPubResult = await connection.getWalletPublicKey(
        pathArrayToString(rootPath),
        { format: this.isSegwit ? "bech32" : "legacy" },
      );
      
      // Convert the public key result to extended pubkey format
      // This is a workaround until proper AppClient is implemented
      const accountRootPubkey = rootPubResult.publicKey;
      
      interface Bip32Derivation {
        masterFingerprint: Buffer;
        path: string;
      }
      
      interface PsbtDataInput {
        bip32Derivation?: Bip32Derivation[];
      }
      
      const psbtData = options.psbtTx.data as { inputs: PsbtDataInput[] };
      const inputs = psbtData.inputs;
      const firstInput = inputs[0];
      if (firstInput !== undefined && 
          firstInput.bip32Derivation !== undefined && 
          firstInput.bip32Derivation[0] !== undefined) {
        firstInput.bip32Derivation[0].masterFingerprint = Buffer.from(fpr, "hex");
        firstInput.bip32Derivation[0].path = accountPath;
      }
      options.psbtTx.updateGlobal({
        globalXpub: [
          {
            extendedPubkey: Buffer.from(accountRootPubkey, "hex"),
            masterFingerprint: Buffer.from(fpr, "hex"),
            path: accountPath,
          },
        ],
      });
      
      // BtcApp doesn't support signPsbt, so we need to use the standard transaction signing
      // This is a limitation until proper AppClient is implemented
      return Promise.reject(
        new Error("ledger-bitcoin: BIP322 simple message signing not fully supported with current BtcApp implementation"),
      );
    }
    if (this.transport === null) {
      return Promise.reject(new Error("ledger-bitcoin: Transport not initialized"));
    }
    const connection = new BtcApp({ transport: this.transport });
    return connection
      .signMessage(
        options.pathType.path.replace(`{index}`, options.pathIndex.toString()),
        options.message.toString("hex"),
      )
      .then((result) => {
        const v = result.v + 27 + 4;
        const signature = Buffer.from(
          v.toString(16) + result.r + result.s,
          "hex",
        );
        return bufferToHex(signature);
      });
  }

  /**
   * Signs a Bitcoin transaction using the Ledger device
   * @param options - Transaction signing options including path and transaction data
   * @returns Promise resolving to the signed transaction as a hex string
   */
  async signTransaction(options: SignTransactionRequest): Promise<string> {
    if (this.transport === null) {
      return Promise.reject(new Error("ledger-bitcoin: Transport not initialized"));
    }
    const connection = new BtcApp({ transport: this.transport });
    const transactionOptions = options.transaction as BTCSignTransaction;
    
    // Handle undefined psbtTx and its properties
    if (transactionOptions.psbtTx === null || 
        transactionOptions.psbtTx === undefined || 
        transactionOptions.psbtTx.txOutputs === null || 
        transactionOptions.psbtTx.txOutputs === undefined) {
      return Promise.reject(new Error("ledger-bitcoin: psbtTx or txOutputs is undefined"));
    }
    
    if (transactionOptions.rawTxs === null || transactionOptions.rawTxs === undefined) {
      return Promise.reject(new Error("ledger-bitcoin: rawTxs is undefined"));
    }
    
    if (transactionOptions.psbtTx.txInputs === null || 
        transactionOptions.psbtTx.txInputs === undefined) {
      return Promise.reject(new Error("ledger-bitcoin: txInputs is undefined"));
    }
    
    interface TxOutput {
      value: number | string | bigint;
      script: Buffer | Uint8Array | string;
    }
    
    const txOutputs = (transactionOptions.psbtTx.txOutputs as TxOutput[]).map((out) => {
      const valLE = Buffer.alloc(8);
      const value = typeof out.value === 'bigint' ? out.value : BigInt(out.value);
      valLE.writeBigInt64LE(value);
      return {
        amount: valLE,
        script: Buffer.from(out.script),
      };
    });
    
    const { psbtTx } = transactionOptions;
    const { txInputs } = psbtTx;
    
    if (txInputs === undefined) {
      throw new Error('ledger-bitcoin: txInputs is undefined');
    }
    
    interface PsbtInput {
      witnessScript?: Buffer;
    }
    
    interface PsbtData {
      inputs: PsbtInput[];
    }
    
    // interface TxInput {
    //   index: number;
    // }
    
    const data = psbtTx.data as PsbtData;
    
    const txArg: CreateTransactionArg = {
      inputs: transactionOptions.rawTxs.map((rTx, idx) => {
        const input = data.inputs[idx];
        const witnessScriptHex = input?.witnessScript?.toString("hex");
        const txInput = txInputs[idx];
        if (txInput === undefined) {
          throw new Error(`ledger-bitcoin: txInput at index ${idx} is undefined`);
        }
        return [
          connection.splitTransaction(rTx.replace("0x", ""), true),
          (txInput as { index: number }).index,
          witnessScriptHex,
          undefined,
        ];
      }),
      associatedKeysets: transactionOptions.rawTxs.map(() =>
        options.pathType.path.replace(`{index}`, options.pathIndex.toString()),
      ),
      outputScriptHex: serializeTransactionOutputs({
        version: Buffer.from([2, 0, 0, 0]),
        inputs: [],
        outputs: txOutputs,
      }).toString("hex"),
      segwit: this.isSegwit,
      additionals: [],
    };
    if (this.isSegwit) {
      txArg.additionals.push("bech32");
    }
    return connection.createPaymentTransaction(txArg).then((result) => result);
  }

  /**
   * Signs a typed message (not supported for Bitcoin on Ledger)
   * @param _request - Typed message signing request
   * @returns Promise that always rejects as this is not supported
   */
  signTypedMessage(_request: SignTypedMessageRequest): Promise<string> {
    return Promise.reject(
      new Error("ledger-bitcoin: signTypedMessage not supported"),
    );
  }

  /**
   * Gets the supported paths for the current network
   * @returns Array of supported path types
   */
  getSupportedPaths(): PathType[] {
    const paths = supportedPaths[this.network];
    if (paths === null || paths === undefined) {
      return [];
    }
    return paths;
  }

  /**
   * Closes the Ledger transport connection
   * @returns Promise that resolves when the connection is closed
   */
  close(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return this.transport?.close().catch(() => {}) ?? Promise.resolve();
  }

  /**
   * Checks if the Ledger device is connected for a specific network
   * @param networkName - The network to check connection for
   * @returns Promise resolving to true if connected, false otherwise
   */
  isConnected(networkName: NetworkNames): Promise<boolean> {
    return ConnectToLedger.bind(this)(networkName);
  }

  /**
   * Gets the list of supported Bitcoin-like networks
   * @returns Array of supported network names
   */
  static getSupportedNetworks(): NetworkNames[] {
    return Object.keys(supportedPaths) as NetworkNames[];
  }

  /**
   * Gets the capabilities of the Ledger Bitcoin wallet
   * @returns Array of capability strings
   */
  static getCapabilities(): string[] {
    return [HWwalletCapabilities.signMessage, HWwalletCapabilities.signTx];
  }
}

export default LedgerBitcoin;
