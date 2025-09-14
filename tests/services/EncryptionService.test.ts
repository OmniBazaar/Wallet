/**
 * EncryptionService Tests
 * Comprehensive tests for encryption and decryption functionality
 */

import { EncryptionService, EncryptedData, EncryptionOptions } from '../../src/services/EncryptionService';
import { ethers } from 'ethers';

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(async () => {
    service = new EncryptionService();
    await service.init();
  });

  afterEach(async () => {
    await service.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const newService = new EncryptionService();
      await expect(newService.init()).resolves.not.toThrow();
    });

    it('should handle multiple initialization calls', async () => {
      await service.init();
      await service.init(); // Should not throw
    });

    it('should accept custom options', async () => {
      const customService = new EncryptionService({
        algorithm: 'AES-256-GCM',
        iterations: 50000,
        saltLength: 16,
        ivLength: 12
      });
      await expect(customService.init()).resolves.not.toThrow();
    });
  });

  describe('Basic Encryption/Decryption', () => {
    const testPassword = 'testPassword123!@#';
    const testData = 'This is sensitive data that needs encryption';

    it('should encrypt and decrypt string data', async () => {
      const encrypted = await service.encrypt(testData, testPassword);
      
      expect(encrypted).toBeDefined();
      expect(encrypted.data).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.salt).toBeDefined();
      expect(encrypted.tag).toBeDefined();
      expect(encrypted.algorithm).toBe('AES-256-GCM');
      
      const decrypted = await service.decryptToString(encrypted, testPassword);
      expect(decrypted).toBe(testData);
    });

    it('should encrypt and decrypt binary data', async () => {
      const binaryData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      
      const encrypted = await service.encrypt(binaryData, testPassword);
      const decrypted = await service.decrypt(encrypted, testPassword);
      
      expect(decrypted).toBeInstanceOf(Uint8Array);
      expect(Array.from(decrypted)).toEqual(Array.from(binaryData));
    });

    it('should produce different ciphertexts for same data', async () => {
      const encrypted1 = await service.encrypt(testData, testPassword);
      const encrypted2 = await service.encrypt(testData, testPassword);
      
      // Different IVs and salts should produce different ciphertexts
      expect(encrypted1.data).not.toBe(encrypted2.data);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.salt).not.toBe(encrypted2.salt);
      
      // But both should decrypt to same data
      const decrypted1 = await service.decryptToString(encrypted1, testPassword);
      const decrypted2 = await service.decryptToString(encrypted2, testPassword);
      expect(decrypted1).toBe(testData);
      expect(decrypted2).toBe(testData);
    });

    it('should handle empty data', async () => {
      const emptyData = '';
      
      const encrypted = await service.encrypt(emptyData, testPassword);
      const decrypted = await service.decryptToString(encrypted, testPassword);
      
      expect(decrypted).toBe(emptyData);
    });

    it('should handle large data', async () => {
      const largeData = 'A'.repeat(1000000); // 1MB of data
      
      const encrypted = await service.encrypt(largeData, testPassword);
      const decrypted = await service.decryptToString(encrypted, testPassword);
      
      expect(decrypted).toBe(largeData);
    });
  });

  describe('Password Security', () => {
    const testData = 'Secret information';

    it('should fail decryption with wrong password', async () => {
      const encrypted = await service.encrypt(testData, 'correctPassword');
      
      await expect(service.decrypt(encrypted, 'wrongPassword'))
        .rejects.toThrow('Decryption failed');
    });

    it('should handle special characters in password', async () => {
      const specialPassword = 'P@ssw0rd!#$%^&*()_+-=[]{}|;:,.<>?';
      
      const encrypted = await service.encrypt(testData, specialPassword);
      const decrypted = await service.decryptToString(encrypted, specialPassword);
      
      expect(decrypted).toBe(testData);
    });

    it('should handle unicode in password', async () => {
      const unicodePassword = 'パスワード🔐🔑';
      
      const encrypted = await service.encrypt(testData, unicodePassword);
      const decrypted = await service.decryptToString(encrypted, unicodePassword);
      
      expect(decrypted).toBe(testData);
    });

    it('should handle very long passwords', async () => {
      const longPassword = 'x'.repeat(1000);
      
      const encrypted = await service.encrypt(testData, longPassword);
      const decrypted = await service.decryptToString(encrypted, longPassword);
      
      expect(decrypted).toBe(testData);
    });
  });

  describe('Data Integrity', () => {
    const password = 'testPassword';
    const testData = 'Integrity test data';

    it('should detect tampered ciphertext', async () => {
      const encrypted = await service.encrypt(testData, password);
      
      // Tamper with the ciphertext
      const tamperedData = JSON.parse(JSON.stringify(encrypted));
      const bytes = ethers.getBytes(tamperedData.data);
      bytes[0] ^= 0xFF; // Flip bits in first byte
      tamperedData.data = ethers.hexlify(bytes);
      
      await expect(service.decrypt(tamperedData, password))
        .rejects.toThrow();
    });

    it('should detect tampered IV', async () => {
      const encrypted = await service.encrypt(testData, password);
      
      // Tamper with the IV
      const tamperedData = JSON.parse(JSON.stringify(encrypted));
      const ivBytes = ethers.getBytes(tamperedData.iv);
      ivBytes[0] ^= 0xFF;
      tamperedData.iv = ethers.hexlify(ivBytes);
      
      await expect(service.decrypt(tamperedData, password))
        .rejects.toThrow();
    });

    it('should detect tampered tag', async () => {
      const encrypted = await service.encrypt(testData, password);
      
      // Tamper with the tag
      const tamperedData = JSON.parse(JSON.stringify(encrypted));
      if (tamperedData.tag) {
        const tagBytes = ethers.getBytes(tamperedData.tag);
        tagBytes[0] ^= 0xFF;
        tamperedData.tag = ethers.hexlify(tagBytes);
      }
      
      await expect(service.decrypt(tamperedData, password))
        .rejects.toThrow();
    });

    it('should detect missing authentication tag', async () => {
      const encrypted = await service.encrypt(testData, password);
      
      // Remove the tag
      const tamperedData = JSON.parse(JSON.stringify(encrypted));
      delete tamperedData.tag;
      
      await expect(service.decrypt(tamperedData, password))
        .rejects.toThrow('Authentication tag required');
    });
  });

  describe('Random Number Generation', () => {
    it('should generate random bytes', () => {
      const length = 32;
      const bytes = service.generateRandomBytes(length);
      
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(length);
      
      // Check randomness (should not be all zeros)
      const sum = Array.from(bytes).reduce((a, b) => a + b, 0);
      expect(sum).toBeGreaterThan(0);
    });

    it('should generate different random values', () => {
      const bytes1 = service.generateRandomBytes(32);
      const bytes2 = service.generateRandomBytes(32);
      
      expect(ethers.hexlify(bytes1)).not.toBe(ethers.hexlify(bytes2));
    });

    it('should generate random hex strings', () => {
      const length = 16;
      const hex = service.generateRandomHex(length);
      
      expect(hex).toMatch(/^0x[a-f0-9]{32}$/i); // 16 bytes = 32 hex chars
      expect(ethers.getBytes(hex).length).toBe(length);
    });
  });

  describe('Hashing', () => {
    it('should hash string data', async () => {
      const data = 'Hello, World!';
      const hash = await service.hash(data);
      
      expect(hash).toMatch(/^0x[a-f0-9]{64}$/i); // SHA-256 = 64 hex chars
    });

    it('should hash binary data', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const hash = await service.hash(data);
      
      expect(hash).toMatch(/^0x[a-f0-9]{64}$/i);
    });

    it('should produce consistent hashes', async () => {
      const data = 'Consistent hash test';
      const hash1 = await service.hash(data);
      const hash2 = await service.hash(data);
      
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different data', async () => {
      const hash1 = await service.hash('data1');
      const hash2 = await service.hash('data2');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Password Strength Checking', () => {
    it('should score weak passwords low', () => {
      expect(service.checkPasswordStrength('123')).toBeLessThan(30);
      expect(service.checkPasswordStrength('password')).toBeLessThan(40);
      expect(service.checkPasswordStrength('12345678')).toBeLessThan(50);
    });

    it('should score strong passwords high', () => {
      expect(service.checkPasswordStrength('MyStr0ng!P@ssw0rd')).toBeGreaterThan(80);
      expect(service.checkPasswordStrength('C0mpl3x!ty#R3qu1r3d')).toBeGreaterThan(80);
    });

    it('should check password length', () => {
      expect(service.checkPasswordStrength('short')).toBeLessThan(
        service.checkPasswordStrength('muchlongerpassword')
      );
    });

    it('should check character diversity', () => {
      expect(service.checkPasswordStrength('lowercase')).toBeLessThan(
        service.checkPasswordStrength('LowerAndUpper')
      );
      expect(service.checkPasswordStrength('NoNumbers')).toBeLessThan(
        service.checkPasswordStrength('With123Numbers')
      );
      expect(service.checkPasswordStrength('NoSpecial123')).toBeLessThan(
        service.checkPasswordStrength('With!Special@123')
      );
    });

    it('should penalize repeated characters', () => {
      expect(service.checkPasswordStrength('AAAbbb111')).toBeLessThan(
        service.checkPasswordStrength('Abc123Xyz')
      );
    });

    it('should penalize common sequences', () => {
      expect(service.checkPasswordStrength('abc123qwe')).toBeLessThan(
        service.checkPasswordStrength('zxc456poi')
      );
    });
  });

  describe('Encryption Options', () => {
    const testData = 'Test with options';
    const password = 'optionsPassword';

    it('should respect custom iterations', async () => {
      const options: EncryptionOptions = {
        iterations: 50000
      };
      
      const encrypted = await service.encrypt(testData, password, options);
      expect(encrypted.keyDerivation.iterations).toBe(50000);
      
      const decrypted = await service.decryptToString(encrypted, password);
      expect(decrypted).toBe(testData);
    });

    it('should respect custom salt length', async () => {
      const options: EncryptionOptions = {
        saltLength: 16
      };
      
      const encrypted = await service.encrypt(testData, password, options);
      const saltBytes = ethers.getBytes(encrypted.salt);
      expect(saltBytes.length).toBe(16);
    });

    it('should respect custom IV length', async () => {
      const options: EncryptionOptions = {
        ivLength: 12
      };
      
      const encrypted = await service.encrypt(testData, password, options);
      const ivBytes = ethers.getBytes(encrypted.iv);
      expect(ivBytes.length).toBe(12);
    });

    it('should maintain compatibility between different options', async () => {
      // Encrypt with default options
      const encrypted1 = await service.encrypt(testData, password);
      
      // Create new service with different defaults
      const service2 = new EncryptionService({
        iterations: 50000,
        saltLength: 16,
        ivLength: 12
      });
      await service2.init();
      
      // Should still decrypt data encrypted with different options
      const decrypted = await service2.decryptToString(encrypted1, password);
      expect(decrypted).toBe(testData);
    });
  });

  describe('Error Handling', () => {
    it('should throw when not initialized', async () => {
      const uninitService = new EncryptionService();
      
      await expect(uninitService.encrypt('data', 'password'))
        .rejects.toThrow('Encryption service not initialized');
      
      await expect(uninitService.decrypt({} as EncryptedData, 'password'))
        .rejects.toThrow('Encryption service not initialized');
    });

    it('should handle invalid encrypted data format', async () => {
      const invalidData: EncryptedData = {
        data: 'not-hex',
        iv: 'not-hex',
        salt: 'not-hex',
        algorithm: 'AES-256-GCM',
        keyDerivation: {
          iterations: 100000,
          algorithm: 'PBKDF2'
        }
      };
      
      await expect(service.decrypt(invalidData, 'password'))
        .rejects.toThrow();
    });

    it('should reject unsupported algorithms', async () => {
      const unsupportedData: EncryptedData = {
        data: '0x1234',
        iv: '0x5678',
        salt: '0x9abc',
        algorithm: 'UNSUPPORTED' as any,
        keyDerivation: {
          iterations: 100000,
          algorithm: 'PBKDF2'
        }
      };
      
      await expect(service.decrypt(unsupportedData, 'password'))
        .rejects.toThrow('Unsupported decryption algorithm');
    });
  });

  describe('Unicode and Special Characters', () => {
    const password = 'unicodePassword';

    it('should encrypt/decrypt unicode text', async () => {
      const unicodeData = '你好世界 🌍 مرحبا بالعالم';
      
      const encrypted = await service.encrypt(unicodeData, password);
      const decrypted = await service.decryptToString(encrypted, password);
      
      expect(decrypted).toBe(unicodeData);
    });

    it('should handle emoji', async () => {
      const emojiData = '🔐🔑🛡️🔒🗝️';
      
      const encrypted = await service.encrypt(emojiData, password);
      const decrypted = await service.decryptToString(encrypted, password);
      
      expect(decrypted).toBe(emojiData);
    });

    it('should handle mixed content', async () => {
      const mixedData = 'Test: 测试 (тест) [テスト] {테스트} ♠♣♥♦';
      
      const encrypted = await service.encrypt(mixedData, password);
      const decrypted = await service.decryptToString(encrypted, password);
      
      expect(decrypted).toBe(mixedData);
    });
  });

  describe('Memory Management', () => {
    it('should clear cache', async () => {
      await expect(service.clearCache()).resolves.not.toThrow();
    });

    it('should cleanup resources', async () => {
      await expect(service.cleanup()).resolves.not.toThrow();
      
      // Should be able to reinitialize after cleanup
      await expect(service.init()).resolves.not.toThrow();
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should handle both browser and Node.js environments', async () => {
      const data = 'Cross-platform test';
      const password = 'testPassword';
      
      // This test runs in Node.js environment (Jest)
      // The service should use fallback implementations
      const encrypted = await service.encrypt(data, password);
      const decrypted = await service.decryptToString(encrypted, password);
      
      expect(decrypted).toBe(data);
    });
  });

  describe('Performance', () => {
    it('should handle multiple concurrent operations', async () => {
      const operations = Array.from({ length: 10 }, async (_, i) => {
        const data = `Concurrent data ${i}`;
        const password = `password${i}`;
        
        const encrypted = await service.encrypt(data, password);
        const decrypted = await service.decryptToString(encrypted, password);
        
        return decrypted === data;
      });
      
      const results = await Promise.all(operations);
      expect(results.every(r => r)).toBe(true);
    });

    it('should handle rapid encrypt/decrypt cycles', async () => {
      const data = 'Rapid cycle test';
      const password = 'cyclePassword';
      
      for (let i = 0; i < 50; i++) {
        const encrypted = await service.encrypt(data, password);
        const decrypted = await service.decryptToString(encrypted, password);
        expect(decrypted).toBe(data);
      }
    });
  });
});