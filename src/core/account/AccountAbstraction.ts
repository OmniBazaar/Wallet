import { Wallet } from '../wallet/Wallet';

/**
 *
 */
export interface AccountCredentials {
  /**
   *
   */
  username: string;
  /**
   *
   */
  password: string;
  /**
   *
   */
  email?: string;
}

/**
 *
 */
export interface AccountMetadata {
  /**
   *
   */
  username: string;
  /**
   *
   */
  email?: string;
  /**
   *
   */
  createdAt: Date;
  /**
   *
   */
  lastLogin: Date;
  /**
   *
   */
  reputation?: number;
  /**
   *
   */
  participationScore?: number;
}

/**
 *
 */
export interface AccountAbstraction {
  // Account Creation and Management
  /**
   *
   */
  createAccount(credentials: AccountCredentials): Promise<Wallet>;
  /**
   *
   */
  login(credentials: AccountCredentials): Promise<Wallet>;
  /**
   *
   */
  logout(): Promise<void>;
  
  // Account Information
  /**
   *
   */
  getAccountMetadata(): Promise<AccountMetadata>;
  /**
   *
   */
  getWallet(): Promise<Wallet>;
  
  // Security
  /**
   *
   */
  changePassword(oldPassword: string, newPassword: string): Promise<void>;
  /**
   *
   */
  resetPassword(email: string): Promise<void>;
  
  // Reputation and Participation
  /**
   *
   */
  getReputationScore(): Promise<number>;
  /**
   *
   */
  getParticipationScore(): Promise<number>;
  
  // Privacy Features
  /**
   *
   */
  enablePrivacyFeatures(): Promise<void>;
  /**
   *
   */
  disablePrivacyFeatures(): Promise<void>;
  
  // Event Handlers
  /**
   *
   */
  onAccountChange(callback: (account: AccountMetadata) => void): void;
  /**
   *
   */
  onLogin(callback: (account: AccountMetadata) => void): void;
  /**
   *
   */
  onLogout(callback: () => void): void;
}

/**
 *
 */
export class AccountAbstractionError extends Error {
  /**
   *
   * @param message
   * @param code
   */
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AccountAbstractionError';
  }
} 