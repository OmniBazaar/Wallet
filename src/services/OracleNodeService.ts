/**
 * OracleNodeService - Bridges name data between COTI and Ethereum
 *
 * This service runs on OmniBazaar nodes and:
 * 1. Monitors COTI blockchain for name registrations
 * 2. Updates Ethereum oracle contracts with new data
 * 3. Provides stateless resolution services
 * 4. Earns XOM rewards for oracle duties
 */

import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import type { TransactionResponse } from 'ethers';

/** Configuration for oracle node */
interface NodeConfig {
  cotiRpcUrl: string;
  ethereumRpcUrl: string;
  privateKey: string;
  oracleAddress: string;
  registryAddress: string;
  updateInterval: number;
  rewardAmount: number;
}

/** Name update record */
interface NameUpdate {
  username: string;
  address: string;
  timestamp: number;
  blockNumber: number;
}

/** Oracle node performance metrics */
interface OracleMetrics {
  totalUpdates: number;
  successfulUpdates: number;
  failedUpdates: number;
  lastUpdateTime: number;
  reputation: number;
  earnedRewards: number;
}

// Event types are defined for future use but not currently referenced

/** Event emitted when a single name is updated */
interface NameUpdatedEvent {
  type: 'name-updated';
  username: string;
  address: string;
  txHash: string;
  gasUsed: bigint;
  reward: number;
}

/** Event emitted when batch updates complete */
interface BatchUpdatedEvent {
  type: 'batch-updated';
  count: number;
  txHash: string;
  gasUsed: bigint;
  totalReward: number;
}

// Oracle event types are defined above but not currently used in the implementation

/**
 * Oracle node service for bridging name data between COTI and Ethereum.
 * Monitors COTI blockchain for name registrations and updates Ethereum oracle contracts.
 */
export class OracleNodeService extends EventEmitter {
  /** 
   * Emit started event - signals service startup
   * @internal
   */
  public override emit(event: 'started'): boolean;
  /** 
   * Emit stopped event - signals service shutdown
   * @internal
   */
  public override emit(event: 'stopped'): boolean;
  /** 
   * Emit updates-processed event - signals batch processing completion
   * @internal
   */
  public override emit(event: 'updates-processed', data: { count: number; remaining: number }): boolean;
  /** 
   * Emit name-updated event - signals single name update completion
   * @internal
   */
  public override emit(event: 'name-updated', data: Omit<NameUpdatedEvent, 'type'>): boolean;
  /** 
   * Emit batch-updated event - signals batch update completion
   * @internal
   */
  public override emit(event: 'batch-updated', data: Omit<BatchUpdatedEvent, 'type'>): boolean;
  /**
   * Generic event emitter for oracle service events
   * @internal
   * @param event - Event name
   * @param args - Event arguments
   * @returns True if event had listeners
   */
  public override emit(event: string, ...args: unknown[]): boolean {
    return super.emit(event, ...args);
  }
  private cotiProvider!: ethers.Provider;
  private ethereumProvider!: ethers.Provider;
  private signer!: ethers.Wallet;
  private registryContract!: ethers.Contract;
  private oracleContract!: ethers.Contract;
  private updateInterval?: NodeJS.Timeout;
  private isRunning = false;
  private updateQueue: NameUpdate[] = [];
  private metrics: OracleMetrics;
  private config: NodeConfig;

  // Contract ABIs (simplified)
  private registryABI = [
    'event NameRegistered(string indexed username, address indexed owner, uint256 timestamp)',
    'event NameTransferred(string indexed username, address indexed from, address indexed to)',
    'function resolve(string memory username) external view returns (address)',
    'function reverseResolve(address addr) external view returns (string memory)'
  ];

  private oracleABI = [
    'function updateName(string memory username, address resolvedAddress) external',
    'function batchUpdateNames(string[] memory usernames, address[] memory addresses) external',
    'function queryName(string memory username) external view returns (address)',
    'function isHealthy() external view returns (bool)',
    'function getLastUpdateTime() external view returns (uint256)'
  ];

  /**
   * Create new oracle node service
   * @param config Node configuration
   */
  constructor(config: NodeConfig) {
    super();
    this.config = config;
    this.metrics = {
      totalUpdates: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      lastUpdateTime: 0,
      reputation: 100,
      earnedRewards: 0
    };

    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Initialize COTI provider
    this.cotiProvider = new ethers.JsonRpcProvider(this.config.cotiRpcUrl);

    // Initialize Ethereum provider
    this.ethereumProvider = new ethers.JsonRpcProvider(this.config.ethereumRpcUrl);

    // Initialize signer
    this.signer = new ethers.Wallet(this.config.privateKey, this.ethereumProvider);

    // Initialize contracts
    this.registryContract = new ethers.Contract(
      this.config.registryAddress,
      this.registryABI,
      this.cotiProvider
    );

    this.oracleContract = new ethers.Contract(
      this.config.oracleAddress,
      this.oracleABI,
      this.signer
    );
  }

  /**
   * Ensure providers are initialized
   */
  private ensureInitialized(): void {
    if (this.cotiProvider === undefined || 
        this.ethereumProvider === undefined || 
        this.signer === undefined || 
        this.registryContract === undefined || 
        this.oracleContract === undefined) {
      throw new Error('Oracle node service not properly initialized');
    }
  }

  /** Start the oracle node service and begin monitoring/updates. */
  public async start(): Promise<void> {
    this.ensureInitialized();
    if (this.isRunning) {
      // Service is already running
      return;
    }

    // Starting Oracle Node Service...

    try {
      // Test connections
      await this.testConnections();

      // Start monitoring COTI blockchain
      this.startCotiMonitoring();

      // Start periodic updates
      this.startUpdateScheduler();

      this.isRunning = true;
      // Oracle Node Service started successfully

      this.emit('started');
    } catch (error) {
      throw new Error(`Failed to start Oracle Node Service: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Stop the oracle node service and flush the queue. */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      // Service is not running
      return;
    }

    // Stopping Oracle Node Service...

    this.isRunning = false;

    // Process remaining updates
    await this.processUpdateQueue();

    // Oracle Node Service stopped
    if (this.updateInterval !== undefined) {
      clearInterval(this.updateInterval);
      delete this.updateInterval;
    }
    this.emit('stopped');
  }

  /**
   * Test connections to both networks
   */
  private async testConnections(): Promise<void> {
    this.ensureInitialized();
    // Testing network connections...

    // Test COTI connection
    try {
      const _cotiBlockNumber = await this.cotiProvider.getBlockNumber();
      // COTI connection OK
    } catch (error) {
      throw new Error(`COTI connection failed: ${(error as Error).message}`);
    }

    // Test Ethereum connection
    try {
      const _ethBlockNumber = await this.ethereumProvider.getBlockNumber();
      // Ethereum connection OK
    } catch (error) {
      throw new Error(`Ethereum connection failed: ${(error as Error).message}`);
    }

    // Test oracle health
    try {
      const isHealthyMethod = this.oracleContract['isHealthy'];
      if (isHealthyMethod && typeof isHealthyMethod === 'function') {
        const _isHealthy = await isHealthyMethod() as boolean;
      }
      // Oracle health check complete
    } catch (error) {
      // Oracle health check failed - non-critical
    }
  }

  /**
   * Begin listening to COTI registry events for name changes.
   * Sets up event listeners for name registrations and transfers.
   */
  private startCotiMonitoring(): void {
    // Starting COTI blockchain monitoring...

    // Listen for name registrations
    void this.registryContract.on('NameRegistered', 
      (username: string, owner: string, timestamp: bigint, event: ethers.EventPayload<unknown>) => {
        // Name registered
        const eventWithLog = event as unknown as { log?: { blockNumber?: number } };
        const log = eventWithLog.log;
        const blockNumber = log?.blockNumber ?? 0;
        this.queueUpdate({
          username,
          address: owner,
          timestamp: Number(timestamp),
          blockNumber
        });
      }
    );

    // Listen for name transfers
    void this.registryContract.on('NameTransferred', 
      (username: string, from: string, to: string, event: ethers.EventPayload<unknown>) => {
        // Name transferred
        const eventWithLog = event as unknown as { log?: { blockNumber?: number } };
        const log = eventWithLog.log;
        const blockNumber = log?.blockNumber ?? 0;
        this.queueUpdate({
          username,
          address: to,
          timestamp: Date.now(),
          blockNumber
        });
      }
    );
  }

  /**
   * Start periodic scheduler to process the update queue.
   * Runs at intervals specified in config.
   */
  private startUpdateScheduler(): void {
    // Starting update scheduler...

    this.updateInterval = setInterval(() => {
      if (this.isRunning && this.updateQueue.length > 0) {
        void this.processUpdateQueue();
      }
    }, this.config.updateInterval * 1000);
  }

  /**
   * Queue a name update for processing (deduplicates by username).
   * @param update Name update record
   */
  private queueUpdate(update: NameUpdate): void {
    // Check if update already exists
    const existingIndex = this.updateQueue.findIndex(u => u.username === update.username);

    if (existingIndex !== -1) {
      // Update existing entry with latest data
      this.updateQueue[existingIndex] = update;
    } else {
      // Add new entry
      this.updateQueue.push(update);
    }

    // Update queued
  }

  /** Process queued name updates (single or batch). */
  private async processUpdateQueue(): Promise<void> {
    this.ensureInitialized();
    if (this.updateQueue.length === 0) {
      return;
    }

    // Processing updates...

    try {
      // Process in batches
      const batchSize = Math.min(this.updateQueue.length, 10);
      const batch = this.updateQueue.splice(0, batchSize);

      if (batch.length === 1) {
        // Single update
        const firstUpdate = batch[0];
        if (firstUpdate !== undefined) {
          await this.updateSingleName(firstUpdate);
        }
      } else if (batch.length > 1) {
        // Batch update
        await this.updateBatchNames(batch);
      }

      this.metrics.successfulUpdates += batch.length;
      this.metrics.lastUpdateTime = Date.now();

      // Updates processed successfully

      // Emit progress
      this.emit('updates-processed', {
        count: batch.length,
        remaining: this.updateQueue.length
      });

    } catch (error) {
      this.metrics.failedUpdates++;
      // Failed to process updates - retry logic could be implemented here
    }

    this.metrics.totalUpdates++;
  }

  /**
   * Update a single name entry in the oracle contract.
   * @param update - The name update record containing username and address
   */
  private async updateSingleName(update: NameUpdate): Promise<void> {
    // Updating single name...

    try {
      // Call updateName on the contract
      type UpdateNameFn = (username: string, address: string) => Promise<TransactionResponse>;
      const updateName = this.oracleContract['updateName'] as UpdateNameFn;
      const tx = await updateName(update.username, update.address);
      const receipt = await tx.wait();

      // Single update completed

      // Calculate reward
      const reward = this.config.rewardAmount;
      this.metrics.earnedRewards += reward;

      this.emit('name-updated', {
        username: update.username,
        address: update.address,
        txHash: receipt?.hash ?? '',
        gasUsed: receipt?.gasUsed ?? 0n,
        reward
      });

    } catch (error) {
      throw new Error(`Single update failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Batch update multiple name entries in the oracle contract.
   * @param updates - Array of name update records
   */
  private async updateBatchNames(updates: NameUpdate[]): Promise<void> {
    // Updating batch of names...

    try {
      const usernames = updates.map(u => u.username);
      const addresses = updates.map(u => u.address);

      // Call batchUpdateNames on the contract
      type BatchUpdateNamesFn = (usernames: string[], addresses: string[]) => Promise<TransactionResponse>;
      const batchUpdateNames = this.oracleContract['batchUpdateNames'] as BatchUpdateNamesFn;
      const tx = await batchUpdateNames(usernames, addresses);
      const receipt = await tx.wait();

      // Batch update completed

      // Calculate rewards
      const totalReward = this.config.rewardAmount * updates.length;
      this.metrics.earnedRewards += totalReward;

      this.emit('batch-updated', {
        count: updates.length,
        txHash: receipt?.hash ?? '',
        gasUsed: receipt?.gasUsed ?? 0n,
        totalReward
      });

    } catch (error) {
      throw new Error(`Batch update failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Return a snapshot of current node metrics.
   * @returns A copy of the current oracle metrics
   */
  public getMetrics(): OracleMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current service status including queue size and metrics.
   * @returns Status object with running state, queue size, and metrics
   */
  public getStatus(): {
    /** Whether the service is currently running */
    isRunning: boolean;
    /** Number of updates waiting in queue */
    queueSize: number;
    /** Current performance metrics */
    metrics: OracleMetrics;
    /** Last error message if any */
    lastError?: string;
  } {
    return {
      isRunning: this.isRunning,
      queueSize: this.updateQueue.length,
      metrics: this.getMetrics()
    };
  }

  /**
   * Query a name from the COTI registry contract.
   * @param username - The username to query
   * @returns The resolved address or zero address if not found
   */
  public async queryCotiName(username: string): Promise<string> {
    this.ensureInitialized();
    try {
      // Call resolve on the contract
      type ResolveFn = (username: string) => Promise<string>;
      const resolve = this.registryContract['resolve'] as ResolveFn;
      const address = await resolve(username);
      return address;
    } catch (error) {
      // Failed to query COTI name
      return ethers.ZeroAddress;
    }
  }

  /**
   * Query a name from the Ethereum oracle contract.
   * @param username - The username to query
   * @returns The resolved address or zero address if not found
   */
  public async queryEthereumName(username: string): Promise<string> {
    this.ensureInitialized();
    try {
      // Call queryName on the contract
      type QueryNameFn = (username: string) => Promise<string>;
      const queryName = this.oracleContract['queryName'] as QueryNameFn;
      const address = await queryName(username);
      return address;
    } catch (error) {
      // Failed to query Ethereum name
      return ethers.ZeroAddress;
    }
  }

  /**
   * Force a sync for a specific username from COTI to Ethereum.
   * @param username - The username to force sync
   */
  public async forceSyncName(username: string): Promise<void> {
    this.ensureInitialized();
    // Force syncing name...

    try {
      const cotiAddress = await this.queryCotiName(username);

      if (cotiAddress !== ethers.ZeroAddress) {
        await this.updateSingleName({
          username,
          address: cotiAddress,
          timestamp: Date.now(),
          blockNumber: await this.cotiProvider.getBlockNumber()
        });

        // Force sync completed
      } else {
        throw new Error(`Name ${username} not found on COTI`);
      }

    } catch (error) {
      throw new Error(`Force sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Perform a health check across providers and recent activity.
   * @returns True if the service is healthy, false otherwise
   */
  public async healthCheck(): Promise<boolean> {
    this.ensureInitialized();
    try {
      // Check if running
      if (!this.isRunning) {
        return false;
      }

      // Check oracle health
      // Call isHealthy on the contract
      const isHealthy = this.oracleContract['isHealthy'] as () => Promise<boolean>;
      const oracleHealthy = await isHealthy();

      // Check recent activity
      const timeSinceLastUpdate = Date.now() - this.metrics.lastUpdateTime;
      const isRecentlyActive = timeSinceLastUpdate < (this.config.updateInterval * 2 * 1000);

      return Boolean(oracleHealthy && isRecentlyActive);

    } catch (error) {
      // Health check failed
      return false;
    }
  }
}
