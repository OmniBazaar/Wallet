/**
 * Convert a Buffer to a hexadecimal string
 * @param buffer - The buffer to convert
 * @returns The hexadecimal string representation with 0x prefix
 */
export default function bufferToHex(buffer: Buffer): string {
  return '0x' + buffer.toString('hex');
}