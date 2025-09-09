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
   * Enable privacy features for account
   * @returns Promise that resolves when privacy features are enabled
   */
  enablePrivacyFeatures(): Promise<void>;
  /**
   * Disable privacy features for account
   * @returns Promise that resolves when privacy features are disabled
   */
  disablePrivacyFeatures(): Promise<void>;

  // Event Handlers
  /**
   * Register callback for account changes
   * @param callback Function to call when account changes
   */
  onAccountChange(callback: (account: AccountMetadata) => void): void;
  /**
   * Register callback for login events
   * @param callback Function to call when user logs in
   */
  onLogin(callback: (account: AccountMetadata) => void): void;
  /**
   * Register callback for logout events
   * @param callback Function to call when user logs out
   */
  onLogout(callback: () => void): void;
}

/**
 * Error class for account abstraction related errors
 */
export class AccountAbstractionError extends Error {
  /**
   * Creates a new AccountAbstractionError
   * @param message - The error message
   * @param code - The error code for categorization
   */
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AccountAbstractionError';
  }
}
