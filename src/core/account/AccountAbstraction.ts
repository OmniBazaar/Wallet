import { Wallet } from '../wallet/Wallet';

/** User account credentials for authentication */
export interface AccountCredentials {
  /** User's chosen username */
  username: string;
  /** User's password */
  password: string;
  /** User's email address (optional) */
  email?: string;
}

/** Account metadata and profile information */
export interface AccountMetadata {
  /** Account username */
  username: string;
  /** Account email (optional) */
  email?: string;
  /** Account creation timestamp */
  createdAt: Date;
  /** Last login timestamp */
  lastLogin: Date;
  /** User reputation score (optional) */
  reputation?: number;
  /** User participation score (optional) */
  participationScore?: number;
}

/** Account abstraction interface for unified account management */
export interface AccountAbstraction {
  // Account Creation and Management
  /**
   * Create a new account with given credentials
   * @param credentials User credentials for new account
   * @returns Promise resolving to new wallet instance
   */
  createAccount(credentials: AccountCredentials): Promise<Wallet>;
  /**
   * Login with existing account credentials
   * @param credentials User credentials for login
   * @returns Promise resolving to wallet instance
   */
  login(credentials: AccountCredentials): Promise<Wallet>;
  /**
   * Logout current user session
   * @returns Promise that resolves when logout is complete
   */
  logout(): Promise<void>;

  // Account Information
  /**
   * Get account metadata for current user
   * @returns Promise resolving to account metadata
   */
  getAccountMetadata(): Promise<AccountMetadata>;
  /**
   * Get wallet instance for current user
   * @returns Promise resolving to wallet instance
   */
  getWallet(): Promise<Wallet>;

  // Security
  /**
   * Change account password
   * @param oldPassword Current password
   * @param newPassword New password
   * @returns Promise that resolves when password is changed
   */
  changePassword(oldPassword: string, newPassword: string): Promise<void>;
  /**
   * Reset password via email
   * @param email Email address for password reset
   * @returns Promise that resolves when reset email is sent
   */
  resetPassword(email: string): Promise<void>;

  // Reputation and Participation
  /**
   * Get user's reputation score
   * @returns Promise resolving to reputation score
   */
  getReputationScore(): Promise<number>;
  /**
   * Get user's participation score
   * @returns Promise resolving to participation score
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
