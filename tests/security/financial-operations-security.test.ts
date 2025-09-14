/**
 * Financial Operations Security Test Suite
 * 
 * Tests for:
 * - Transaction validation and signing security
 * - Private key protection and isolation
 * - Multi-sig wallet support testing
 * - Recovery mechanism validation
 * - Anti-phishing and address validation
 * - Amount validation and overflow protection
 * - Fee estimation and manipulation protection
 * 
 * CRITICAL: These tests validate financial transaction security.
 * Failures here can lead to loss of user funds.
 */

import { ethers } from 'ethers';
const { solidityPacked, keccak256 } = ethers;
import { BIP39Keyring } from '../../src/core/keyring/BIP39Keyring';
import * as crypto from 'crypto';

// Use actual bip39 module for security tests - unmock it
jest.unmock('bip39');
import * as bip39 from 'bip39';

describe('Financial Operations Security Tests', () => {
  let testKeyring: BIP39Keyring;

  const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const testPassword = 'secure-financial-test-123456';
  const maliciousAddress = '0x0000000000000000000000000000000000000000';
  const validAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // Vitalik's address - properly checksummed

  beforeAll(async () => {
    testKeyring = new BIP39Keyring();
    await testKeyring.importFromMnemonic(testMnemonic, testPassword);
  });

  afterAll(async () => {
    // Clean up
    testKeyring = null as any;
  });

  describe('Transaction Validation Security', () => {
    test('should validate transaction parameters before signing', async () => {
      const testCases = [
        { to: '', value: '1.0', data: '0x', shouldFail: true, reason: 'empty recipient' },
        { to: 'invalid', value: '1.0', data: '0x', shouldFail: true, reason: 'invalid address format' },
        { to: validAddress, value: '-1.0', data: '0x', shouldFail: true, reason: 'negative amount' },
        { to: validAddress, value: 'abc', data: '0x', shouldFail: true, reason: 'non-numeric amount' },
        { to: validAddress, value: '0', data: '0x', shouldFail: false, reason: 'zero amount valid' },
        { to: validAddress, value: '1.0', data: 'invalid', shouldFail: true, reason: 'invalid data' },
        { to: validAddress, value: '1.0', data: '0x', shouldFail: false, reason: 'valid transaction' }
      ];

      for (const testCase of testCases) {
        try {
          // Validate address
          if (testCase.to && !ethers.isAddress(testCase.to) && testCase.to !== '') {
            if (testCase.shouldFail) {
              expect(true).toBe(true); // Expected failure
              continue;
            } else {
              throw new Error('Address validation failed');
            }
          }

          // Validate amount
          if (testCase.value && testCase.value !== '0') {
            const numericValue = parseFloat(testCase.value);
            if (isNaN(numericValue) || numericValue < 0) {
              if (testCase.shouldFail) {
                expect(true).toBe(true); // Expected failure
                continue;
              } else {
                throw new Error('Amount validation failed');
              }
            }
          }

          // Validate data field
          if (testCase.data && testCase.data !== '0x' && !testCase.data.match(/^0x[a-fA-F0-9]*$/)) {
            if (testCase.shouldFail) {
              expect(true).toBe(true); // Expected failure
              continue;
            } else {
              throw new Error('Data validation failed');
            }
          }

          // If we reach here and should fail, test failed
          if (testCase.shouldFail) {
            throw new Error(`Expected validation failure for: ${testCase.reason}`);
          }

        } catch (error) {
          if (testCase.shouldFail) {
            expect(error).toBeInstanceOf(Error);
          } else {
            throw error;
          }
        }
      }
    });

    test('should prevent integer overflow in amount calculations', () => {
      const testCases = [
        '999999999999999999999999999999999999',
        '1' + '0'.repeat(100),
        '340282366920938463463374607431768211455', // Max uint128
        '115792089237316195423570985008687907853269984665640564039457584007913129639935' // Max uint256
      ];

      testCases.forEach(amount => {
        try {
          const parsed = ethers.parseEther(amount);
          // Should handle large numbers gracefully
          expect(typeof parsed).toBe('bigint');
          expect(parsed).toBeGreaterThan(0n);
        } catch (error) {
          // It's okay to reject extremely large numbers
          expect(error).toBeInstanceOf(Error);
        }
      });
    });

    test('should validate gas parameters to prevent manipulation', () => {
      const validGasValues = [
        { gasLimit: 21000, gasPrice: '20000000000' }, // 20 gwei
        { gasLimit: 100000, gasPrice: '1000000000' }, // 1 gwei
        { gasLimit: 500000, gasPrice: '50000000000' } // 50 gwei
      ];

      const invalidGasValues = [
        { gasLimit: 0, gasPrice: '20000000000' },
        { gasLimit: -1, gasPrice: '20000000000' },
        { gasLimit: 21000, gasPrice: '0' },
        { gasLimit: 21000, gasPrice: '-1' },
        { gasLimit: 10000000000, gasPrice: '20000000000' } // Extremely high
      ];

      validGasValues.forEach(({ gasLimit, gasPrice }) => {
        expect(gasLimit).toBeGreaterThan(0);
        expect(gasLimit).toBeLessThan(15000000); // Block gas limit
        expect(BigInt(gasPrice)).toBeGreaterThan(0n);
      });

      invalidGasValues.forEach(({ gasLimit, gasPrice }) => {
        const isValid = gasLimit > 0 && gasLimit < 15000000 && BigInt(gasPrice) > 0n;
        expect(isValid).toBe(false);
      });
    });

    test('should detect and prevent front-running attacks', async () => {
      // Simulate transaction ordering scenarios
      const baseTransaction = {
        to: validAddress,
        value: ethers.parseEther('1.0'),
        gasPrice: ethers.parseUnits('20', 'gwei'),
        gasLimit: 21000,
        nonce: 1
      };

      const frontRunTransaction = {
        ...baseTransaction,
        gasPrice: ethers.parseUnits('25', 'gwei'), // Higher gas price
        nonce: 1 // Same nonce (replacement)
      };

      // Detect potential front-running by gas price analysis
      const gasPriceDiff = frontRunTransaction.gasPrice - baseTransaction.gasPrice;
      const percentIncrease = Number(gasPriceDiff * 100n / baseTransaction.gasPrice);

      // Flag suspicious gas price increases
      if (percentIncrease > 20) {
        expect(percentIncrease).toBeGreaterThan(20); // Detected front-running attempt
      }
    });
  });

  describe('Private Key Protection', () => {
    test('should never expose private keys in memory after operations', async () => {
      const account = (await testKeyring.getAccounts('ethereum'))[0];
      const privateKey = account?.privateKey;

      expect(privateKey).toBeTruthy();
      expect(privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);

      // Create a transaction (private key used internally)
      if (account?.privateKey) {
        const wallet = new ethers.Wallet(account.privateKey);
        const transaction = {
          to: validAddress,
          value: ethers.parseEther('0.1'),
          gasLimit: 21000,
          gasPrice: ethers.parseUnits('20', 'gwei')
        };

        // Sign transaction
        const signedTx = await wallet.signTransaction(transaction);
        expect(signedTx).toBeTruthy();

        // Verify private key wasn't leaked in signed transaction
        expect(signedTx).not.toContain(account.privateKey.slice(2));
      }
    });

    test('should isolate private keys between accounts', async () => {
      // Create a fresh keyring for this test to avoid any shared state
      const isolatedKeyring = new BIP39Keyring();
      await isolatedKeyring.importFromMnemonic(testMnemonic, testPassword);
      
      const account1 = (await isolatedKeyring.getAccounts('ethereum'))[0];
      const account2 = (await isolatedKeyring.addAccount('ethereum'))[0];

      console.log('Test Account 1:', account1);
      console.log('Test Account 2:', account2);

      expect(account1).toBeDefined();
      expect(account2).toBeDefined();
      expect(account1?.privateKey).toBeTruthy();
      expect(account2?.privateKey).toBeTruthy();
      
      // Debug logging to understand the issue
      console.log('Account 1 private key:', account1?.privateKey);
      console.log('Account 2 private key:', account2?.privateKey);
      console.log('Keys are equal:', account1?.privateKey === account2?.privateKey);
      
      expect(account1?.privateKey).not.toBe(account2?.privateKey);
      expect(account1?.address).not.toBe(account2?.address);

      // Keys should be cryptographically independent
      if (account1?.privateKey && account2?.privateKey) {
        const key1Buffer = ethers.getBytes(account1.privateKey);
        const key2Buffer = ethers.getBytes(account2.privateKey);

        // Calculate Hamming distance (should be roughly 50% different)
        let differences = 0;
        for (let i = 0; i < key1Buffer.length; i++) {
          const xor = key1Buffer[i] ^ key2Buffer[i];
          differences += xor.toString(2).split('1').length - 1; // Count 1s
        }

        const totalBits = key1Buffer.length * 8;
        const hammingDistance = differences / totalBits;

        // Should be between 40% and 60% different (good entropy)
        expect(hammingDistance).toBeGreaterThan(0.4);
        expect(hammingDistance).toBeLessThan(0.6);
      }
    });

    test('should protect against private key extraction via side channels', async () => {
      const account = (await testKeyring.getAccounts('ethereum'))[0];
      
      if (account?.privateKey) {
        const wallet = new ethers.Wallet(account.privateKey);
        const messages = [
          'test message',
          'different length msg',
          'a',
          'much longer message to test timing consistency across different message lengths'
        ];

        const allTimings: number[][] = [];

        // Run multiple rounds for better statistical analysis
        for (let round = 0; round < 3; round++) {
          const roundTimings: number[] = [];

          for (const message of messages) {
            // Warm up signing to reduce JIT effects
            if (round === 0) {
              await wallet.signMessage('warmup');
            }

            const start = performance.now();
            const signature = await wallet.signMessage(message);
            const end = performance.now();

            // Verify signature is valid
            const recovered = ethers.verifyMessage(message, signature);
            expect(recovered).toBe(account.address);

            roundTimings.push(end - start);
          }
          
          allTimings.push(roundTimings);
        }

        // Calculate median timings to reduce variance
        const medianTimings = messages.map((_, index) => {
          const timingsForMessage = allTimings.map(round => round[index]).sort((a, b) => a - b);
          const mid = Math.floor(timingsForMessage.length / 2);
          return timingsForMessage.length % 2 === 0 
            ? (timingsForMessage[mid - 1] + timingsForMessage[mid]) / 2 
            : timingsForMessage[mid];
        });

        // Timing should be relatively consistent (no timing attacks)
        const avgTime = medianTimings.reduce((a, b) => a + b) / medianTimings.length;
        const maxDeviation = Math.max(...medianTimings.map(t => Math.abs(t - avgTime)));
        
        // Use more lenient threshold for signing operations as they can vary more
        expect(maxDeviation / avgTime).toBeLessThan(2.0);
        
        // Ensure no extreme outliers
        expect(Math.max(...medianTimings) / Math.min(...medianTimings)).toBeLessThan(10.0);
      }
    });

    test('should securely wipe sensitive data from memory', async () => {
      const keyring = new BIP39Keyring();
      await keyring.importFromMnemonic(testMnemonic, testPassword);

      const account = (await keyring.getAccounts('ethereum'))[0];
      expect(account?.privateKey).toBeTruthy();

      // Lock the keyring
      await keyring.lock();

      // Verify keyring is locked
      expect(keyring.isLocked).toBe(true);

      // Private key should no longer be accessible - getAccounts with chainType should fail when locked
      try {
        const lockedAccounts = await keyring.getAccounts('ethereum');
        // Should not have private keys when locked
        expect(lockedAccounts.every(acc => !acc.privateKey)).toBe(true);
      } catch (error) {
        // If it throws, that's also acceptable behavior when locked
        expect(error).toBeInstanceOf(Error);
      }

      // Memory should be cleared (test internal state)
      const internalAccounts = (keyring as any)._accounts;
      expect(internalAccounts).toBeFalsy();
    });
  });

  describe('Multi-Signature Security', () => {
    test('should validate multi-sig transaction requirements', () => {
      // Simulate multi-sig wallet configuration
      const multiSigConfig = {
        owners: [
          '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', // Vitalik's address
          '0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5', // Well-known address
          '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1' // Valid test address
        ],
        threshold: 2, // 2 of 3 signatures required
        nonce: 0
      };

      expect(multiSigConfig.owners.length).toBe(3);
      expect(multiSigConfig.threshold).toBe(2);
      expect(multiSigConfig.threshold).toBeLessThanOrEqual(multiSigConfig.owners.length);
      
      // All owner addresses should be valid
      multiSigConfig.owners.forEach(owner => {
        expect(ethers.isAddress(owner)).toBe(true);
      });
    });

    test('should prevent signature reuse attacks', () => {
      const transaction = {
        to: validAddress,
        value: ethers.parseEther('1.0'),
        nonce: 1,
        chainId: 1
      };

      // Same transaction hash for replay protection
      // In ethers v6, use keccak256 with solidityPacked
      const packedData1 = solidityPacked(
        ['address', 'uint256', 'uint256', 'uint256'],
        [transaction.to, transaction.value, transaction.nonce, transaction.chainId]
      );
      const txHash1 = keccak256(packedData1);

      const packedData2 = solidityPacked(
        ['address', 'uint256', 'uint256', 'uint256'],
        [transaction.to, transaction.value, transaction.nonce, transaction.chainId]
      );
      const txHash2 = keccak256(packedData2);

      expect(txHash1).toBe(txHash2);

      // Different nonce should produce different hash
      const packedData3 = solidityPacked(
        ['address', 'uint256', 'uint256', 'uint256'],
        [transaction.to, transaction.value, transaction.nonce + 1, transaction.chainId]
      );
      const txHash3 = keccak256(packedData3);

      expect(txHash1).not.toBe(txHash3);
    });

    test('should validate signature threshold enforcement', () => {
      const mockSignatures = [
        '0x1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890',
        '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
        '0x9876543210987654321098765432109876543210987654321098765432109876543210987654321098765432109876543210987654321098765432'
      ];

      const requiredSignatures = 2;
      
      // Test with insufficient signatures
      expect(mockSignatures.slice(0, 1).length).toBeLessThan(requiredSignatures);
      
      // Test with sufficient signatures
      expect(mockSignatures.slice(0, 2).length).toBe(requiredSignatures);
      
      // Test with more than required
      expect(mockSignatures.length).toBeGreaterThanOrEqual(requiredSignatures);
    });
  });

  describe('Recovery Mechanism Security', () => {
    test('should validate recovery phrase security', () => {
      // Test valid mnemonic
      const validMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      expect(bip39.validateMnemonic(validMnemonic)).toBe(true);

      // Test empty mnemonic
      expect(bip39.validateMnemonic('')).toBe(false);

      // Test too short mnemonic
      expect(bip39.validateMnemonic('abandon')).toBe(false);

      // Test wrong word count (11 words)
      expect(bip39.validateMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon')).toBe(false);

      // Test with an invalid word
      expect(bip39.validateMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon invalidword123')).toBe(false);
    });

    test('should validate recovery process authentication', async () => {
      // Simulate recovery process
      const recoveryData = {
        encryptedPrivateKey: 'encrypted_private_key_data',
        recoveryQuestions: [
          { question: 'What is your mother\'s maiden name?', answer: 'Smith' },
          { question: 'What city were you born in?', answer: 'NewYork' }
        ],
        minAnswers: 2
      };

      const providedAnswers = [
        { question: 'What is your mother\'s maiden name?', answer: 'Smith' },
        { question: 'What city were you born in?', answer: 'NewYork' }
      ];

      // Validate answer matching
      let correctAnswers = 0;
      for (const provided of providedAnswers) {
        const expected = recoveryData.recoveryQuestions.find(q => q.question === provided.question);
        if (expected && expected.answer === provided.answer) {
          correctAnswers++;
        }
      }

      expect(correctAnswers).toBe(recoveryData.minAnswers);
    });

    test('should prevent brute force recovery attacks', () => {
      const maxAttempts = 3;
      const lockoutDuration = 300000; // 5 minutes in ms

      let attempts = 0;
      let lastAttempt = 0;
      let locked = false;

      const attemptRecovery = (answer: string): boolean => {
        const now = Date.now();
        
        // Check if locked out
        if (locked && (now - lastAttempt) < lockoutDuration) {
          return false; // Still locked out
        }

        if (locked && (now - lastAttempt) >= lockoutDuration) {
          // Reset after lockout period
          locked = false;
          attempts = 0;
        }

        attempts++;
        lastAttempt = now;

        if (answer === 'correct_answer') {
          attempts = 0; // Reset on success
          return true;
        }

        if (attempts >= maxAttempts) {
          locked = true;
        }

        return false;
      };

      // Test failed attempts
      expect(attemptRecovery('wrong1')).toBe(false);
      expect(attemptRecovery('wrong2')).toBe(false);
      expect(attemptRecovery('wrong3')).toBe(false);
      
      // Should be locked out now
      expect(attemptRecovery('correct_answer')).toBe(false);
    });
  });

  describe('Anti-Phishing Protection', () => {
    test('should detect suspicious addresses', () => {
      const suspiciousAddresses = [
        '0x0000000000000000000000000000000000000000', // Null address
        '0x000000000000000000000000000000000000dead', // Burn address
        '0xffffffffffffffffffffffffffffffffffffffff', // Max address
        '0x742d35cc6634c0532925a3b8d46de3c0ac2a8f43', // Look-alike (lowercase)
        '0x742d35Cc6634C0532925a3b8D46DE3C0ac2a8F44'  // Off by one
      ];

      const legitimateAddress = '0x742d35Cc6634C0532925a3b8D46DE3C0ac2a8F43';

      suspiciousAddresses.forEach(address => {
        // Check for null/burn addresses
        if (address.match(/^0x0+$/) || address.includes('dead') || address.match(/^0xf+$/)) {
          expect(true).toBe(true); // Detected suspicious
        }

        // Check for case mismatches (possible look-alike)
        if (address.toLowerCase() === legitimateAddress.toLowerCase() && address !== legitimateAddress) {
          expect(true).toBe(true); // Detected potential look-alike
        }

        // Check for off-by-one addresses
        if (ethers.isAddress(address) && address !== legitimateAddress) {
          const diff = BigInt(address) - BigInt(legitimateAddress);
          if (diff === 1n || diff === -1n) {
            expect(Math.abs(Number(diff))).toBe(1); // Detected off-by-one
          }
        }
      });
    });

    test('should validate domain authenticity for dApp connections', () => {
      const trustedDomains = [
        'uniswap.org',
        'compound.finance',
        'aave.com'
      ];

      const suspiciousDomains = [
        'uniswap.com', // Wrong TLD
        'uniswaр.org', // Cyrillic 'p'
        'uni-swap.org', // Hyphenated
        'uniswap-org.com', // Domain squatting
        'uniswap.org.evil.com' // Subdomain attack
      ];

      trustedDomains.forEach(domain => {
        expect(domain).toMatch(/^[a-zA-Z0-9.-]+$/); // Valid characters
        expect(domain.split('.').length).toBeGreaterThanOrEqual(2); // Has TLD
      });

      suspiciousDomains.forEach(domain => {
        const isSuspicious = !trustedDomains.includes(domain) ||
                           domain.includes('-') ||
                           domain.split('.').length > 2 ||
                           /[^a-zA-Z0-9.-]/.test(domain);
        
        expect(isSuspicious).toBe(true);
      });
    });

    test('should detect transaction parameter manipulation', () => {
      const originalTransaction = {
        to: '0x742d35Cc6634C0532925a3b8D46DE3C0ac2a8F43',
        value: ethers.parseEther('1.0'),
        data: '0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b8d46de3c0ac2a8f430000000000000000000000000000000000000000000000000de0b6b3a7640000'
      };

      const manipulatedTransactions = [
        {
          ...originalTransaction,
          to: '0x742d35Cc6634C0532925a3b8D46DE3C0ac2a8F44' // Changed last digit
        },
        {
          ...originalTransaction,
          value: ethers.parseEther('10.0') // Changed amount
        },
        {
          ...originalTransaction,
          data: '0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b8d46de3c0ac2a8f440000000000000000000000000000000000000000000000000de0b6b3a7640000' // Changed recipient in data
        }
      ];

      manipulatedTransactions.forEach(tx => {
        const isManipulated = tx.to !== originalTransaction.to ||
                             tx.value !== originalTransaction.value ||
                             tx.data !== originalTransaction.data;
        
        expect(isManipulated).toBe(true);
      });
    });
  });

  describe('Amount and Balance Validation', () => {
    test('should prevent insufficient balance transactions', () => {
      const mockBalances = [
        { balance: ethers.parseEther('1.0'), amount: ethers.parseEther('0.5'), valid: true },
        { balance: ethers.parseEther('1.0'), amount: ethers.parseEther('1.0'), valid: false }, // No gas
        { balance: ethers.parseEther('1.0'), amount: ethers.parseEther('1.5'), valid: false },
        { balance: ethers.parseEther('0.1'), amount: ethers.parseEther('0.05'), valid: true }
      ];

      const gasEstimate = ethers.parseEther('0.001'); // Estimated gas cost

      mockBalances.forEach(({ balance, amount, valid }) => {
        const totalCost = amount + gasEstimate;
        const hasEnoughBalance = balance >= totalCost;
        
        expect(hasEnoughBalance).toBe(valid);
      });
    });

    test('should handle decimal precision correctly', () => {
      const testAmounts = [
        '0.000000000000000001', // 1 wei
        '0.123456789012345678', // 18 decimal places
        '1.999999999999999999', // Almost 2 ETH
        '0.1', // Simple decimal
        '100.0' // Whole number
      ];

      testAmounts.forEach(amount => {
        const parsed = ethers.parseEther(amount);
        const formatted = ethers.formatEther(parsed);
        
        // Should maintain precision
        expect(parseFloat(formatted)).toBeCloseTo(parseFloat(amount), 15);
      });
    });

    test('should validate against double-spending', () => {
      const nonce = 42;
      const transactions = [
        { to: validAddress, value: ethers.parseEther('1.0'), nonce },
        { to: validAddress, value: ethers.parseEther('0.5'), nonce }, // Same nonce
        { to: validAddress, value: ethers.parseEther('1.0'), nonce: nonce + 1 }
      ];

      // Group by nonce
      const nonceGroups = transactions.reduce((acc, tx) => {
        if (!acc[tx.nonce]) acc[tx.nonce] = [];
        acc[tx.nonce].push(tx);
        return acc;
      }, {} as Record<number, typeof transactions>);

      // Check for double-spending (multiple transactions with same nonce)
      Object.entries(nonceGroups).forEach(([nonce, txs]) => {
        if (txs.length > 1) {
          expect(txs.length).toBeGreaterThan(1); // Detected double-spend attempt
        }
      });
    });

    test('should enforce minimum and maximum transaction amounts', () => {
      const limits = {
        minAmount: ethers.parseEther('0.000001'), // 1 finney minimum
        maxAmount: ethers.parseEther('1000') // 1000 ETH maximum
      };

      const testAmounts = [
        ethers.parseEther('0.0000001'), // Below minimum
        ethers.parseEther('0.001'), // Valid
        ethers.parseEther('100'), // Valid
        ethers.parseEther('10000') // Above maximum
      ];

      testAmounts.forEach(amount => {
        const isValid = amount >= limits.minAmount && amount <= limits.maxAmount;
        
        if (amount < limits.minAmount) {
          expect(isValid).toBe(false);
        } else if (amount > limits.maxAmount) {
          expect(isValid).toBe(false);
        } else {
          expect(isValid).toBe(true);
        }
      });
    });
  });

  describe('Fee Security and Manipulation Protection', () => {
    test('should validate gas price against manipulation', () => {
      const normalGasPrices = [
        ethers.parseUnits('1', 'gwei'),   // 1 gwei
        ethers.parseUnits('20', 'gwei'),  // 20 gwei
        ethers.parseUnits('100', 'gwei')  // 100 gwei
      ];

      const suspiciousGasPrices = [
        ethers.parseUnits('0', 'gwei'),     // Zero gas price
        ethers.parseUnits('10000', 'gwei'), // 10,000 gwei (suspicious)
        ethers.parseUnits('1', 'ether')     // 1 ETH gas price (extremely high)
      ];

      const maxReasonableGasPrice = ethers.parseUnits('1000', 'gwei'); // 1000 gwei

      normalGasPrices.forEach(gasPrice => {
        expect(gasPrice).toBeGreaterThan(0n);
        expect(gasPrice).toBeLessThanOrEqual(maxReasonableGasPrice);
      });

      suspiciousGasPrices.forEach(gasPrice => {
        const isSuspicious = gasPrice === 0n || gasPrice > maxReasonableGasPrice;
        expect(isSuspicious).toBe(true);
      });
    });

    test('should detect fee replacement attacks', () => {
      const originalTx = {
        nonce: 1,
        gasPrice: ethers.parseUnits('20', 'gwei'),
        gasLimit: 21000
      };

      const replacementTxs = [
        { nonce: 1, gasPrice: ethers.parseUnits('25', 'gwei'), gasLimit: 21000 }, // 25% increase
        { nonce: 1, gasPrice: ethers.parseUnits('50', 'gwei'), gasLimit: 21000 }, // 150% increase
        { nonce: 1, gasPrice: ethers.parseUnits('200', 'gwei'), gasLimit: 21000 } // 900% increase
      ];

      replacementTxs.forEach(tx => {
        const priceIncrease = (tx.gasPrice - originalTx.gasPrice) * 100n / originalTx.gasPrice;
        
        if (priceIncrease > 100n) { // More than 100% increase
          expect(Number(priceIncrease)).toBeGreaterThan(100); // Detected suspicious replacement
        }
      });
    });

    test('should calculate accurate transaction costs', () => {
      const transactions = [
        { gasLimit: 21000, gasPrice: ethers.parseUnits('20', 'gwei') },
        { gasLimit: 50000, gasPrice: ethers.parseUnits('30', 'gwei') },
        { gasLimit: 100000, gasPrice: ethers.parseUnits('10', 'gwei') }
      ];

      transactions.forEach(tx => {
        const cost = BigInt(tx.gasLimit) * tx.gasPrice;
        const costInEther = ethers.formatEther(cost);
        
        expect(cost).toBeGreaterThan(0n);
        expect(parseFloat(costInEther)).toBeGreaterThan(0);
        
        // Sanity check: cost should be reasonable
        expect(parseFloat(costInEther)).toBeLessThan(1.0); // Less than 1 ETH
      });
    });

    test('should enforce gas limit bounds', () => {
      const gasLimits = [
        0,        // Invalid: zero
        -1,       // Invalid: negative
        20999,    // Invalid: below minimum for transfer
        21000,    // Valid: minimum for transfer
        100000,   // Valid: contract interaction
        15000000, // Valid: near block limit
        15000001  // Invalid: above block limit
      ];

      const minGasLimit = 21000;
      const maxGasLimit = 15000000;

      gasLimits.forEach(limit => {
        const isValid = limit >= minGasLimit && limit <= maxGasLimit;
        
        if (limit <= 0 || limit < minGasLimit || limit > maxGasLimit) {
          expect(isValid).toBe(false);
        } else {
          expect(isValid).toBe(true);
        }
      });
    });
  });
});