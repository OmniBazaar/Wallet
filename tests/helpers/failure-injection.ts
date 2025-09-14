/**
 * Failure Injection Helper for Testing
 *
 * Provides utilities to inject failures into various services
 * for testing error handling and recovery scenarios.
 */

import { jest } from '@jest/globals';

/**
 * Configuration for failure injection
 */
export interface FailureConfig {
  /** Number of times to fail before succeeding */
  failCount?: number;
  /** Error to throw on failure */
  error?: Error;
  /** Whether to fail permanently */
  permanent?: boolean;
  /** Delay before failing (ms) */
  delay?: number;
}

/**
 * Creates a mock function that fails a specified number of times
 * before succeeding.
 *
 * @param successValue - Value to return on success
 * @param config - Failure configuration
 * @returns Jest mock function
 */
export function createFailingMock<T>(
  successValue: T,
  config: FailureConfig = {}
): jest.Mock {
  const {
    failCount = 1,
    error = new Error('Mock failure'),
    permanent = false,
    delay = 0
  } = config;

  let callCount = 0;

  return jest.fn().mockImplementation(async (...args: unknown[]) => {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    callCount++;

    if (permanent || callCount <= failCount) {
      throw error;
    }

    return typeof successValue === 'function'
      ? successValue(...args)
      : successValue;
  });
}

/**
 * Injects transaction failures into a provider
 *
 * @param provider - Mock provider instance
 * @param config - Failure configuration
 */
export function injectTransactionFailure(
  provider: any,
  config: FailureConfig = {}
): void {
  const originalGetSigner = provider.getSigner;

  provider.getSigner = jest.fn().mockImplementation(async () => {
    const signer = await originalGetSigner.call(provider);

    // Replace sendTransaction with failing version
    signer.sendTransaction = createFailingMock(
      { hash: '0x' + '1'.repeat(64) },
      config
    );

    return signer;
  });
}

/**
 * Injects IPFS storage failures
 *
 * @param storageService - Mock storage service
 * @param config - Failure configuration
 */
export function injectStorageFailure(
  storageService: any,
  config: FailureConfig = {}
): void {
  const originalStore = storageService.storeData;

  storageService.storeData = createFailingMock(
    (data: unknown) => {
      // Call original implementation on success
      if (originalStore) {
        return originalStore.call(storageService, data);
      }
      return 'Qm' + '1'.repeat(44); // Mock CID
    },
    config
  );
}

/**
 * Injects database failures
 *
 * @param database - Mock database instance
 * @param method - Method to make fail
 * @param config - Failure configuration
 */
export function injectDatabaseFailure(
  database: any,
  method: string,
  config: FailureConfig = {}
): void {
  const original = database[method];

  database[method] = createFailingMock(
    (...args: unknown[]) => {
      if (original) {
        return original.apply(database, args);
      }
      return true;
    },
    config
  );
}

/**
 * Resets all failure injections on an object
 *
 * @param obj - Object to reset
 */
export function resetFailures(obj: any): void {
  Object.keys(obj).forEach(key => {
    if (typeof obj[key] === 'function' && 'mockRestore' in obj[key]) {
      (obj[key] as jest.Mock).mockRestore();
    }
  });
}

/**
 * Creates a provider that simulates network issues
 *
 * @param baseProvider - Base provider to enhance
 * @returns Enhanced provider with failure simulation
 */
export function createUnstableProvider(baseProvider: any): any {
  const unstableProvider = { ...baseProvider };

  // Simulate random network failures
  unstableProvider.getBalance = jest.fn().mockImplementation(async (address: string) => {
    if (Math.random() < 0.3) { // 30% failure rate
      throw new Error('Network timeout');
    }
    return baseProvider.getBalance(address);
  });

  unstableProvider.sendTransaction = jest.fn().mockImplementation(async (tx: any) => {
    if (Math.random() < 0.2) { // 20% failure rate
      throw new Error('Transaction broadcast failed');
    }
    return baseProvider.sendTransaction(tx);
  });

  return unstableProvider;
}

/**
 * Helper to test retry logic
 *
 * @param fn - Function to test
 * @param expectedCalls - Expected number of calls before success
 */
export async function testRetryBehavior(
  fn: () => Promise<any>,
  expectedCalls: number
): Promise<void> {
  const mockFn = jest.fn();
  let callCount = 0;

  // Track calls
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    if (args[0]?.toString().includes('Retry')) {
      callCount++;
      mockFn();
    }
  };

  try {
    await fn();
    expect(mockFn).toHaveBeenCalledTimes(expectedCalls - 1);
  } finally {
    console.error = originalConsoleError;
  }
}