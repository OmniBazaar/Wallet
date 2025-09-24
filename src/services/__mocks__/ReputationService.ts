/**
 * Mock ReputationService for testing
 */

import { jest } from '@jest/globals';

export interface ReputationScore {
  address: string;
  score: number;
  level: 'bronze' | 'silver' | 'gold' | 'platinum';
  totalTransactions: number;
  successfulTransactions: number;
  disputes: number;
  lastUpdated: number;
}

export class ReputationService {
  private isInitialized = false;

  constructor() {}

  async init(): Promise<void> {
    this.isInitialized = true;
  }

  async cleanup(): Promise<void> {
    this.isInitialized = false;
  }

  async getReputationScore(address: string): Promise<number> {
    if (!this.isInitialized) {
      throw new Error('ReputationService not initialized');
    }

    // Generate deterministic score based on address for consistency
    const hash = this.hashAddress(address);
    const score = Math.floor((hash % 90) + 10); // Score between 10-99

    return score;
  }

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

  async updateReputation(address: string, action: 'success' | 'failure' | 'dispute'): Promise<ReputationScore> {
    if (!this.isInitialized) {
      throw new Error('ReputationService not initialized');
    }

    const currentScore = 850;
    const newScore = action === 'success' ? currentScore + 5 :
                     action === 'failure' ? currentScore - 10 :
                     currentScore - 20;

    return {
      address,
      score: newScore,
      level: newScore >= 900 ? 'platinum' : newScore >= 800 ? 'gold' : newScore >= 600 ? 'silver' : 'bronze',
      totalTransactions: 101,
      successfulTransactions: action === 'success' ? 99 : 98,
      disputes: action === 'dispute' ? 3 : 2,
      lastUpdated: Date.now()
    };
  }

  async getReputationHistory(address: string, days: number): Promise<Array<{ date: string; score: number; event: string }>> {
    if (!this.isInitialized) {
      throw new Error('ReputationService not initialized');
    }

    const history = [];
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    for (let i = 0; i < days; i++) {
      history.push({
        date: new Date(now - (i * dayMs)).toISOString(),
        score: 850 - (i * 5),
        event: i % 3 === 0 ? 'transaction_success' : 'no_activity'
      });
    }

    return history;
  }

  async getTopUsers(limit: number): Promise<ReputationScore[]> {
    if (!this.isInitialized) {
      throw new Error('ReputationService not initialized');
    }

    const users = [];
    for (let i = 0; i < limit; i++) {
      users.push({
        address: '0x' + (i + 1).toString(16).padStart(40, '0'),
        score: 1000 - (i * 10),
        level: i < 5 ? 'platinum' : i < 10 ? 'gold' : 'silver',
        totalTransactions: 1000 - (i * 50),
        successfulTransactions: 1000 - (i * 50) - i,
        disputes: i,
        lastUpdated: Date.now()
      } as ReputationScore);
    }

    return users;
  }

  async clearCache(): Promise<void> {
    // Mock cache clearing
  }
}