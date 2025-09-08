// Local minimal type to avoid external dependency/types issues
/**
 *
 */
export interface EthEncryptedData {
  /**
   *
   */
  version: string;
  /**
   *
   */
  nonce: string;
  /**
   *
   */
  ephemPublicKey: string;
  /**
   *
   */
  ciphertext: string;
}
import { box as naclBox, randomBytes } from "tweetnacl";
// Using native implementations instead of tweetnacl-util
const decodeBase64 = (str: string): Uint8Array => {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const encodeBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte !== undefined) {
      binary += String.fromCharCode(byte);
    }
  }
  return btoa(binary);
};

const encodeUTF8 = (str: string): Uint8Array => {
  return new TextEncoder().encode(str);
};

const decodeUTF8 = (bytes: Uint8Array): string => {
  return new TextDecoder().decode(bytes);
};
import { hexToBuffer, utf8ToHex } from ".";

/** NaCl encryption version identifier */
export const NACL_VERSION = "x25519-xsalsa20-poly1305";

/**
 * Decodes a hex string using NaCl base64 decoding
 * @param msgHex - The hex string to decode
 * @returns Decoded Uint8Array
 */
const naclDecodeHex = (msgHex: string): Uint8Array =>
  decodeBase64(hexToBuffer(msgHex).toString("base64"));

/**
 * Converts an encrypted data string to JSON format
 * @param strData - The encrypted data string in hex format
 * @returns Parsed EthEncryptedData object
 * @throws {Error} When string cannot be parsed as JSON
 */
const encryptedDataStringToJson = (strData: string): EthEncryptedData => {
  const buf = hexToBuffer(strData);
  return JSON.parse(buf.toString("utf8"));
};

/**
 * Converts JSON encrypted data to string format
 * @param strData - The EthEncryptedData object to convert
 * @returns Hex string representation of the encrypted data
 */
const JsonToEncryptedDataString = (strData: EthEncryptedData): string => {
  const hex = utf8ToHex(JSON.stringify(strData));
  return hex;
};

/**
 * Decrypts data using NaCl encryption
 * @param params - Decryption parameters
 * @param params.encryptedData - The encrypted data object
 * @param params.privateKey - The private key for decryption (hex string)
 * @returns Decrypted message as string
 * @throws {Error} When decryption fails or version is unsupported
 * @example
 * ```typescript
 * const decrypted = naclDecrypt({
 *   encryptedData: encryptedObj,
 *   privateKey: '0x1234...'
 * });
 * ```
 */
const naclDecrypt = ({
  encryptedData,
  privateKey,
}: {
  encryptedData: EthEncryptedData;
  privateKey: string;
}): string => {
  switch (encryptedData.version) {
    case NACL_VERSION: {
      const recieverPrivateKeyUint8Array = naclDecodeHex(privateKey);
      const recieverEncryptionPrivateKey = naclBox.keyPair.fromSecretKey(
        recieverPrivateKeyUint8Array,
      ).secretKey;
      const nonce = decodeBase64(encryptedData.nonce);
      const ciphertext = decodeBase64(encryptedData.ciphertext);
      const ephemPublicKey = decodeBase64(encryptedData.ephemPublicKey);
      const decryptedMessage = naclBox.open(
        ciphertext,
        nonce,
        ephemPublicKey,
        recieverEncryptionPrivateKey,
      );
      let output;
      try {
        output = decodeUTF8(decryptedMessage as Uint8Array);
        return output;
      } catch (err) {
        throw new Error("Decryption failed.");
      }
    }
    default:
      throw new Error("Encryption type/version not supported.");
  }
};

/**
 * Encrypts data using NaCl encryption
 * @param params - Encryption parameters
 * @param params.publicKey - The public key for encryption (base64 string)
 * @param params.data - The data to encrypt (must be string for current version)
 * @param params.version - The encryption version (currently supports x25519-xsalsa20-poly1305)
 * @returns Encrypted data as hex string
 * @throws {Error} When parameters are missing, invalid, or version is unsupported
 * @example
 * ```typescript
 * const encrypted = naclEncrypt({
 *   publicKey: 'base64-public-key',
 *   data: 'message to encrypt',
 *   version: 'x25519-xsalsa20-poly1305'
 * });
 * ```
 */
const naclEncrypt = ({
  publicKey,
  data,
  version,
}: {
  publicKey: string;
  data: unknown;
  version: string;
}): string => {
  if (!publicKey) {
    throw new Error("Missing publicKey parameter");
  } else if (!data) {
    throw new Error("Missing data parameter");
  } else if (!version) {
    throw new Error("Missing version parameter");
  }

  switch (version) {
    case NACL_VERSION: {
      if (typeof data !== "string") {
        throw new Error("Message data must be given as a string");
      }
      const ephemeralKeyPair = naclBox.keyPair();

      let pubKeyUInt8Array;
      try {
        pubKeyUInt8Array = decodeBase64(publicKey);
      } catch (err) {
        throw new Error("Bad public key");
      }
      const msgParamsUInt8Array = encodeUTF8(data);
      const nonce = randomBytes(24);
      const encryptedMessage = naclBox(
        msgParamsUInt8Array,
        nonce,
        pubKeyUInt8Array,
        ephemeralKeyPair.secretKey,
      );
      const output = {
        version: NACL_VERSION,
        nonce: encodeBase64(nonce),
        ephemPublicKey: encodeBase64(ephemeralKeyPair.publicKey),
        ciphertext: encodeBase64(encryptedMessage),
      };
      return JsonToEncryptedDataString(output);
    }

    default:
      throw new Error("Encryption type/version not supported.");
  }
};

/**
 * NaCl encryption and decryption utilities for secure messaging
 */
export {
  /** Decodes hex strings using NaCl base64 decoding */
  naclDecodeHex,
  /** Converts encrypted data strings to JSON objects */
  encryptedDataStringToJson,
  /** Decrypts NaCl-encrypted data */
  naclDecrypt,
  /** Encrypts data using NaCl */
  naclEncrypt,
};
