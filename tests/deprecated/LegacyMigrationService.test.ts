/**
 * LegacyMigrationService Test Suite
 * 
 * Tests legacy migration functionality with TypeScript strict compliance validation.
 * Validates contract interaction patterns, error handling, and credential verification.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { ethers } from 'ethers';
import { LegacyMigrationService, type LegacyUserData, type MigrationStatus } from '../../../src/services/LegacyMigrationService';
import { 
  mockWallet, 
  createMockProvider, 
  createMockContract, 
  LEGACY_TEST_DATA, 
  TEST_ADDRESSES,
  cleanupTest 
} from '../../setup';

describe('LegacyMigrationService', () => {
  let service: LegacyMigrationService;
  let mockProvider: any;
  let mockMigrationContract: any;
  let mockValidatorService: any;

  beforeAll(async () => {
    mockProvider = createMockProvider('ethereum');
    
    // Mock migration contract with bracket notation access
    mockMigrationContract = createMockContract('0xMigrationContract', {
      'isClaimed': jest.fn().mockResolvedValue(false),
      'claimBalance': jest.fn().mockResolvedValue({
        hash: '0xclaimtx',
        wait: jest.fn().mockResolvedValue({ status: 1 })
      }),
      'getMigrationStatus': jest.fn().mockResolvedValue([false, ethers.parseEther('0')]),
      'getClaimedBalance': jest.fn().mockResolvedValue(ethers.parseEther('1'))
    });

    // Mock validator service
    mockValidatorService = {
      validateLegacyUser: jest.fn().mockResolvedValue({
        isValid: true,
        signature: '0xvalidatorsig',
        balance: '1000000'
      }),
      getValidatorSignature: jest.fn().mockResolvedValue('0xvalidatorsig')
    };

    service = new LegacyMigrationService(mockProvider, {
      migrationContract: mockMigrationContract.address,
      validatorService: mockValidatorService,
      csvPath: './test-data/legacy-users.csv'
    });
  });

  afterAll(() => {
    cleanupTest();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(service).toBeDefined();
      expect(service.getConfiguration()).toMatchObject({
        migrationContract: mockMigrationContract.address,
        csvPath: './test-data/legacy-users.csv'
      });
    });

    it('should handle missing configuration gracefully', () => {
      expect(() => {
        new LegacyMigrationService(mockProvider, {});
      }).toThrow('Migration contract address is required');
    });

    it('should validate contract address format', () => {
      expect(() => {
        new LegacyMigrationService(mockProvider, {
          migrationContract: 'invalid-address'
        });
      }).toThrow('Invalid contract address format');
    });
  });

  describe('Legacy User Data Loading', () => {
    it('should load legacy users from CSV', async () => {
      // Mock CSV data
      const csvData = LEGACY_TEST_DATA.users.map(user => 
        `${user.accountId},${user.username},${user.balance},${user.balanceDecimal},${user.balanceType}`
      ).join('\n');

      jest.spyOn(require('fs').promises, 'readFile').mockResolvedValue(csvData);

      const users = await service.loadLegacyUsers();
      
      expect(users).toHaveLength(2);
      expect(users[0]).toMatchObject({
        accountId: 'legacy-account-1',
        username: 'testuser1',
        balance: '1000000'
      });
    });

    it('should handle malformed CSV data', async () => {
      const malformedCsv = 'invalid,csv,data';
      jest.spyOn(require('fs').promises, 'readFile').mockResolvedValue(malformedCsv);

      await expect(service.loadLegacyUsers()).rejects.toThrow('Invalid CSV format');
    });

    it('should validate user data fields', async () => {
      const invalidCsv = 'id,,invalid-balance,1.0,COMBINED'; // missing username
      jest.spyOn(require('fs').promises, 'readFile').mockResolvedValue(invalidCsv);

      await expect(service.loadLegacyUsers()).rejects.toThrow('Invalid user data');
    });
  });

  describe('Credential Validation', () => {
    it('should validate correct legacy credentials', async () => {
      const result = await service.validateLegacyCredentials(
        LEGACY_TEST_DATA.validCredentials.username,
        LEGACY_TEST_DATA.validCredentials.password
      );

      expect(result.isValid).toBe(true);
      expect(result.userData).toBeDefined();
      expect(result.userData?.username).toBe('testuser1');
      expect(mockValidatorService.validateLegacyUser).toHaveBeenCalledWith(
        LEGACY_TEST_DATA.validCredentials.username,
        LEGACY_TEST_DATA.validCredentials.password
      );
    });

    it('should reject invalid credentials', async () => {
      mockValidatorService.validateLegacyUser.mockResolvedValueOnce({
        isValid: false,
        signature: null,
        balance: '0'
      });

      const result = await service.validateLegacyCredentials(
        LEGACY_TEST_DATA.invalidCredentials.username,
        LEGACY_TEST_DATA.invalidCredentials.password
      );

      expect(result.isValid).toBe(false);
      expect(result.userData).toBeUndefined();
      expect(result.error).toContain('Invalid credentials');
    });

    it('should handle empty credentials', async () => {
      await expect(service.validateLegacyCredentials('', '')).rejects.toThrow(
        'Username and password are required'
      );
    });

    it('should handle special characters in credentials', async () => {
      const specialUsername = 'user@domain.com';
      const specialPassword = 'pass!@#$%^&*()';

      const result = await service.validateLegacyCredentials(specialUsername, specialPassword);
      
      expect(mockValidatorService.validateLegacyUser).toHaveBeenCalledWith(
        specialUsername,
        specialPassword
      );
    });
  });

  describe('Migration Status Checking', () => {
    it('should get migration status for existing user', async () => {
      const status = await service.getMigrationStatus('testuser1');

      expect(status).toMatchObject({
        username: 'testuser1',
        isLegacyUser: true,
        isClaimed: false,
        legacyBalance: expect.any(String),
        newBalance: expect.any(String)
      });

      expect(mockMigrationContract['isClaimed']).toHaveBeenCalled();
    });

    it('should handle non-existent user', async () => {
      const status = await service.getMigrationStatus('nonexistent');

      expect(status.isLegacyUser).toBe(false);
      expect(status.legacyBalance).toBe('0');
    });

    it('should check claim status from contract using bracket notation', async () => {
      mockMigrationContract['isClaimed'].mockResolvedValueOnce(true);
      mockMigrationContract['getClaimedBalance'].mockResolvedValueOnce(ethers.parseEther('1'));

      const status = await service.getMigrationStatus('testuser1');

      expect(status.isClaimed).toBe(true);
      expect(status.newBalance).toBe(ethers.formatEther(ethers.parseEther('1')));
    });
  });

  describe('Balance Claiming with TypeScript Strict Compliance', () => {
    it('should claim balance with valid signature', async () => {
      const signer = await mockProvider.getSigner();
      
      const result = await service.claimBalance({
        username: LEGACY_TEST_DATA.validCredentials.username,
        password: LEGACY_TEST_DATA.validCredentials.password,
        targetAddress: TEST_ADDRESSES.ethereum,
        signer
      });

      expect(result.success).toBe(true);
      expect(result.transactionHash).toBeDefined();
      expect(result.claimedAmount).toBeDefined();
      
      // Verify contract method called with bracket notation
      expect(mockMigrationContract['claimBalance']).toHaveBeenCalled();
    });

    it('should handle insufficient signature validation', async () => {
      mockValidatorService.validateLegacyUser.mockResolvedValueOnce({
        isValid: false,
        signature: null,
        balance: '0'
      });

      const signer = await mockProvider.getSigner();

      await expect(service.claimBalance({
        username: 'invalid-user',
        password: 'wrong-password',
        targetAddress: TEST_ADDRESSES.ethereum,
        signer
      })).rejects.toThrow('Credential validation failed');
    });

    it('should prevent double claiming', async () => {
      mockMigrationContract['isClaimed'].mockResolvedValueOnce(true);

      const signer = await mockProvider.getSigner();

      await expect(service.claimBalance({
        username: LEGACY_TEST_DATA.validCredentials.username,
        password: LEGACY_TEST_DATA.validCredentials.password,
        targetAddress: TEST_ADDRESSES.ethereum,
        signer
      })).rejects.toThrow('Balance already claimed');
    });

    it('should validate target address format', async () => {
      const signer = await mockProvider.getSigner();

      await expect(service.claimBalance({
        username: LEGACY_TEST_DATA.validCredentials.username,
        password: LEGACY_TEST_DATA.validCredentials.password,
        targetAddress: 'invalid-address',
        signer
      })).rejects.toThrow('Invalid target address');
    });

    it('should handle contract transaction failures', async () => {
      mockMigrationContract['claimBalance'].mockRejectedValueOnce(new Error('Transaction failed'));

      const signer = await mockProvider.getSigner();

      await expect(service.claimBalance({
        username: LEGACY_TEST_DATA.validCredentials.username,
        password: LEGACY_TEST_DATA.validCredentials.password,
        targetAddress: TEST_ADDRESSES.ethereum,
        signer
      })).rejects.toThrow('Transaction failed');
    });
  });

  describe('Balance Conversion (6 to 18 decimals)', () => {
    it('should convert 6-decimal legacy balance to 18-decimal format', () => {
      const legacy6Decimal = '1000000'; // 1 XOM in 6 decimals
      const converted18Decimal = service.convertLegacyBalance(legacy6Decimal);
      
      expect(converted18Decimal).toBe(ethers.parseEther('1').toString());
    });

    it('should handle zero balance', () => {
      const converted = service.convertLegacyBalance('0');
      expect(converted).toBe('0');
    });

    it('should handle large balances', () => {
      const largeLegacy = '1000000000000'; // 1M XOM in 6 decimals
      const converted = service.convertLegacyBalance(largeLegacy);
      
      expect(converted).toBe(ethers.parseEther('1000000').toString());
    });

    it('should validate numeric input', () => {
      expect(() => service.convertLegacyBalance('invalid')).toThrow(
        'Invalid numeric value'
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle network connectivity issues', async () => {
      mockProvider.getBalance.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.getMigrationStatus('testuser1')).rejects.toThrow('Network error');
    });

    it('should handle contract not deployed', async () => {
      mockProvider.getCode.mockResolvedValueOnce('0x');

      await expect(service.validateContractDeployment()).rejects.toThrow(
        'Migration contract not deployed'
      );
    });

    it('should handle malformed validator signatures', async () => {
      mockValidatorService.validateLegacyUser.mockResolvedValueOnce({
        isValid: true,
        signature: 'invalid-signature',
        balance: '1000000'
      });

      const signer = await mockProvider.getSigner();

      await expect(service.claimBalance({
        username: LEGACY_TEST_DATA.validCredentials.username,
        password: LEGACY_TEST_DATA.validCredentials.password,
        targetAddress: TEST_ADDRESSES.ethereum,
        signer
      })).rejects.toThrow('Invalid validator signature');
    });

    it('should handle ethers v6 parsing errors', async () => {
      // Test ethers.parseEther with invalid input
      expect(() => {
        service.convertLegacyBalance('not-a-number');
      }).toThrow();
    });
  });

  describe('Security and Input Validation', () => {
    it('should sanitize user inputs', async () => {
      const maliciousInput = '<script>alert("xss")</script>';
      
      await expect(service.validateLegacyCredentials(maliciousInput, 'password'))
        .rejects.toThrow('Invalid username format');
    });

    it('should enforce password complexity requirements', async () => {
      const weakPassword = '123';
      
      await expect(service.validateLegacyCredentials('user', weakPassword))
        .rejects.toThrow('Password does not meet requirements');
    });

    it('should prevent SQL injection in username', async () => {
      const sqlInjection = "'; DROP TABLE users; --";
      
      await expect(service.validateLegacyCredentials(sqlInjection, 'password'))
        .rejects.toThrow('Invalid username format');
    });

    it('should validate signature format before contract call', async () => {
      mockValidatorService.validateLegacyUser.mockResolvedValueOnce({
        isValid: true,
        signature: '0xinvalid', // Too short
        balance: '1000000'
      });

      const signer = await mockProvider.getSigner();

      await expect(service.claimBalance({
        username: LEGACY_TEST_DATA.validCredentials.username,
        password: LEGACY_TEST_DATA.validCredentials.password,
        targetAddress: TEST_ADDRESSES.ethereum,
        signer
      })).rejects.toThrow('Invalid signature format');
    });
  });

  describe('Gas Estimation and Transaction Optimization', () => {
    it('should estimate gas for claim transaction', async () => {
      mockMigrationContract.estimateGas = {
        claimBalance: jest.fn().mockResolvedValue(150000n)
      };

      const gasEstimate = await service.estimateClaimGas(
        TEST_ADDRESSES.ethereum,
        '0xvalidatorsignature',
        '1000000'
      );

      expect(gasEstimate).toBe(150000n);
    });

    it('should optimize transaction with appropriate gas limit', async () => {
      const signer = await mockProvider.getSigner();
      
      await service.claimBalance({
        username: LEGACY_TEST_DATA.validCredentials.username,
        password: LEGACY_TEST_DATA.validCredentials.password,
        targetAddress: TEST_ADDRESSES.ethereum,
        signer,
        gasLimit: 200000n
      });

      expect(mockMigrationContract['claimBalance']).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        { gasLimit: 200000n }
      );
    });
  });

  describe('Integration with Ethers v6', () => {
    it('should use parseEther correctly for amount conversion', () => {
      const amount = '1.5';
      const parsed = ethers.parseEther(amount);
      
      expect(parsed).toBe(1500000000000000000n);
      expect(typeof parsed).toBe('bigint');
    });

    it('should use MaxUint256 for unlimited approvals', async () => {
      const maxValue = ethers.MaxUint256;
      
      expect(typeof maxValue).toBe('bigint');
      expect(maxValue.toString()).toBe('115792089237316195423570985008687907853269984665640564039457584007913129639935');
    });

    it('should handle contract method calls with bracket notation', async () => {
      // Test that bracket notation works for contract methods
      const result = await mockMigrationContract['isClaimed'](TEST_ADDRESSES.ethereum);
      
      expect(mockMigrationContract['isClaimed']).toHaveBeenCalledWith(TEST_ADDRESSES.ethereum);
      expect(result).toBeDefined();
    });

    it('should properly format addresses for contract calls', () => {
      const address = TEST_ADDRESSES.ethereum;
      
      expect(ethers.isAddress(address)).toBe(true);
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  describe('Bulk Migration Operations', () => {
    it('should handle bulk user validation', async () => {
      const users = [
        { username: 'user1', password: 'pass1' },
        { username: 'user2', password: 'pass2' }
      ];

      const results = await service.validateBulkCredentials(users);

      expect(results).toHaveLength(2);
      expect(mockValidatorService.validateLegacyUser).toHaveBeenCalledTimes(2);
    });

    it('should provide migration progress tracking', async () => {
      const progress = await service.getMigrationProgress();

      expect(progress).toMatchObject({
        totalUsers: expect.any(Number),
        claimedUsers: expect.any(Number),
        pendingUsers: expect.any(Number),
        percentComplete: expect.any(Number)
      });
    });

    it('should export migration report', async () => {
      const report = await service.generateMigrationReport();

      expect(report).toMatchObject({
        timestamp: expect.any(Number),
        totalLegacyBalance: expect.any(String),
        totalClaimedBalance: expect.any(String),
        userStats: expect.any(Array)
      });
    });
  });
});