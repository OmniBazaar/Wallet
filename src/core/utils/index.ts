import {
  stripHexPrefix,
  hexToBytes,
  keccak256,
  utf8ToHex,
  numberToHex,
} from "web3-utils";
import { bigIntToBytes, bigIntToHex } from "@ethereumjs/util";
import { encodeAddress as polkadotEncodeAddress } from "@polkadot/util-crypto";
import { encrypt, decrypt } from "./encrypt";
import MemoryStorage from "./memory-storage";
import { fromBase, toBase, isValidDecimals } from "./units";
import { DebugLogger } from "./debug-logger";
import {
  naclDecodeHex,
  encryptedDataStringToJson,
  naclDecrypt,
  naclEncrypt,
  NACL_VERSION,
} from "./nacl-encrypt-decrypt";
import { generateRandomNameWithSeed } from "./random-names";

/**
 * Converts a buffer to hexadecimal string
 * @param buf - Buffer or Uint8Array to convert
 * @param nozerox - If true, omits the '0x' prefix
 * @returns Hexadecimal string representation
 */
const bufferToHex = (buf: Buffer | Uint8Array, nozerox = false): string =>
  nozerox
    ? Buffer.from(buf).toString("hex")
    : `0x${Buffer.from(buf).toString("hex")}`;
/**
 * Converts a hexadecimal string to Buffer
 * @param hex - Hexadecimal string to convert (with or without '0x' prefix)
 * @returns Buffer representation of the hex string
 */
const hexToBuffer = (hex: string): Buffer =>
  Buffer.from(
    stripHexPrefix(hex).length % 2 === 1
      ? `0${stripHexPrefix(hex)}`
      : stripHexPrefix(hex),
    "hex",
  );

export {
  stripHexPrefix,
  utf8ToHex,
  bufferToHex,
  hexToBuffer,
  hexToBytes,
  encrypt,
  decrypt,
  MemoryStorage,
  keccak256,
  polkadotEncodeAddress,
  numberToHex,
  bigIntToBytes,
  bigIntToHex,
  fromBase,
  toBase,
  isValidDecimals,
  DebugLogger,
  naclDecodeHex,
  encryptedDataStringToJson,
  naclDecrypt,
  naclEncrypt,
  NACL_VERSION,
  generateRandomNameWithSeed,
};
