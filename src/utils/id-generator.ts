/**
 * ID Generation Utilities for Wallet Module
 *
 * Provides consistent UUID generation for database entities.
 * Uses crypto.randomUUID() for proper UUID v4 generation.
 *
 * @module utils/id-generator
 */

import * as crypto from 'crypto';

/**
 * Generate a UUID v4 for database entities
 *
 * @returns A valid UUID v4 string
 */
export function generateUUID(): string {
  // In browser environment, use crypto.randomUUID()
  // In Node.js, it's also available in crypto module
  if (typeof window !== 'undefined' && window.crypto?.randomUUID != null) {
    return window.crypto.randomUUID();
  }
  return crypto.randomUUID();
}

/**
 * Generate a transaction ID (UUID)
 *
 * @returns A valid UUID for database storage
 */
export function generateTransactionId(): string {
  return generateUUID();
}

/**
 * Generate a batch transaction ID (UUID)
 *
 * @returns A valid UUID for database storage
 */
export function generateBatchId(): string {
  return generateUUID();
}

/**
 * Generate a wallet session ID (UUID)
 *
 * @returns A valid UUID for database storage
 */
export function generateSessionId(): string {
  return generateUUID();
}

/**
 * Generate an address book entry ID (UUID)
 *
 * @returns A valid UUID for database storage
 */
export function generateAddressBookId(): string {
  return generateUUID();
}

/**
 * Check if a string is a valid UUID
 *
 * @param id - String to check
 * @returns True if valid UUID format
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Generate a deterministic UUID from transaction data
 * Useful for preventing duplicate transactions
 *
 * @param txData - Transaction data to hash
 * @param txData.from
 * @param txData.to
 * @param txData.amount
 * @param txData.nonce
 * @param txData.chainId
 * @returns A deterministic UUID-like string
 */
export function generateDeterministicTxId(txData: {
  from: string;
  to: string;
  amount: string;
  nonce: number;
  chainId: number;
}): string {
  const hash = crypto.createHash('sha256')
    .update(txData.from.toLowerCase())
    .update(txData.to.toLowerCase())
    .update(txData.amount)
    .update(txData.nonce.toString())
    .update(txData.chainId.toString())
    .digest('hex');

  // Format as UUID
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16), // Version 4
    ((parseInt(hash.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20), // Variant
    hash.slice(20, 32)
  ].join('-');
}

/**
 * ID generation strategies for Wallet
 */
export const IdGenerators = {
  // Database entities (use UUIDs)
  transaction: generateTransactionId,
  batch: generateBatchId,
  session: generateSessionId,
  addressBook: generateAddressBookId,
  uuid: generateUUID,

  // Deterministic IDs
  deterministicTx: generateDeterministicTxId,

  // Validation
  isValid: isValidUUID
};

export default IdGenerators;
