/**
 * MasterMerkleService - Integration service for MasterMerkleEngine
 *
 * This service provides the interface between the Wallet module and the
 * real MasterMerkleEngine implementation from the Validator module.
 */

import { MasterMerkleEngine } from '../../../../Validator/dist/engines/MasterMerkleEngine';
import type {
  MasterMerkleData,
  MerkleProof,
  UserBalance,
  UserStake,
  UserReputation
} from '../../../../Validator/dist/engines/MasterMerkleEngine';

/**
 * Service for interacting with the Master Merkle Engine
 * Provides wallet-specific operations on the merkle tree
 */
export class MasterMerkleService {
  private engine: MasterMerkleEngine;
  private static instance: MasterMerkleService;

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    // Initialize with empty data - will be synced from validator
    this.engine = new MasterMerkleEngine();
  }

  /**
   * Get singleton instance
   * @returns MasterMerkleService instance
   */
  static getInstance(): MasterMerkleService {
    if (!this.instance) {
      this.instance = new MasterMerkleService();
    }
    return this.instance;
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    await this.engine.initialize();
  }

  /**
   * Get user balance from merkle tree
   * @param address User address
   * @returns User balance or null if not found
   */
  async getUserBalance(address: string): Promise<UserBalance | null> {
    const balance = this.engine.getData(`userState.balances.${address.toLowerCase()}`);
    return balance as UserBalance | null;
  }

  /**
   * Get user stake information
   * @param address User address
   * @returns User stake or null if not found
   */
  async getUserStake(address: string): Promise<UserStake | null> {
    const stake = this.engine.getData(`userState.stakes.${address.toLowerCase()}`);
    return stake as UserStake | null;
  }

  /**
   * Get user reputation
   * @param address User address
   * @returns User reputation or null if not found
   */
  async getUserReputation(address: string): Promise<UserReputation | null> {
    const reputation = this.engine.getData(`userState.reputation.${address.toLowerCase()}`);
    return reputation as UserReputation | null;
  }

  /**
   * Update user balance (for testing/development)
   * @param address User address
   * @param balance New balance
   */
  async updateUserBalance(address: string, balance: UserBalance): Promise<void> {
    this.engine.updateData(`userState.balances.${address.toLowerCase()}`, balance);
  }

  /**
   * Generate merkle proof for user balance
   * @param address User address
   * @returns Merkle proof or null if not found
   */
  async generateBalanceProof(address: string): Promise<MerkleProof | null> {
    return this.engine.generateProof(`userState.balances.${address.toLowerCase()}`);
  }

  /**
   * Verify a merkle proof
   * @param proof Merkle proof to verify
   * @returns Whether proof is valid
   */
  async verifyProof(proof: MerkleProof): Promise<boolean> {
    return this.engine.verifyProof(proof);
  }

  /**
   * Get current merkle root
   * @returns Root hash
   */
  async getRoot(): Promise<string> {
    return this.engine.getRoot();
  }

  /**
   * Get current epoch
   * @returns Epoch number
   */
  async getEpoch(): Promise<number> {
    return this.engine.getEpoch();
  }

  /**
   * Update arbitrary data in the merkle tree
   * @param path Dot-separated path
   * @param value Value to set
   */
  async updateData(path: string, value: unknown): Promise<void> {
    this.engine.updateData(path, value);
  }

  /**
   * Get data at path
   * @param path Dot-separated path
   * @returns Data at path or null
   */
  async getData(path: string): Promise<unknown> {
    return this.engine.getData(path);
  }

  /**
   * Generate proof for arbitrary path
   * @param path Dot-separated path
   * @returns Merkle proof or null
   */
  async generateProof(path: string): Promise<MerkleProof | null> {
    return this.engine.generateProof(path);
  }

  /**
   * Export all data
   * @returns Complete merkle data structure
   */
  async exportData(): Promise<MasterMerkleData> {
    return this.engine.exportData();
  }

  /**
   * Import data structure
   * @param data Data to import
   */
  async importData(data: MasterMerkleData): Promise<void> {
    this.engine.importData(data);
  }

  /**
   * Increment epoch and get new root
   * @returns New root and epoch
   */
  async incrementEpoch(): Promise<{ root: string; epoch: number }> {
    return this.engine.incrementEpoch();
  }

  /**
   * Get leaf count
   * @returns Number of leaves in tree
   */
  async getLeafCount(): Promise<number> {
    return this.engine.getLeafCount();
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    await this.engine.shutdown();
  }
}