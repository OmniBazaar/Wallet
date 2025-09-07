/**
 * Convert a BigInt to a hexadecimal string
 * @param value - The BigInt value to convert
 * @returns The hexadecimal string representation with 0x prefix
 */
export default function bigIntToHex(value: bigint): string {
  return '0x' + value.toString(16);
}