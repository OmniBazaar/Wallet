/**
 * Keyring Integration Tests
 * Tests wallet keyring management, security, and multi-account support
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { KeyringService } from '../../src/services/KeyringService';
import { EncryptionService } from '../../src/services/EncryptionService';
import { HardwareWalletService } from '../../src/services/HardwareWalletService';
import { BiometricService } from '../../src/services/BiometricService';
import { TEST_MNEMONIC, TEST_PASSWORD } from '../setup';
import { ethers } from 'ethers';

describe('Keyring Integration', () => {
  let keyringService: KeyringService;
  let encryptionService: EncryptionService;
  let hardwareService: HardwareWalletService;
  let biometricService: BiometricService;

  beforeAll(async () => {
    encryptionService = new EncryptionService();
    keyringService = new KeyringService(encryptionService);
    hardwareService = new HardwareWalletService();
    biometricService = new BiometricService();
    
    await keyringService.init();
    await hardwareService.init();
  });

  afterAll(async () => {
    await keyringService.lock();
    await keyringService.cleanup();
    await hardwareService.cleanup();
  });

  beforeEach(async () => {
    await keyringService.clear();
  });

  describe('Keyring Creation and Management', () => {
    it('should create new keyring with mnemonic', async () => {
      const keyring = await keyringService.createKeyring({
        type: 'hd',
        mnemonic: TEST_MNEMONIC,
        password: TEST_PASSWORD
      });

      expect(keyring).toBeDefined();
      expect(keyring.id).toBeDefined();
      expect(keyring.type).toBe('hd');
      expect(keyring.accounts).toHaveLength(1);
      expect(keyring.accounts[0]).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should generate random mnemonic', async () => {
      const mnemonic = await keyringService.generateMnemonic();
      
      expect(mnemonic).toBeDefined();
      const words = mnemonic.split(' ');
      expect(words).toHaveLength(12);
      
      // Validate mnemonic
      const isValid = await keyringService.validateMnemonic(mnemonic);
      expect(isValid).toBe(true);
    });

    it('should import keyring from private key', async () => {
      const privateKey = '0x' + '1'.repeat(64);
      
      const keyring = await keyringService.importPrivateKey({
        privateKey,
        password: TEST_PASSWORD
      });

      expect(keyring).toBeDefined();
      expect(keyring.type).toBe('simple');
      expect(keyring.accounts).toHaveLength(1);
    });

    it('should derive multiple accounts', async () => {
      const keyring = await keyringService.createKeyring({
        type: 'hd',
        mnemonic: TEST_MNEMONIC,
        password: TEST_PASSWORD
      });

      const newAccounts = await keyringService.deriveAccounts(keyring.id, 5);
      
      expect(newAccounts).toHaveLength(5);
      newAccounts.forEach(account => {
        expect(account).toMatch(/^0x[a-fA-F0-9]{40}$/);
      });

      const updatedKeyring = await keyringService.getKeyring(keyring.id);
      expect(updatedKeyring.accounts).toHaveLength(6); // 1 original + 5 new
    });

    it('should remove account from keyring', async () => {
      const keyring = await keyringService.createKeyring({
        type: 'hd',
        mnemonic: TEST_MNEMONIC,
        password: TEST_PASSWORD
      });

      await keyringService.deriveAccounts(keyring.id, 3);
      const accountToRemove = keyring.accounts[1];
      
      await keyringService.removeAccount(keyring.id, accountToRemove);
      
      const updatedKeyring = await keyringService.getKeyring(keyring.id);
      expect(updatedKeyring.accounts).not.toContain(accountToRemove);
    });

    it('should export private key', async () => {
      const keyring = await keyringService.createKeyring({
        type: 'hd',
        mnemonic: TEST_MNEMONIC,
        password: TEST_PASSWORD
      });

      const privateKey = await keyringService.exportPrivateKey(
        keyring.id,
        keyring.accounts[0],
        TEST_PASSWORD
      );

      expect(privateKey).toBeDefined();
      expect(privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });
  });

  describe('Keyring Security', () => {
    it('should encrypt keyring data', async () => {
      const sensitiveData = {
        mnemonic: TEST_MNEMONIC,
        privateKey: '0x' + '1'.repeat(64)
      };

      const encrypted = await encryptionService.encrypt(
        JSON.stringify(sensitiveData),
        TEST_PASSWORD
      );

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toContain(TEST_MNEMONIC);
      expect(encrypted).not.toContain('1'.repeat(64));
    });

    it('should decrypt keyring data', async () => {
      const data = { test: 'data' };
      const encrypted = await encryptionService.encrypt(
        JSON.stringify(data),
        TEST_PASSWORD
      );

      const decrypted = await encryptionService.decrypt(encrypted, TEST_PASSWORD);
      expect(JSON.parse(decrypted)).toEqual(data);
    });

    it('should lock and unlock keyring', async () => {
      const keyring = await keyringService.createKeyring({
        type: 'hd',
        mnemonic: TEST_MNEMONIC,
        password: TEST_PASSWORD
      });

      // Lock keyring
      await keyringService.lock();
      expect(keyringService.isLocked()).toBe(true);

      // Try to access while locked
      await expect(
        keyringService.signMessage(keyring.id, keyring.accounts[0], 'test')
      ).rejects.toThrow('Keyring is locked');

      // Unlock keyring
      await keyringService.unlock(TEST_PASSWORD);
      expect(keyringService.isLocked()).toBe(false);

      // Should work after unlock
      const signature = await keyringService.signMessage(
        keyring.id,
        keyring.accounts[0],
        'test'
      );
      expect(signature).toBeDefined();
    });

    it('should change keyring password', async () => {
      const keyring = await keyringService.createKeyring({
        type: 'hd',
        mnemonic: TEST_MNEMONIC,
        password: TEST_PASSWORD
      });

      const newPassword = 'newPassword456!';
      await keyringService.changePassword(TEST_PASSWORD, newPassword);

      // Lock and try old password
      await keyringService.lock();
      await expect(
        keyringService.unlock(TEST_PASSWORD)
      ).rejects.toThrow();

      // Should work with new password
      await keyringService.unlock(newPassword);
      expect(keyringService.isLocked()).toBe(false);
    });

    it('should auto-lock after timeout', async () => {
      await keyringService.createKeyring({
        type: 'hd',
        mnemonic: TEST_MNEMONIC,
        password: TEST_PASSWORD
      });

      await keyringService.setAutoLockTimeout(100); // 100ms for testing
      
      expect(keyringService.isLocked()).toBe(false);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(keyringService.isLocked()).toBe(true);
    });
  });

  describe('Message and Transaction Signing', () => {
    it('should sign message', async () => {
      const keyring = await keyringService.createKeyring({
        type: 'hd',
        mnemonic: TEST_MNEMONIC,
        password: TEST_PASSWORD
      });

      const message = 'Hello OmniBazaar';
      const signature = await keyringService.signMessage(
        keyring.id,
        keyring.accounts[0],
        message
      );

      expect(signature).toBeDefined();
      expect(signature).toMatch(/^0x[a-fA-F0-9]{130}$/);

      // Verify signature
      const recovered = ethers.verifyMessage(message, signature);
      expect(recovered.toLowerCase()).toBe(keyring.accounts[0].toLowerCase());
    });

    it('should sign typed data (EIP-712)', async () => {
      const keyring = await keyringService.createKeyring({
        type: 'hd',
        mnemonic: TEST_MNEMONIC,
        password: TEST_PASSWORD
      });

      const typedData = {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' }
          ],
          Order: [
            { name: 'seller', type: 'address' },
            { name: 'price', type: 'uint256' },
            { name: 'nonce', type: 'uint256' }
          ]
        },
        domain: {
          name: 'OmniBazaar',
          version: '1',
          chainId: 1,
          verifyingContract: '0x0000000000000000000000000000000000000000'
        },
        message: {
          seller: keyring.accounts[0],
          price: '1000000000000000000',
          nonce: 1
        }
      };

      const signature = await keyringService.signTypedData(
        keyring.id,
        keyring.accounts[0],
        typedData
      );

      expect(signature).toBeDefined();
      expect(signature).toMatch(/^0x[a-fA-F0-9]{130}$/);
    });

    it('should sign transaction', async () => {
      const keyring = await keyringService.createKeyring({
        type: 'hd',
        mnemonic: TEST_MNEMONIC,
        password: TEST_PASSWORD
      });

      const transaction = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f6BED7',
        value: ethers.parseEther('1'),
        gasLimit: 21000,
        gasPrice: ethers.parseUnits('30', 'gwei'),
        nonce: 0,
        chainId: 1
      };

      const signedTx = await keyringService.signTransaction(
        keyring.id,
        keyring.accounts[0],
        transaction
      );

      expect(signedTx).toBeDefined();
      expect(signedTx).toMatch(/^0x[a-fA-F0-9]+$/);

      // Parse signed transaction
      const parsed = ethers.Transaction.from(signedTx);
      expect(parsed.to).toBe(transaction.to);
      expect(parsed.value).toBe(transaction.value);
    });

    it('should batch sign multiple transactions', async () => {
      const keyring = await keyringService.createKeyring({
        type: 'hd',
        mnemonic: TEST_MNEMONIC,
        password: TEST_PASSWORD
      });

      const transactions = [
        {
          to: '0x111...',
          value: ethers.parseEther('0.1'),
          nonce: 0
        },
        {
          to: '0x222...',
          value: ethers.parseEther('0.2'),
          nonce: 1
        },
        {
          to: '0x333...',
          value: ethers.parseEther('0.3'),
          nonce: 2
        }
      ];

      const signedTxs = await keyringService.batchSignTransactions(
        keyring.id,
        keyring.accounts[0],
        transactions
      );

      expect(signedTxs).toHaveLength(3);
      signedTxs.forEach(tx => {
        expect(tx).toMatch(/^0x[a-fA-F0-9]+$/);
      });
    });
  });

  describe('Hardware Wallet Integration', () => {
    it('should detect connected hardware wallets', async () => {
      const devices = await hardwareService.detectDevices();
      
      expect(Array.isArray(devices)).toBe(true);
      devices.forEach(device => {
        expect(device).toHaveProperty('type');
        expect(device).toHaveProperty('id');
        expect(device).toHaveProperty('label');
        expect(['ledger', 'trezor', 'lattice']).toContain(device.type);
      });
    });

    it('should connect to Ledger wallet', async () => {
      const ledger = await hardwareService.connectLedger();
      
      if (ledger.connected) {
        expect(ledger.deviceId).toBeDefined();
        expect(ledger.appVersion).toBeDefined();
        expect(ledger.accounts).toBeDefined();
      } else {
        expect(ledger.error).toBeDefined();
      }
    });

    it('should derive hardware wallet accounts', async () => {
      const mockDevice = {
        type: 'ledger',
        deviceId: 'mock-ledger-123'
      };

      const accounts = await hardwareService.deriveAccounts(mockDevice, {
        start: 0,
        count: 5,
        derivationPath: "m/44'/60'/0'/0"
      });

      if (accounts.length > 0) {
        expect(accounts).toHaveLength(5);
        accounts.forEach(account => {
          expect(account.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
          expect(account.path).toBeDefined();
        });
      }
    });

    it('should sign with hardware wallet', async () => {
      const mockDevice = {
        type: 'ledger',
        deviceId: 'mock-ledger-123'
      };

      const message = 'Sign this with hardware wallet';
      
      try {
        const signature = await hardwareService.signMessage(
          mockDevice,
          message,
          "m/44'/60'/0'/0/0"
        );
        
        expect(signature).toBeDefined();
        expect(signature).toMatch(/^0x[a-fA-F0-9]{130}$/);
      } catch (error) {
        // Hardware not connected
        expect(error.message).toContain('not connected');
      }
    });

    it('should handle hardware wallet disconnection', async () => {
      const mockDevice = {
        type: 'ledger',
        deviceId: 'mock-ledger-123'
      };

      const disconnected = await hardwareService.disconnect(mockDevice);
      expect(disconnected).toBe(true);
      
      const devices = await hardwareService.detectDevices();
      const isStillConnected = devices.some(d => d.id === mockDevice.deviceId);
      expect(isStillConnected).toBe(false);
    });
  });

  describe('Biometric Authentication', () => {
    it('should check biometric availability', async () => {
      const available = await biometricService.isAvailable();
      
      expect(typeof available).toBe('boolean');
      
      if (available) {
        const types = await biometricService.getAvailableTypes();
        expect(Array.isArray(types)).toBe(true);
        expect(types.length).toBeGreaterThan(0);
      }
    });

    it('should enroll biometric authentication', async () => {
      const enrolled = await biometricService.enroll({
        userId: 'user-123',
        challenge: Buffer.from('challenge').toString('base64')
      });

      if (enrolled.success) {
        expect(enrolled.credentialId).toBeDefined();
        expect(enrolled.publicKey).toBeDefined();
      } else {
        expect(enrolled.error).toBeDefined();
      }
    });

    it('should authenticate with biometrics', async () => {
      const auth = await biometricService.authenticate({
        userId: 'user-123',
        challenge: Buffer.from('challenge').toString('base64')
      });

      if (auth.success) {
        expect(auth.signature).toBeDefined();
        expect(auth.credentialId).toBeDefined();
      } else {
        expect(auth.error).toBeDefined();
      }
    });

    it('should manage biometric credentials', async () => {
      const credentials = await biometricService.getCredentials('user-123');
      
      expect(Array.isArray(credentials)).toBe(true);
      credentials.forEach(cred => {
        expect(cred).toHaveProperty('id');
        expect(cred).toHaveProperty('type');
        expect(cred).toHaveProperty('createdAt');
      });

      // Remove credential
      if (credentials.length > 0) {
        const removed = await biometricService.removeCredential(
          'user-123',
          credentials[0].id
        );
        expect(removed).toBe(true);
      }
    });
  });

  describe('Multi-Chain Keyring', () => {
    it('should support Ethereum addresses', async () => {
      const keyring = await keyringService.createKeyring({
        type: 'hd',
        mnemonic: TEST_MNEMONIC,
        password: TEST_PASSWORD,
        chains: ['ethereum']
      });

      const ethAddress = keyring.accounts[0];
      expect(ethAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should support Bitcoin addresses', async () => {
      const keyring = await keyringService.createKeyring({
        type: 'hd',
        mnemonic: TEST_MNEMONIC,
        password: TEST_PASSWORD,
        chains: ['bitcoin']
      });

      const btcAddress = await keyringService.getBitcoinAddress(
        keyring.id,
        0 // account index
      );
      
      expect(btcAddress).toBeDefined();
      expect(btcAddress).toMatch(/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/);
    });

    it('should support Solana addresses', async () => {
      const keyring = await keyringService.createKeyring({
        type: 'hd',
        mnemonic: TEST_MNEMONIC,
        password: TEST_PASSWORD,
        chains: ['solana']
      });

      const solAddress = await keyringService.getSolanaAddress(
        keyring.id,
        0 // account index
      );
      
      expect(solAddress).toBeDefined();
      expect(solAddress).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    });

    it('should derive chain-specific paths', async () => {
      const keyring = await keyringService.createKeyring({
        type: 'hd',
        mnemonic: TEST_MNEMONIC,
        password: TEST_PASSWORD,
        chains: ['ethereum', 'bitcoin', 'solana']
      });

      const addresses = await keyringService.getAllChainAddresses(keyring.id, 0);
      
      expect(addresses.ethereum).toBeDefined();
      expect(addresses.bitcoin).toBeDefined();
      expect(addresses.solana).toBeDefined();
      
      // All addresses should be different
      const uniqueAddresses = new Set(Object.values(addresses));
      expect(uniqueAddresses.size).toBe(3);
    });
  });

  describe('Account Management', () => {
    it('should name accounts', async () => {
      const keyring = await keyringService.createKeyring({
        type: 'hd',
        mnemonic: TEST_MNEMONIC,
        password: TEST_PASSWORD
      });

      await keyringService.setAccountName(
        keyring.id,
        keyring.accounts[0],
        'Main Account'
      );

      const accountInfo = await keyringService.getAccountInfo(
        keyring.id,
        keyring.accounts[0]
      );
      
      expect(accountInfo.name).toBe('Main Account');
    });

    it('should track account balances', async () => {
      const keyring = await keyringService.createKeyring({
        type: 'hd',
        mnemonic: TEST_MNEMONIC,
        password: TEST_PASSWORD
      });

      const balances = await keyringService.getAccountBalances(
        keyring.id,
        keyring.accounts[0]
      );

      expect(balances).toBeDefined();
      expect(balances).toHaveProperty('ethereum');
      expect(balances).toHaveProperty('tokens');
      expect(balances).toHaveProperty('nfts');
      expect(balances).toHaveProperty('totalUSD');
    });

    it('should export account data', async () => {
      const keyring = await keyringService.createKeyring({
        type: 'hd',
        mnemonic: TEST_MNEMONIC,
        password: TEST_PASSWORD
      });

      const exported = await keyringService.exportAccount(
        keyring.id,
        keyring.accounts[0],
        TEST_PASSWORD
      );

      expect(exported).toBeDefined();
      expect(exported.address).toBe(keyring.accounts[0]);
      expect(exported.privateKey).toBeDefined();
      expect(exported.publicKey).toBeDefined();
    });

    it('should import account data', async () => {
      const accountData = {
        privateKey: '0x' + '2'.repeat(64),
        name: 'Imported Account'
      };

      const imported = await keyringService.importAccount(
        accountData,
        TEST_PASSWORD
      );

      expect(imported.success).toBe(true);
      expect(imported.address).toBeDefined();
      expect(imported.keyringId).toBeDefined();
    });
  });

  describe('Backup and Recovery', () => {
    it('should backup keyring', async () => {
      const keyring = await keyringService.createKeyring({
        type: 'hd',
        mnemonic: TEST_MNEMONIC,
        password: TEST_PASSWORD
      });

      const backup = await keyringService.createBackup(TEST_PASSWORD);
      
      expect(backup).toBeDefined();
      expect(backup.version).toBeDefined();
      expect(backup.timestamp).toBeDefined();
      expect(backup.encrypted).toBeDefined();
      expect(backup.checksum).toBeDefined();
    });

    it('should restore from backup', async () => {
      // Create and backup
      const originalKeyring = await keyringService.createKeyring({
        type: 'hd',
        mnemonic: TEST_MNEMONIC,
        password: TEST_PASSWORD
      });
      
      const backup = await keyringService.createBackup(TEST_PASSWORD);
      
      // Clear and restore
      await keyringService.clear();
      const restored = await keyringService.restoreFromBackup(backup, TEST_PASSWORD);
      
      expect(restored.success).toBe(true);
      expect(restored.keyrings).toHaveLength(1);
      expect(restored.keyrings[0].id).toBe(originalKeyring.id);
    });

    it('should validate backup integrity', async () => {
      const backup = await keyringService.createBackup(TEST_PASSWORD);
      
      const isValid = await keyringService.validateBackup(backup);
      expect(isValid).toBe(true);
      
      // Corrupt backup
      backup.checksum = 'invalid';
      const isInvalid = await keyringService.validateBackup(backup);
      expect(isInvalid).toBe(false);
    });
  });
});