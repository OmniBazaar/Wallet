/**
 * Test Environment Setup
 * 
 * This file sets up environment variables and polyfills needed
 * for blockchain and security testing.
 */

// Crypto polyfills for Node.js environment
const { webcrypto } = require('crypto');

// Check current environment
console.log('Test environment:', typeof window !== 'undefined' ? 'jsdom' : 'node');

// For jsdom environment, we need to set crypto differently
if (typeof window !== 'undefined') {
  // In jsdom, set on window and global
  Object.defineProperty(window, 'crypto', {
    value: webcrypto,
    configurable: true,
    enumerable: true,
    writable: true
  });
  global.crypto = webcrypto;
} else {
  // In pure Node environment
  globalThis.crypto = webcrypto;
}

// Verify crypto.subtle is available
if (!global.crypto?.subtle) {
  console.error('WARNING: crypto.subtle is not available in test environment');
  console.log('global.crypto:', typeof global.crypto);
  console.log('global.crypto.subtle:', typeof global.crypto?.subtle);
}

// TextEncoder/TextDecoder polyfills
if (typeof globalThis.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
}

// IndexedDB polyfill for Node.js
if (typeof globalThis.indexedDB === 'undefined') {
  require('fake-indexeddb/auto');
}

// localStorage polyfill for Node.js
if (typeof globalThis.localStorage === 'undefined') {
  const mockLocalStorage = (() => {
    let store = {};
    return {
      getItem: (key) => store[key] || null,
      setItem: (key, value) => store[key] = value,
      removeItem: (key) => delete store[key],
      clear: () => store = {},
      get length() {
        return Object.keys(store).length;
      },
      key: (index) => {
        const keys = Object.keys(store);
        return keys[index] || null;
      }
    };
  })();

  globalThis.localStorage = mockLocalStorage;
  global.localStorage = mockLocalStorage;
}

// Base64 encoding/decoding polyfills for Node.js
if (typeof globalThis.btoa === 'undefined') {
  globalThis.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
  global.btoa = globalThis.btoa;
}

if (typeof globalThis.atob === 'undefined') {
  globalThis.atob = (str) => Buffer.from(str, 'base64').toString('binary');
  global.atob = globalThis.atob;
}

// WebSocket polyfill for Node.js
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = require('ws');
}

// Performance polyfills
if (typeof globalThis.performance === 'undefined') {
  const { performance } = require('perf_hooks');
  globalThis.performance = performance;
}

// Set up test-specific environment variables
process.env.NODE_ENV = 'test';
process.env.JEST_WORKER_ID = process.env.JEST_WORKER_ID || '1';

// Blockchain testing environment
process.env.ENABLE_BLOCKCHAIN_MOCKING = 'true';
process.env.DISABLE_REAL_NETWORK_CALLS = 'true';
process.env.TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

// Security testing environment
process.env.ENABLE_SECURITY_VALIDATION = 'true';
process.env.STRICT_CRYPTO_VALIDATION = 'true';
process.env.ENABLE_TIMING_ATTACK_DETECTION = 'true';

// Performance testing environment
process.env.ENABLE_PERFORMANCE_MONITORING = 'true';
process.env.MEMORY_LEAK_DETECTION = 'true';
process.env.ENABLE_RESOURCE_TRACKING = 'true';

// Mock console methods for cleaner test output
const originalConsole = { ...console };

// Override console methods to reduce noise during tests
console.warn = jest.fn((message, ...args) => {
  if (process.env.ENABLE_TEST_WARNINGS === 'true') {
    originalConsole.warn(message, ...args);
  }
});

console.error = jest.fn((message, ...args) => {
  if (process.env.ENABLE_TEST_ERRORS === 'true') {
    originalConsole.error(message, ...args);
  }
});

// Keep console.log for important test information
console.log = originalConsole.log;

// Set up performance monitoring
let testStartTime = Date.now();
let peakMemoryUsage = 0;

const monitorPerformance = () => {
  const memUsage = process.memoryUsage().heapUsed;
  if (memUsage > peakMemoryUsage) {
    peakMemoryUsage = memUsage;
    process.env.PEAK_MEMORY_USAGE = memUsage.toString();
  }
};

// Monitor performance every 5 seconds during tests
const performanceMonitor = setInterval(monitorPerformance, 5000);

// Ensure the interval doesn't keep the process alive
if (performanceMonitor.unref) {
  performanceMonitor.unref();
}

// Clean up on exit
process.on('exit', () => {
  clearInterval(performanceMonitor);
  console.log(`🎯 Test session complete. Peak memory: ${Math.round(peakMemoryUsage / 1024 / 1024)}MB`);
});

// Error handling for unhandled rejections during tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit during tests, just log the error
});

// Set up global test utilities
globalThis.TEST_UTILS = {
  createRandomAddress: () => {
    const { ethers } = require('ethers');
    return ethers.Wallet.createRandom().address;
  },
  
  createTestMnemonic: () => {
    const bip39 = require('bip39');
    return bip39.generateMnemonic();
  },
  
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  getMemoryUsage: () => process.memoryUsage(),
  
  getCurrentTimestamp: () => Date.now(),
  
  generateSecureRandom: (size = 32) => {
    const crypto = require('crypto');
    return crypto.randomBytes(size);
  }
};

console.log('🔧 Test environment setup complete');
console.log('📋 Available test utilities:', Object.keys(globalThis.TEST_UTILS));