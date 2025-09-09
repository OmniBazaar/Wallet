/**
 * Secure Random Utility
 * 
 * Provides cryptographically secure random number generation
 * to replace insecure Math.random() usage throughout the wallet.
 */

import * as crypto from 'crypto';

/**
 * Generate a cryptographically secure random number between 0 and 1
 * @returns Random number between 0 (inclusive) and 1 (exclusive)
 */
export function secureRandom(): number {
  // Use 32-bit random value for sufficient precision while avoiding bias
  const randomBytes = crypto.randomBytes(4);
  const randomValue = randomBytes.readUInt32BE(0);
  // Divide by maximum uint32 value to get number between 0 and 1
  return randomValue / 0x100000000;
}

/**
 * Generate a cryptographically secure random integer between min and max (inclusive)
 * @param min Minimum value (inclusive)
 * @param max Maximum value (inclusive)
 * @returns Random integer between min and max
 */
export function secureRandomInt(min: number, max: number): number {
  if (min > max) {
    throw new Error('min cannot be greater than max');
  }
  
  const range = max - min + 1;
  const randomValue = secureRandom();
  return Math.floor(randomValue * range) + min;
}

/**
 * Generate a cryptographically secure random hex string
 * @param length Length in bytes (hex string will be 2x this length)
 * @returns Random hex string
 */
export function secureRandomHex(length: number): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a cryptographically secure random string using base36 encoding
 * @param length Desired length of the string
 * @returns Random base36 string
 */
export function secureRandomBase36(length: number): string {
  // Generate enough random bytes to ensure we have enough entropy
  const bytesNeeded = Math.ceil(length * 0.6); // base36 is ~5.17 bits per char
  const randomBytes = crypto.randomBytes(bytesNeeded);
  
  let result = '';
  for (let i = 0; i < randomBytes.length && result.length < length; i++) {
    // Convert each byte to base36, ensuring uniform distribution
    const value = randomBytes[i];
    if (value < 252) { // 252 = 36 * 7, ensures uniform distribution
      result += (value % 36).toString(36);
    }
  }
  
  // If we need more characters, generate more bytes
  if (result.length < length) {
    return result + secureRandomBase36(length - result.length);
  }
  
  return result.substring(0, length);
}

/**
 * Generate a cryptographically secure UUID v4
 * @returns Random UUID string
 */
export function secureRandomUUID(): string {
  const randomBytes = crypto.randomBytes(16);
  
  // Set version (4) and variant bits according to RFC 4122
  randomBytes[6] = (randomBytes[6] & 0x0f) | 0x40; // Version 4
  randomBytes[8] = (randomBytes[8] & 0x3f) | 0x80; // Variant 10
  
  // Convert to hex string with proper formatting
  const hex = randomBytes.toString('hex');
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20, 32)
  ].join('-');
}

/**
 * Generate a secure subscription ID
 * @returns Secure hex-encoded subscription ID
 */
export function generateSecureSubscriptionId(): string {
  return secureRandomHex(8);
}

/**
 * Generate a secure transaction hash (mock)
 * @returns 32-byte hex hash for testing/mocking purposes
 */
export function generateSecureMockTxHash(): string {
  return '0x' + secureRandomHex(32);
}

/**
 * Generate a secure Ethereum-style address (mock)
 * @returns 20-byte hex address for testing/mocking purposes
 */
export function generateSecureMockAddress(): string {
  return '0x' + secureRandomHex(20);
}