/**
 * AccountAbstraction Test Suite
 * 
 * Tests the account abstraction interface contract for unified account management,
 * including account creation, authentication, security features, and event handling.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { 
  AccountAbstraction, 
  AccountCredentials, 
  AccountMetadata 
} from '../../../src/core/account/AccountAbstraction';
import { AccountAbstractionError } from '../../../src/core/account/AccountAbstraction';
import type { Wallet } from '../../../src/core/wallet/Wallet';

// Mock implementation for testing
class MockAccountAbstraction implements AccountAbstraction {
  private currentAccount: AccountMetadata | null = null;
  private wallet: Wallet | null = null;
  private privacyEnabled = false;
  private accountChangeListeners: Array<(account: AccountMetadata) => void> = [];
  private loginListeners: Array<(account: AccountMetadata) => void> = [];
  private logoutListeners: Array<() => void> = [];
  
  // Mock database
  private accounts = new Map<string, { 
    credentials: AccountCredentials; 
    metadata: AccountMetadata;
    wallet: Wallet;
  }>();

  async createAccount(credentials: AccountCredentials): Promise<Wallet> {
    if (!credentials.username || !credentials.password) {
      throw new AccountAbstractionError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    if (this.accounts.has(credentials.username)) {
      throw new AccountAbstractionError('Account already exists', 'ACCOUNT_EXISTS');
    }

    const mockWallet: Wallet = {
      address: '0x' + credentials.username.padEnd(40, '0'),
      privateKey: '0x' + credentials.password.padEnd(64, '0'),
      publicKey: '0x04' + credentials.username.padEnd(128, '0')
    } as any;

    const metadata: AccountMetadata = {
      username: credentials.username,
      email: credentials.email,
      createdAt: new Date(),
      lastLogin: new Date(),
      reputation: 0,
      participationScore: 0
    };

    this.accounts.set(credentials.username, {
      credentials,
      metadata,
      wallet: mockWallet
    });

    this.currentAccount = metadata;
    this.wallet = mockWallet;

    return mockWallet;
  }

  async login(credentials: AccountCredentials): Promise<Wallet> {
    const account = this.accounts.get(credentials.username);
    
    if (!account) {
      throw new AccountAbstractionError('Account not found', 'ACCOUNT_NOT_FOUND');
    }

    if (account.credentials.password !== credentials.password) {
      throw new AccountAbstractionError('Invalid password', 'INVALID_PASSWORD');
    }

    this.currentAccount = {
      ...account.metadata,
      lastLogin: new Date()
    };
    this.wallet = account.wallet;

    // Notify listeners
    this.loginListeners.forEach(cb => cb(this.currentAccount!));

    return account.wallet;
  }

  async logout(): Promise<void> {
    if (!this.currentAccount) {
      throw new AccountAbstractionError('Not logged in', 'NOT_LOGGED_IN');
    }

    this.currentAccount = null;
    this.wallet = null;

    // Notify listeners
    this.logoutListeners.forEach(cb => cb());
  }

  async getAccountMetadata(): Promise<AccountMetadata> {
    if (!this.currentAccount) {
      throw new AccountAbstractionError('Not logged in', 'NOT_LOGGED_IN');
    }

    return { ...this.currentAccount };
  }

  async getWallet(): Promise<Wallet> {
    if (!this.wallet) {
      throw new AccountAbstractionError('Not logged in', 'NOT_LOGGED_IN');
    }

    return this.wallet;
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    if (!this.currentAccount) {
      throw new AccountAbstractionError('Not logged in', 'NOT_LOGGED_IN');
    }

    const account = this.accounts.get(this.currentAccount.username);
    if (!account) {
      throw new AccountAbstractionError('Account not found', 'ACCOUNT_NOT_FOUND');
    }

    if (account.credentials.password !== oldPassword) {
      throw new AccountAbstractionError('Invalid old password', 'INVALID_PASSWORD');
    }

    account.credentials.password = newPassword;
  }

  async resetPassword(email: string): Promise<void> {
    const account = Array.from(this.accounts.values())
      .find(acc => acc.credentials.email === email);

    if (!account) {
      throw new AccountAbstractionError('Email not found', 'EMAIL_NOT_FOUND');
    }

    // In a real implementation, this would send an email
    // For testing, we just verify the email exists
  }

  async getReputationScore(): Promise<number> {
    if (!this.currentAccount) {
      throw new AccountAbstractionError('Not logged in', 'NOT_LOGGED_IN');
    }

    return this.currentAccount.reputation || 0;
  }

  async getParticipationScore(): Promise<number> {
    if (!this.currentAccount) {
      throw new AccountAbstractionError('Not logged in', 'NOT_LOGGED_IN');
    }

    return this.currentAccount.participationScore || 0;
  }

  async enablePrivacyFeatures(): Promise<void> {
    if (!this.currentAccount) {
      throw new AccountAbstractionError('Not logged in', 'NOT_LOGGED_IN');
    }

    this.privacyEnabled = true;
  }

  async disablePrivacyFeatures(): Promise<void> {
    if (!this.currentAccount) {
      throw new AccountAbstractionError('Not logged in', 'NOT_LOGGED_IN');
    }

    this.privacyEnabled = false;
  }

  onAccountChange(callback: (account: AccountMetadata) => void): void {
    this.accountChangeListeners.push(callback);
  }

  onLogin(callback: (account: AccountMetadata) => void): void {
    this.loginListeners.push(callback);
  }

  onLogout(callback: () => void): void {
    this.logoutListeners.push(callback);
  }

  // Test helpers
  isPrivacyEnabled(): boolean {
    return this.privacyEnabled;
  }

  triggerAccountChange(): void {
    if (this.currentAccount) {
      this.accountChangeListeners.forEach(cb => cb(this.currentAccount!));
    }
  }
}

describe('AccountAbstraction', () => {
  let accountAbstraction: MockAccountAbstraction;

  const TEST_CREDENTIALS: AccountCredentials = {
    username: 'testuser',
    password: 'Test123!@#',
    email: 'test@example.com'
  };

  beforeEach(() => {
    accountAbstraction = new MockAccountAbstraction();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Account Creation', () => {
    it('should create a new account successfully', async () => {
      const wallet = await accountAbstraction.createAccount(TEST_CREDENTIALS);

      expect(wallet).toBeDefined();
      expect(wallet.address).toContain(TEST_CREDENTIALS.username);

      const metadata = await accountAbstraction.getAccountMetadata();
      expect(metadata.username).toBe(TEST_CREDENTIALS.username);
      expect(metadata.email).toBe(TEST_CREDENTIALS.email);
      expect(metadata.createdAt).toBeInstanceOf(Date);
      expect(metadata.reputation).toBe(0);
      expect(metadata.participationScore).toBe(0);
    });

    it('should reject creation with missing username', async () => {
      await expect(accountAbstraction.createAccount({
        username: '',
        password: 'password123'
      })).rejects.toThrow(AccountAbstractionError);
    });

    it('should reject creation with missing password', async () => {
      await expect(accountAbstraction.createAccount({
        username: 'testuser',
        password: ''
      })).rejects.toThrow(AccountAbstractionError);
    });

    it('should reject duplicate account creation', async () => {
      await accountAbstraction.createAccount(TEST_CREDENTIALS);

      await expect(accountAbstraction.createAccount(TEST_CREDENTIALS))
        .rejects.toThrow(new AccountAbstractionError('Account already exists', 'ACCOUNT_EXISTS'));
    });

    it('should create account without email', async () => {
      const wallet = await accountAbstraction.createAccount({
        username: 'noEmail',
        password: 'password123'
      });

      expect(wallet).toBeDefined();
      
      const metadata = await accountAbstraction.getAccountMetadata();
      expect(metadata.email).toBeUndefined();
    });
  });

  describe('Authentication', () => {
    beforeEach(async () => {
      await accountAbstraction.createAccount(TEST_CREDENTIALS);
      await accountAbstraction.logout();
    });

    it('should login with correct credentials', async () => {
      const wallet = await accountAbstraction.login({
        username: TEST_CREDENTIALS.username,
        password: TEST_CREDENTIALS.password
      });

      expect(wallet).toBeDefined();
      
      const metadata = await accountAbstraction.getAccountMetadata();
      expect(metadata.username).toBe(TEST_CREDENTIALS.username);
      expect(metadata.lastLogin).toBeInstanceOf(Date);
    });

    it('should reject login with wrong password', async () => {
      await expect(accountAbstraction.login({
        username: TEST_CREDENTIALS.username,
        password: 'wrongpassword'
      })).rejects.toThrow(new AccountAbstractionError('Invalid password', 'INVALID_PASSWORD'));
    });

    it('should reject login for non-existent account', async () => {
      await expect(accountAbstraction.login({
        username: 'nonexistent',
        password: 'password'
      })).rejects.toThrow(new AccountAbstractionError('Account not found', 'ACCOUNT_NOT_FOUND'));
    });

    it('should logout successfully', async () => {
      await accountAbstraction.login(TEST_CREDENTIALS);
      await accountAbstraction.logout();

      await expect(accountAbstraction.getAccountMetadata())
        .rejects.toThrow(new AccountAbstractionError('Not logged in', 'NOT_LOGGED_IN'));
    });

    it('should reject logout when not logged in', async () => {
      await expect(accountAbstraction.logout())
        .rejects.toThrow(new AccountAbstractionError('Not logged in', 'NOT_LOGGED_IN'));
    });
  });

  describe('Account Information', () => {
    beforeEach(async () => {
      await accountAbstraction.createAccount(TEST_CREDENTIALS);
    });

    it('should get account metadata when logged in', async () => {
      const metadata = await accountAbstraction.getAccountMetadata();

      expect(metadata).toMatchObject({
        username: TEST_CREDENTIALS.username,
        email: TEST_CREDENTIALS.email,
        createdAt: expect.any(Date),
        lastLogin: expect.any(Date),
        reputation: 0,
        participationScore: 0
      });
    });

    it('should get wallet when logged in', async () => {
      const wallet = await accountAbstraction.getWallet();

      expect(wallet).toBeDefined();
      expect(wallet.address).toBeDefined();
    });

    it('should reject getting metadata when not logged in', async () => {
      await accountAbstraction.logout();

      await expect(accountAbstraction.getAccountMetadata())
        .rejects.toThrow(AccountAbstractionError);
    });

    it('should reject getting wallet when not logged in', async () => {
      await accountAbstraction.logout();

      await expect(accountAbstraction.getWallet())
        .rejects.toThrow(AccountAbstractionError);
    });
  });

  describe('Password Management', () => {
    beforeEach(async () => {
      await accountAbstraction.createAccount(TEST_CREDENTIALS);
    });

    it('should change password successfully', async () => {
      const newPassword = 'NewPassword123!';
      
      await accountAbstraction.changePassword(TEST_CREDENTIALS.password, newPassword);
      
      // Logout and login with new password
      await accountAbstraction.logout();
      
      const wallet = await accountAbstraction.login({
        username: TEST_CREDENTIALS.username,
        password: newPassword
      });

      expect(wallet).toBeDefined();
    });

    it('should reject password change with wrong old password', async () => {
      await expect(accountAbstraction.changePassword('wrongpassword', 'newpassword'))
        .rejects.toThrow(new AccountAbstractionError('Invalid old password', 'INVALID_PASSWORD'));
    });

    it('should reject password change when not logged in', async () => {
      await accountAbstraction.logout();

      await expect(accountAbstraction.changePassword('old', 'new'))
        .rejects.toThrow(new AccountAbstractionError('Not logged in', 'NOT_LOGGED_IN'));
    });

    it('should handle password reset request', async () => {
      await accountAbstraction.logout();
      
      await expect(accountAbstraction.resetPassword(TEST_CREDENTIALS.email!))
        .resolves.not.toThrow();
    });

    it('should reject password reset for unknown email', async () => {
      await expect(accountAbstraction.resetPassword('unknown@example.com'))
        .rejects.toThrow(new AccountAbstractionError('Email not found', 'EMAIL_NOT_FOUND'));
    });
  });

  describe('Reputation and Participation', () => {
    beforeEach(async () => {
      await accountAbstraction.createAccount(TEST_CREDENTIALS);
    });

    it('should get reputation score', async () => {
      const score = await accountAbstraction.getReputationScore();
      expect(score).toBe(0);
    });

    it('should get participation score', async () => {
      const score = await accountAbstraction.getParticipationScore();
      expect(score).toBe(0);
    });

    it('should reject score queries when not logged in', async () => {
      await accountAbstraction.logout();

      await expect(accountAbstraction.getReputationScore())
        .rejects.toThrow(AccountAbstractionError);
      
      await expect(accountAbstraction.getParticipationScore())
        .rejects.toThrow(AccountAbstractionError);
    });
  });

  describe('Privacy Features', () => {
    beforeEach(async () => {
      await accountAbstraction.createAccount(TEST_CREDENTIALS);
    });

    it('should enable privacy features', async () => {
      await accountAbstraction.enablePrivacyFeatures();
      expect(accountAbstraction.isPrivacyEnabled()).toBe(true);
    });

    it('should disable privacy features', async () => {
      await accountAbstraction.enablePrivacyFeatures();
      await accountAbstraction.disablePrivacyFeatures();
      expect(accountAbstraction.isPrivacyEnabled()).toBe(false);
    });

    it('should reject privacy operations when not logged in', async () => {
      await accountAbstraction.logout();

      await expect(accountAbstraction.enablePrivacyFeatures())
        .rejects.toThrow(AccountAbstractionError);
      
      await expect(accountAbstraction.disablePrivacyFeatures())
        .rejects.toThrow(AccountAbstractionError);
    });
  });

  describe('Event Handling', () => {
    it('should handle login events', async () => {
      const loginCallback = jest.fn();
      accountAbstraction.onLogin(loginCallback);

      await accountAbstraction.createAccount(TEST_CREDENTIALS);
      expect(loginCallback).not.toHaveBeenCalled();

      await accountAbstraction.logout();
      await accountAbstraction.login(TEST_CREDENTIALS);

      expect(loginCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          username: TEST_CREDENTIALS.username
        })
      );
    });

    it('should handle logout events', async () => {
      const logoutCallback = jest.fn();
      accountAbstraction.onLogout(logoutCallback);

      await accountAbstraction.createAccount(TEST_CREDENTIALS);
      await accountAbstraction.logout();

      expect(logoutCallback).toHaveBeenCalled();
    });

    it('should handle account change events', async () => {
      const changeCallback = jest.fn();
      accountAbstraction.onAccountChange(changeCallback);

      await accountAbstraction.createAccount(TEST_CREDENTIALS);
      accountAbstraction.triggerAccountChange();

      expect(changeCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          username: TEST_CREDENTIALS.username
        })
      );
    });

    it('should support multiple event listeners', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      accountAbstraction.onLogin(callback1);
      accountAbstraction.onLogin(callback2);

      await accountAbstraction.createAccount(TEST_CREDENTIALS);
      await accountAbstraction.logout();
      await accountAbstraction.login(TEST_CREDENTIALS);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should use AccountAbstractionError for all errors', async () => {
      try {
        await accountAbstraction.login({
          username: 'nonexistent',
          password: 'password'
        });
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AccountAbstractionError);
        expect((error as AccountAbstractionError).code).toBe('ACCOUNT_NOT_FOUND');
        expect((error as AccountAbstractionError).name).toBe('AccountAbstractionError');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in username', async () => {
      const specialCredentials: AccountCredentials = {
        username: 'test@user.name',
        password: 'password123',
        email: 'special@example.com'
      };

      const wallet = await accountAbstraction.createAccount(specialCredentials);
      expect(wallet).toBeDefined();

      const metadata = await accountAbstraction.getAccountMetadata();
      expect(metadata.username).toBe(specialCredentials.username);
    });

    it('should handle very long passwords', async () => {
      const longPassword = 'a'.repeat(1000);
      
      const wallet = await accountAbstraction.createAccount({
        username: 'longpass',
        password: longPassword
      });

      expect(wallet).toBeDefined();
    });

    it('should maintain separate sessions', async () => {
      // Create and login first account
      await accountAbstraction.createAccount(TEST_CREDENTIALS);
      const wallet1 = await accountAbstraction.getWallet();

      // Logout and create second account
      await accountAbstraction.logout();
      
      const secondCredentials: AccountCredentials = {
        username: 'seconduser',
        password: 'password456'
      };
      
      await accountAbstraction.createAccount(secondCredentials);
      const wallet2 = await accountAbstraction.getWallet();

      expect(wallet1.address).not.toBe(wallet2.address);
    });
  });
});