/**
 * Mock ReputationService for testing
 * @module __mocks__/ReputationService
 */

/**
 * User reputation levels in the system
 */
export type ReputationLevel = 'bronze' | 'silver' | 'gold' | 'platinum';

/**
 * Action types that affect reputation
 */
export type ReputationAction = 'success' | 'failure' | 'dispute';

/**
 * Represents a single reputation history entry
 */
export interface ReputationHistoryEntry {
  /** ISO 8601 date string */
  date: string;
  /** Reputation score at this point in time */
  score: number;
  /** Event type that caused the score change */
  event: string;
}

/**
 * Complete reputation score data for a user
 */
export interface ReputationScore {
  /** User's blockchain address */
  address: string;
  /** Numerical reputation score (0-1000) */
  score: number;
  /** Reputation tier based on score */
  level: ReputationLevel;
  /** Total number of transactions completed */
  totalTransactions: number;
  /** Number of successful transactions */
  successfulTransactions: number;
  /** Number of disputes opened */
  disputes: number;
  /** Unix timestamp of last update */
  lastUpdated: number;
}

/**
 * Mock implementation of ReputationService for testing purposes
 * Provides deterministic reputation data for consistent testing
 */
export class ReputationService {
  /** Service initialization state */
  private isInitialized = false;

  /**
   * Creates a new instance of the mock ReputationService
   */
  constructor() {}

  /**
   * Initializes the reputation service
   * @returns Promise that resolves when initialization is complete
   */
  init(): Promise<void> {
    this.isInitialized = true;
    return Promise.resolve();
  }

  /**
   * Cleans up resources used by the reputation service
   * @returns Promise that resolves when cleanup is complete
   */
  cleanup(): Promise<void> {
    this.isInitialized = false;
    return Promise.resolve();
  }

  /**
   * Retrieves the reputation score for a given address
   * @param address - The blockchain address to get reputation for
   * @returns Promise that resolves to the numerical reputation score
   * @throws {Error} If service is not initialized
   */
  getReputationScore(address: string): Promise<number> {
    if (!this.isInitialized) {
      return Promise.reject(new Error('ReputationService not initialized'));
    }

    // Generate deterministic score based on address for consistency
    const hash = this.hashAddress(address);
    const score = Math.floor((hash % 90) + 10); // Score between 10-99

    return Promise.resolve(score);
  }

  /**
   * Generates a deterministic hash from an address string
   * @param address - The blockchain address to hash
   * @returns A positive integer hash value
   * @private
   */
  private hashAddress(address: string): number {
    let hash = 0;
    const str = address.toLowerCase();

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash);
  }

  /**
   * Updates a user's reputation based on an action
   * @param address - The user's blockchain address
   * @param action - The action that affects reputation
   * @returns Promise that resolves to the updated reputation score
   * @throws {Error} If service is not initialized
   */
  updateReputation(address: string, action: ReputationAction): Promise<ReputationScore> {
    if (!this.isInitialized) {
      return Promise.reject(new Error('ReputationService not initialized'));
    }

    const currentScore = 850;
    const newScore = action === 'success' ? currentScore + 5 :
                     action === 'failure' ? currentScore - 10 :
                     currentScore - 20;

    const reputationScore: ReputationScore = {
      address,
      score: newScore,
      level: newScore >= 900 ? 'platinum' : newScore >= 800 ? 'gold' : newScore >= 600 ? 'silver' : 'bronze',
      totalTransactions: 101,
      successfulTransactions: action === 'success' ? 99 : 98,
      disputes: action === 'dispute' ? 3 : 2,
      lastUpdated: Date.now()
    };

    return Promise.resolve(reputationScore);
  }

  /**
   * Retrieves reputation history for a user over a specified period
   * @param _address - The user's blockchain address (unused in mock)
   * @param days - Number of days of history to retrieve
   * @returns Promise that resolves to an array of history entries
   * @throws {Error} If service is not initialized
   */
  getReputationHistory(_address: string, days: number): Promise<ReputationHistoryEntry[]> {
    if (!this.isInitialized) {
      return Promise.reject(new Error('ReputationService not initialized'));
    }

    const history: ReputationHistoryEntry[] = [];
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    for (let i = 0; i < days; i++) {
      history.push({
        date: new Date(now - (i * dayMs)).toISOString(),
        score: 850 - (i * 5),
        event: i % 3 === 0 ? 'transaction_success' : 'no_activity'
      });
    }

    return Promise.resolve(history);
  }

  /**
   * Retrieves the top users by reputation score
   * @param limit - Maximum number of users to return
   * @returns Promise that resolves to an array of top user reputation scores
   * @throws {Error} If service is not initialized
   */
  getTopUsers(limit: number): Promise<ReputationScore[]> {
    if (!this.isInitialized) {
      return Promise.reject(new Error('ReputationService not initialized'));
    }

    const users: ReputationScore[] = [];
    for (let i = 0; i < limit; i++) {
      const level: ReputationLevel = i < 5 ? 'platinum' : i < 10 ? 'gold' : 'silver';
      users.push({
        address: '0x' + (i + 1).toString(16).padStart(40, '0'),
        score: 1000 - (i * 10),
        level,
        totalTransactions: 1000 - (i * 50),
        successfulTransactions: 1000 - (i * 50) - i,
        disputes: i,
        lastUpdated: Date.now()
      });
    }

    return Promise.resolve(users);
  }

  /**
   * Clears the reputation cache (no-op in mock)
   * @returns Promise that resolves when cache is cleared
   */
  clearCache(): Promise<void> {
    // Mock cache clearing - no actual operation needed
    return Promise.resolve();
  }
}