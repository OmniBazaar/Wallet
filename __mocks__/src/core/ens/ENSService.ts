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
    return name.endsWith('.eth') && name.length > 4;
  });

  public namehash = jest.fn().mockImplementation((name: string): string => {
    // Mock namehash - just return a deterministic hash
    let hash = '0x';
    for (let i = 0; i < 64; i++) {
      hash += ((name.charCodeAt(i % name.length) + i) % 16).toString(16);
    }
    return hash;
  });

  // Add static method for testing to reset instance
  public static reset(): void {
    ENSService.instance = null as any;
  }
}