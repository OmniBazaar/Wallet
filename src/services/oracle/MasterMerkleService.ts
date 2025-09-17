/**
 * MasterMerkleService - Integration service for MasterMerkleEngine
 *
 * This service provides the interface between the Wallet module and the
 * real MasterMerkleEngine implementation from the Validator module.
 */

import { MasterMerkleEngine } from '../../../../Validator/dist/engines/MasterMerkleEngine';
import type {
  MasterMerkleData,
  MerkleProof
} from '../../../../Validator/dist/engines/MasterMerkleEngine';

// Define types that are used in MasterMerkleData but not exported separately
interface UserBalance {
  /** XOM token balance */
  xom: bigint;
  /** pXOM privacy token balance */
  pxom: bigint;
  /** Other token balances */
  tokens: Record<string, bigint>;
}

interface UserStake {
  /** Amount of XOM staked */
  amount: bigint;
  /** Staking tier (1-5) */
  tier: number;
  /** Lock end timestamp */
  lockEnd: number;
  /** Accumulated rewards */
  rewards: bigint;
}

interface UserReputation {
  /** Overall score (0-100) */
  score: number;
  /** Transaction count */
  transactionCount: number;
  /** Total volume traded */
  volumeTraded: bigint;
  /** Dispute count */
  disputeCount: number;
}

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
    if (MasterMerkleService.instance === undefined) {
      MasterMerkleService.instance = new MasterMerkleService();
    }
    return MasterMerkleService.instance;
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
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  getUserBalance(address: string): UserBalance | null {
    const balance = this.engine.getData(`userState.balances.${address.toLowerCase()}`);
    if (balance === null || balance === undefined) {
      return null;
    }
    return balance as UserBalance;
  }

  /**
   * Get user stake information
   * @param address User address
   * @returns User stake or null if not found
   */
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  getUserStake(address: string): UserStake | null {
    const stake = this.engine.getData(`userState.stakes.${address.toLowerCase()}`);
    if (stake === null || stake === undefined) {
      return null;
    }
    return stake as UserStake;
  }

  /**
   * Get user reputation
   * @param address User address
   * @returns User reputation or null if not found
   */
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  getUserReputation(address: string): UserReputation | null {
    const reputation = this.engine.getData(`userState.reputation.${address.toLowerCase()}`);
    if (reputation === null || reputation === undefined) {
      return null;
    }
    return reputation as UserReputation;
  }

  /**
   * Update user balance (for testing/development)
   * @param address User address
   * @param balance New balance
   */
  updateUserBalance(address: string, balance: UserBalance): void {
    this.engine.updateData(`userState.balances.${address.toLowerCase()}`, balance);
  }

  /**
   * Generate merkle proof for user balance
   * @param address User address
   * @returns Merkle proof or null if not found
   */
  generateBalanceProof(address: string): MerkleProof | null {
    return this.engine.generateProof(`userState.balances.${address.toLowerCase()}`);
  }

  /**
   * Verify a merkle proof
   * @param proof Merkle proof to verify
   * @returns Whether proof is valid
   */
  verifyProof(proof: MerkleProof): boolean {
    return this.engine.verifyProof(proof);
  }

  /**
   * Get current merkle root
   * @returns Root hash
   */
  getRoot(): string {
    return this.engine.getRoot();
  }

  /**
   * Get current epoch
   * @returns Epoch number
   */
  getEpoch(): number {
    return this.engine.getEpoch();
  }

  /**
   * Update arbitrary data in the merkle tree
   * @param path Dot-separated path
   * @param value Value to set
   */
  updateData(path: string, value: unknown): void {
    this.engine.updateData(path, value);
  }

  /**
   * Get data at path
   * @param path Dot-separated path
   * @returns Data at path or null
   */
  getData(path: string): unknown {
    return this.engine.getData(path);
  }

  /**
   * Generate proof for arbitrary path
   * @param path Dot-separated path
   * @returns Merkle proof or null
   */
  generateProof(path: string): MerkleProof | null {
    return this.engine.generateProof(path);
  }

  /**
   * Export all data
   * @returns Complete merkle data structure
   */
  exportData(): MasterMerkleData {
    return this.engine.exportData();
  }

  /**
   * Import data structure
   * @param data Data to import
   */
  importData(data: MasterMerkleData): void {
    this.engine.importData(data);
  }

  /**
   * Increment epoch and get new root
   * @returns New root and epoch
   */
  incrementEpoch(): { root: string; epoch: number } {
    return this.engine.incrementEpoch();
  }

  /**
   * Get leaf count
   * @returns Number of leaves in tree
   */
  getLeafCount(): number {
    return this.engine.getLeafCount();
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    await this.engine.shutdown();
  }
}