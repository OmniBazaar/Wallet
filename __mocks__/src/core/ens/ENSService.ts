/**
 * Mock ENSService for testing
 */

import { jest } from '@jest/globals';

export class ENSService {
  private static instance: ENSService;

  private constructor() {
    // Mock constructor
  }

  public static getInstance(): ENSService {
    if (!ENSService.instance) {
      ENSService.instance = new ENSService();
    }
    return ENSService.instance;
  }

  public resolve = jest.fn().mockImplementation(async (name: string): Promise<string | null> => {
    // Mock ENS resolution
    if (name === 'testuser.eth') {
      return '0xF4C9aa764684C74595213384d32E2e57798Fd2F9';
    }
    if (name === 'vitalik.eth') {
      return '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
    }
    return null;
  });

  public reverseResolve = jest.fn().mockImplementation(async (address: string): Promise<string | null> => {
    // Mock reverse ENS resolution
    if (address === '0xF4C9aa764684C74595213384d32E2e57798Fd2F9') {
      return 'testuser.eth';
    }
    if (address === '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045') {
      return 'vitalik.eth';
    }
    return null;
  });

  public isValidENSName = jest.fn().mockImplementation((name: string): boolean => {
    return name.endsWith('.eth') || name.endsWith('.omnicoin');
  });

  public namehash = jest.fn().mockImplementation((name: string): string => {
    // Mock namehash - just return a deterministic hash
    let hash = '0x';
    for (let i = 0; i < 64; i++) {
      hash += ((name.charCodeAt(i % name.length) + i) % 16).toString(16);
    }
    return hash;
  });

  // Add missing methods for compatibility with tests
  public resolveAddress = jest.fn().mockImplementation(async (name: string): Promise<string | null> => {
    if (name.endsWith('.omnicoin')) {
      if (name === 'alice.omnicoin') {
        return '0x1234567890123456789012345678901234567890';
      }
      return null;
    }
    if (name.endsWith('.eth')) {
      if (name === 'alice.eth') {
        return '0x1234567890123456789012345678901234567890';
      }
      return this.resolve(name);
    }
    // Check if it's already a valid address
    if (name.startsWith('0x') && name.length === 42) {
      return name;
    }
    return null;
  });

  public resolveAddressForCoin = jest.fn().mockImplementation(async (name: string, coinType: number): Promise<string | null> => {
    // For testing, always return the same address for alice.omnicoin
    if (name === 'alice.omnicoin') {
      return '0x1234567890123456789012345678901234567890';
    }
    return null;
  });

  // Private method made public for testing
  public formatAddressForCoinType = jest.fn().mockImplementation((addressBytes: string, coinType: number): string => {
    // For EVM-compatible chains
    if (coinType === 60) { // ETH
      const cleanBytes = addressBytes.replace('0x', '');
      if (cleanBytes.length === 40) {
        return '0x' + cleanBytes;
      }
      if (cleanBytes.length > 40) {
        return '0x' + cleanBytes.slice(-40);
      }
    }
    return addressBytes;
  });

  // Add static method for testing to reset instance
  public static reset(): void {
    ENSService.instance = null as any;
  }
}