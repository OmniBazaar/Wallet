/**
 * Convert a hexadecimal string to a Buffer
 * @param hex - The hexadecimal string (with or without 0x prefix)
 * @returns The buffer representation
 */
export default function hexToBuffer(hex: string): Buffer {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  return Buffer.from(cleanHex, 'hex');
}