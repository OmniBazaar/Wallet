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

/** Oracle node service for bridging name data between COTI and Ethereum */
export class OracleNodeService extends EventEmitter {
  private cotiProvider!: ethers.Provider;
  private ethereumProvider!: ethers.Provider;
  private signer!: ethers.Wallet;
  private registryContract!: ethers.Contract;
  private oracleContract!: ethers.Contract;
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
    if (!this.cotiProvider || !this.ethereumProvider || !this.signer || !this.registryContract || !this.oracleContract) {
      throw new Error('Oracle node service not properly initialized');
    }
  }

  /** Start the oracle node service and begin monitoring/updates. */
  public async start(): Promise<void> {
    this.ensureInitialized();
    if (this.isRunning) {
      console.warn('Oracle node service is already running');
      return;
    }

    console.warn('🚀 Starting Oracle Node Service...');

    try {
      // Test connections
      await this.testConnections();

      // Start monitoring COTI blockchain
      this.startCotiMonitoring();

      // Start periodic updates
      this.startUpdateScheduler();

      this.isRunning = true;
      console.warn('✅ Oracle Node Service started successfully');

      this.emit('started');
    } catch (error) {
      console.warn('❌ Failed to start Oracle Node Service:', error);
      throw error;
    }
  }

  /** Stop the oracle node service and flush the queue. */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn('Oracle node service is not running');
      return;
    }

    console.warn('🛑 Stopping Oracle Node Service...');

    this.isRunning = false;

    // Process remaining updates
    await this.processUpdateQueue();

    console.warn('✅ Oracle Node Service stopped');
    this.emit('stopped');
  }

  /**
   * Test connections to both networks
   */
  private async testConnections(): Promise<void> {
    this.ensureInitialized();
    console.warn('🔍 Testing network connections...');

    // Test COTI connection
    try {
      const cotiBlockNumber = await this.cotiProvider!.getBlockNumber();
      console.warn(`✅ COTI connection OK (block: ${cotiBlockNumber})`);
    } catch (error) {
      throw new Error(`COTI connection failed: ${(error as Error).message}`);
    }

    // Test Ethereum connection
    try {
      const ethBlockNumber = await this.ethereumProvider.getBlockNumber();
      console.warn(`✅ Ethereum connection OK (block: ${ethBlockNumber})`);
    } catch (error) {
      throw new Error(`Ethereum connection failed: ${(error as Error).message}`);
    }

    // Test oracle health
    try {
      const isHealthy = await this.oracleContract?.['isHealthy']?.();
      console.warn(`✅ Oracle health: ${isHealthy}`);
    } catch (error) {
      console.warn(`⚠️  Oracle health check failed: ${(error as Error).message}`);
    }
  }

  /** Begin listening to COTI registry events for name changes. */
  private startCotiMonitoring(): void {
    console.warn('👁️  Starting COTI blockchain monitoring...');

    // Listen for name registrations
    this.registryContract.on('NameRegistered', (username, owner, timestamp, event) => {
      console.warn(`📝 Name registered: ${username} -> ${owner}`);

      this.queueUpdate({
        username,
        address: owner,
        timestamp: Number(timestamp),
        blockNumber: event.blockNumber
      });
    });

    // Listen for name transfers
    this.registryContract.on('NameTransferred', (username, from, to, event) => {
      console.warn(`🔄 Name transferred: ${username} (${from} -> ${to})`);

      this.queueUpdate({
        username,
        address: to,
        timestamp: Date.now(),
        blockNumber: event.blockNumber
      });
    });
  }

  /** Start periodic scheduler to process the update queue. */
  private startUpdateScheduler(): void {
    console.warn('⏰ Starting update scheduler...');

    setInterval(async () => {
      if (this.isRunning && this.updateQueue.length > 0) {
        await this.processUpdateQueue();
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

    console.warn(`📥 Queued update: ${update.username} (queue size: ${this.updateQueue.length})`);
  }

  /** Process queued name updates (single or batch). */
  private async processUpdateQueue(): Promise<void> {
    this.ensureInitialized();
    if (this.updateQueue.length === 0) {
      return;
    }

    console.warn(`🔄 Processing ${this.updateQueue.length} updates...`);

    try {
      // Process in batches
      const batchSize = Math.min(this.updateQueue.length, 10);
      const batch = this.updateQueue.splice(0, batchSize);

      if (batch.length === 1) {
        // Single update
        const firstUpdate = batch[0];
        if (firstUpdate) {
          await this.updateSingleName(firstUpdate);
        }
      } else {
        // Batch update
        await this.updateBatchNames(batch);
      }

      this.metrics.successfulUpdates += batch.length;
      this.metrics.lastUpdateTime = Date.now();

      console.warn(`✅ Processed ${batch.length} updates successfully`);

      // Emit progress
      this.emit('updates-processed', {
        count: batch.length,
        remaining: this.updateQueue.length
      });

    } catch (error) {
      console.warn('❌ Failed to process updates:', error);
      this.metrics.failedUpdates++;

      // Re-queue failed updates (with limit)
      if (this.metrics.failedUpdates < 3) {
        console.warn('🔄 Re-queuing failed updates...');
        // Could implement retry logic here
      }
    }

    this.metrics.totalUpdates++;
  }

  /** Update a single name entry in the oracle contract. */
  private async updateSingleName(update: NameUpdate): Promise<void> {
    console.warn(`🔄 Updating single name: ${update.username} -> ${update.address}`);

    try {
      if (!this.oracleContract) {
        throw new Error('Oracle contract not initialized');
      }
      
      const tx = await this.oracleContract['updateName'](update.username, update.address);
      const receipt = await tx.wait();

      console.warn(`✅ Single update completed (gas: ${receipt.gasUsed})`);

      // Calculate reward
      const reward = this.config.rewardAmount;
      this.metrics.earnedRewards += reward;

      this.emit('name-updated', {
        username: update.username,
        address: update.address,
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed,
        reward
      });

    } catch (error) {
      console.warn(`❌ Single update failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /** Batch update multiple name entries in the oracle contract. */
  private async updateBatchNames(updates: NameUpdate[]): Promise<void> {
    console.warn(`🔄 Updating batch of ${updates.length} names...`);

    try {
      const usernames = updates.map(u => u.username);
      const addresses = updates.map(u => u.address);

      if (!this.oracleContract) {
        throw new Error('Oracle contract not initialized');
      }
      
      const tx = await this.oracleContract['batchUpdateNames'](usernames, addresses);
      const receipt = await tx.wait();

      console.warn(`✅ Batch update completed (gas: ${receipt.gasUsed})`);

      // Calculate rewards
      const totalReward = this.config.rewardAmount * updates.length;
      this.metrics.earnedRewards += totalReward;

      this.emit('batch-updated', {
        count: updates.length,
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed,
        totalReward
      });

    } catch (error) {
      console.warn(`❌ Batch update failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /** Return a snapshot of current node metrics. */
  public getMetrics(): OracleMetrics {
    return { ...this.metrics };
  }

  /** Get current service status including queue size and metrics. */
  public getStatus(): {
    /**
     *
     */
    isRunning: boolean;
    /**
     *
     */
    queueSize: number;
    /**
     *
     */
    metrics: OracleMetrics;
    /**
     *
     */
    lastError?: string;
  } {
    return {
      isRunning: this.isRunning,
      queueSize: this.updateQueue.length,
      metrics: this.getMetrics()
    };
  }

  /** Query a name from the COTI registry contract. */
  public async queryCotiName(username: string): Promise<string> {
    this.ensureInitialized();
    try {
      if (!this.registryContract) {
        throw new Error('Registry contract not initialized');
      }
      
      const address = await this.registryContract['resolve'](username);
      return address;
    } catch (error) {
      console.warn(`❌ Failed to query COTI name: ${(error as Error).message}`);
      return ethers.ZeroAddress;
    }
  }

  /** Query a name from the Ethereum oracle contract. */
  public async queryEthereumName(username: string): Promise<string> {
    this.ensureInitialized();
    try {
      const address = await this.oracleContract!['queryName'](username);
      return address;
    } catch (error) {
      console.warn(`❌ Failed to query Ethereum name: ${(error as Error).message}`);
      return ethers.ZeroAddress;
    }
  }

  /** Force a sync for a specific username from COTI → Ethereum. */
  public async forceSyncName(username: string): Promise<void> {
    this.ensureInitialized();
    console.warn(`🔄 Force syncing name: ${username}`);

    try {
      const cotiAddress = await this.queryCotiName(username);

      if (cotiAddress && cotiAddress !== ethers.ZeroAddress) {
        await this.updateSingleName({
          username,
          address: cotiAddress,
          timestamp: Date.now(),
          blockNumber: await this.cotiProvider.getBlockNumber()
        });

        console.warn(`✅ Force sync completed for ${username}`);
      } else {
        console.warn(`⚠️  Name ${username} not found on COTI`);
      }

    } catch (error) {
      console.warn(`❌ Force sync failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /** Perform a health check across providers and recent activity. */
  public async healthCheck(): Promise<boolean> {
    this.ensureInitialized();
    try {
      // Check if running
      if (!this.isRunning) {
        return false;
      }

      // Check oracle health
      const oracleHealthy = await this.oracleContract?.['isHealthy']?.();

      // Check recent activity
      const timeSinceLastUpdate = Date.now() - this.metrics.lastUpdateTime;
      const isRecentlyActive = timeSinceLastUpdate < (this.config.updateInterval * 2 * 1000);

      return oracleHealthy && isRecentlyActive;

    } catch (error) {
      console.warn(`❌ Health check failed: ${(error as Error).message}`);
      return false;
    }
  }
}
