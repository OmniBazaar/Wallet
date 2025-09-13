/**
 * Transaction Database Service for YugabyteDB Integration
 *
 * Provides database persistence for wallet transaction history using YugabyteDB.
 * Stores all transaction records for easy querying and reporting.
 *
 * @module services/database/TransactionDatabase
 */

/**
 * Database response type for transaction data
 */
interface TransactionDatabaseRow {
  id?: string;
  tx_hash: string;
  block_number?: number;
  block_hash?: string;
  user_address: string;
  tx_type: TransactionRecord['txType'];
  from_address: string;
  to_address: string;
  contract_address?: string;
  amount: string;
  token_address?: string;
  token_symbol: string;
  token_decimals?: number;
  gas_used?: string;
  gas_price?: string;
  tx_fee?: string;
  status: TransactionRecord['status'];
  confirmations?: number;
  created_at: string;
  confirmed_at?: string;
  metadata?: Record<string, unknown>;
  notes?: string;
  tags?: string[];
}

/**
 * Database response for transaction list queries
 */
interface TransactionListResponse {
  transactions: TransactionDatabaseRow[];
  total: number;
}

/**
 * Transaction record
 */
export interface TransactionRecord {
  /** Unique database record ID (optional) */
  id?: string;
  /** Transaction hash */
  txHash: string;
  /** Block number where transaction was mined (optional) */
  blockNumber?: number;
  /** Block hash where transaction was mined (optional) */
  blockHash?: string;
  /** User's wallet address */
  userAddress: string;
  /** Type of transaction */
  txType: 'send' | 'receive' | 'swap' | 'stake' | 'unstake' | 'claim_rewards' |
  'provide_liquidity' | 'remove_liquidity' | 'purchase' | 'sale' | 'fee' | 'bridge';
  /** Sender address */
  fromAddress: string;
  /** Recipient address */
  toAddress: string;
  /** Smart contract address (optional) */
  contractAddress?: string;
  /** Transaction amount */
  amount: string;
  /** Token contract address (optional) */
  tokenAddress?: string;
  /** Token symbol */
  tokenSymbol: string;
  /** Token decimal places (optional) */
  tokenDecimals?: number;
  /** Gas units used (optional) */
  gasUsed?: string;
  /** Gas price in wei (optional) */
  gasPrice?: string;
  /** Total transaction fee (optional) */
  txFee?: string;
  /** Transaction status */
  status: 'pending' | 'confirmed' | 'failed' | 'dropped';
  /** Number of confirmations (optional) */
  confirmations?: number;
  /** When transaction was created */
  createdAt: Date;
  /** When transaction was confirmed (optional) */
  confirmedAt?: Date;
  /** Additional transaction metadata */
  metadata?: Record<string, unknown>;
  /** Free-form user notes about this tx */
  notes?: string;
  /** Optional list of tags for filtering */
  tags?: string[];
}

/**
 * Transaction filters
 */
export interface TransactionFilters {
  /** User address to filter by */
  userAddress?: string;
  /** Transaction type to filter by */
  txType?: TransactionRecord['txType'];
  /** Status filter */
  status?: TransactionRecord['status'];
  /** Token symbol filter */
  tokenSymbol?: string;
  /** Start date for date range */
  fromDate?: Date;
  /** End date for date range */
  toDate?: Date;
  /** Minimum amount filter */
  minAmount?: string;
  /** Maximum amount filter */
  maxAmount?: string;
  /** Sort column */
  sortBy?: 'date' | 'amount' | 'status';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
  /** Page size */
  limit?: number;
  /** Page offset */
  offset?: number;
}

/**
 * Transaction statistics
 */
export interface TransactionStats {
  /** Total number of transactions */
  totalTransactions: number;
  /** Sum of all transaction amounts (string) */
  totalVolume: string;
  /** Number of pending transactions */
  pendingCount: number;
  /** Number of failed transactions */
  failedCount: number;
  /** Average gas price across records */
  averageGasPrice: string;
  /** Most frequently used token symbol */
  mostUsedToken: string;
}

/**
 * Transaction Database Service
 *
 * Handles database operations for wallet transaction history.
 * Uses YugabyteDB for distributed SQL with PostgreSQL compatibility.
 */
export class TransactionDatabase {
  private apiEndpoint: string;

  /**
   * Construct a TransactionDatabase adapter.
   * @param apiEndpoint - Base API endpoint (defaults to /api/wallet)
   */
  constructor(apiEndpoint?: string) {
    this.apiEndpoint = apiEndpoint ?? '/api/wallet';
  }

  /**
   * Store a new transaction
   * @param transaction - The transaction record to store
   * @returns Promise that resolves when transaction is stored
   */
  async storeTransaction(transaction: TransactionRecord): Promise<void> {
    const response = await fetch(`${this.apiEndpoint}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(transaction)
    });

    if (!response.ok) {
      throw new Error(`Failed to store transaction: ${response.statusText}`);
    }
  }

  /**
   * Update transaction status
   * @param txHash - Transaction hash to update
   * @param status - New transaction status
   * @param blockNumber - Block number where transaction was mined
   * @param confirmations - Number of confirmations
   * @returns Promise that resolves when status is updated
   */
  async updateTransactionStatus(
    txHash: string,
    status: TransactionRecord['status'],
    blockNumber?: number,
    confirmations?: number
  ): Promise<void> {
    const response = await fetch(`${this.apiEndpoint}/transactions/${txHash}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status,
        blockNumber,
        confirmations,
        confirmedAt: status === 'confirmed' ? new Date().toISOString() : undefined
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to update transaction: ${response.statusText}`);
    }
  }

  /**
   * Get transaction by hash
   * @param txHash - Transaction hash to look up
   * @returns Transaction record or null if not found
   */
  async getTransaction(txHash: string): Promise<TransactionRecord | null> {
    const response = await fetch(`${this.apiEndpoint}/transactions/${txHash}`);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to get transaction: ${response.statusText}`);
    }

    const data = await response.json() as TransactionDatabaseRow;
    return this.mapToTransactionRecord(data);
  }

  /**
   * Get user's transaction history
   * @param userAddress - User's wallet address
   * @param filters - Optional filters for the query
   * @returns Object containing transactions array and total count
   */
  async getUserTransactions(
    userAddress: string,
    filters?: TransactionFilters
  ): Promise<{
    transactions: TransactionRecord[];
    total: number;
  }> {
    const params = new URLSearchParams();
    params.set('user', userAddress);

    if (filters !== undefined) {
      if (filters.txType !== undefined) params.set('type', filters.txType);
      if (filters.status !== undefined) params.set('status', filters.status);
      if (filters.tokenSymbol !== undefined && filters.tokenSymbol !== '') params.set('token', filters.tokenSymbol);
      if (filters.fromDate !== undefined) params.set('from_date', filters.fromDate.toISOString());
      if (filters.toDate !== undefined) params.set('to_date', filters.toDate.toISOString());
      if (filters.minAmount !== undefined && filters.minAmount !== '') params.set('min_amount', filters.minAmount);
      if (filters.maxAmount !== undefined && filters.maxAmount !== '') params.set('max_amount', filters.maxAmount);
      if (filters.sortBy !== undefined) params.set('sort_by', filters.sortBy);
      if (filters.sortOrder !== undefined) params.set('sort_order', filters.sortOrder);
      params.set('limit', (filters.limit ?? 50).toString());
      params.set('offset', (filters.offset ?? 0).toString());
    }

    const response = await fetch(`${this.apiEndpoint}/transactions?${String(params)}`);

    if (!response.ok) {
      throw new Error(`Failed to get transactions: ${response.statusText}`);
    }

    const data = await response.json() as TransactionListResponse;

    return {
      transactions: data.transactions.map((t) => this.mapToTransactionRecord(t)),
      total: data.total
    };
  }

  /**
   * Get transaction statistics for a user
   * @param userAddress - User's wallet address
   * @returns Transaction statistics
   */
  async getUserStats(userAddress: string): Promise<TransactionStats> {
    const response = await fetch(`${this.apiEndpoint}/transactions/stats?user=${userAddress}`);

    if (!response.ok) {
      throw new Error(`Failed to get statistics: ${response.statusText}`);
    }

    return await response.json() as TransactionStats;
  }

  /**
   * Add a note to a transaction
   * @param txHash - Transaction hash to add note to
   * @param note - Note text to add
   * @param category - Optional category for the note
   * @param tags - Optional tags for filtering
   * @returns Promise that resolves when note is added
   */
  async addTransactionNote(
    txHash: string,
    note: string,
    category?: string,
    tags?: string[]
  ): Promise<void> {
    const response = await fetch(`${this.apiEndpoint}/transactions/${txHash}/note`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        note,
        category,
        tags
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to add note: ${response.statusText}`);
    }
  }

  /**
   * Get pending transactions for monitoring
   * @param userAddress - Optional user address to filter by
   * @returns Array of pending transactions
   */
  async getPendingTransactions(userAddress?: string): Promise<TransactionRecord[]> {
    const params = new URLSearchParams();
    params.set('status', 'pending');
    if (userAddress !== undefined && userAddress !== '') params.set('user', userAddress);

    const response = await fetch(`${this.apiEndpoint}/transactions/pending?${String(params)}`);

    if (!response.ok) {
      throw new Error(`Failed to get pending transactions: ${response.statusText}`);
    }

    const data = await response.json() as TransactionDatabaseRow[];
    return data.map((t) => this.mapToTransactionRecord(t));
  }

  /**
   * Bulk update transaction confirmations
   * @param updates - Array of update objects containing txHash, confirmations, and optional status
   * @returns Promise that resolves when updates are complete
   */
  async updateConfirmations(updates: Array<{
    txHash: string;
    confirmations: number;
    status?: TransactionRecord['status'];
  }>): Promise<void> {
    const response = await fetch(`${this.apiEndpoint}/transactions/bulk-update`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ updates })
    });

    if (!response.ok) {
      throw new Error(`Failed to update confirmations: ${response.statusText}`);
    }
  }

  /**
   * Export transactions for a date range
   * @param userAddress - User's wallet address
   * @param fromDate - Start date for export range
   * @param toDate - End date for export range
   * @param format - Export format (csv or json)
   * @returns Blob containing exported data
   */
  async exportTransactions(
    userAddress: string,
    fromDate: Date,
    toDate: Date,
    format: 'csv' | 'json' = 'json'
  ): Promise<Blob> {
    const params = new URLSearchParams();
    params.set('user', userAddress);
    params.set('from_date', fromDate.toISOString());
    params.set('to_date', toDate.toISOString());
    params.set('format', format);

    const response = await fetch(`${this.apiEndpoint}/transactions/export?${String(params)}`);

    if (!response.ok) {
      throw new Error(`Failed to export transactions: ${response.statusText}`);
    }

    return await response.blob();
  }

  /**
   * Map database row to TransactionRecord
   * @param row - Database row object
   * @returns Mapped TransactionRecord
   */
  private mapToTransactionRecord(row: TransactionDatabaseRow): TransactionRecord {
    const record: TransactionRecord = {
      txHash: row.tx_hash,
      userAddress: row.user_address,
      txType: row.tx_type,
      fromAddress: row.from_address,
      toAddress: row.to_address,
      amount: row.amount,
      tokenSymbol: row.token_symbol,
      status: row.status,
      createdAt: new Date(row.created_at)
    };

    // Add optional fields only if they exist
    if (row.id !== undefined) record.id = row.id;
    if (row.block_number !== undefined) record.blockNumber = row.block_number;
    if (row.block_hash !== undefined) record.blockHash = row.block_hash;
    if (row.contract_address !== undefined) record.contractAddress = row.contract_address;
    if (row.token_address !== undefined) record.tokenAddress = row.token_address;
    if (row.token_decimals !== undefined) record.tokenDecimals = row.token_decimals;
    if (row.gas_used !== undefined) record.gasUsed = row.gas_used;
    if (row.gas_price !== undefined) record.gasPrice = row.gas_price;
    if (row.tx_fee !== undefined) record.txFee = row.tx_fee;
    if (row.confirmations !== undefined) record.confirmations = row.confirmations;
    if (row.confirmed_at !== undefined) record.confirmedAt = new Date(row.confirmed_at);
    if (row.metadata !== undefined) record.metadata = row.metadata;
    if (row.notes !== undefined) record.notes = row.notes;
    if (row.tags !== undefined) record.tags = row.tags;

    return record;
  }

  /**
   * Check database connectivity
   * @returns True if database is accessible, false otherwise
   */
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiEndpoint}/health`);
      return response.ok;
    } catch (error) {
      // Log error using proper logging mechanism instead of console
      // In production, this should use a proper logger service
      // Error: error
      return false;
    }
  }
}
