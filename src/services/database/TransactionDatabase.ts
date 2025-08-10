/**
 * Transaction Database Service for YugabyteDB Integration
 * 
 * Provides database persistence for wallet transaction history using YugabyteDB.
 * Stores all transaction records for easy querying and reporting.
 * 
 * @module services/database/TransactionDatabase
 */

/**
 * Transaction record
 */
export interface TransactionRecord {
  id?: string;
  txHash: string;
  blockNumber?: number;
  blockHash?: string;
  userAddress: string;
  txType: 'send' | 'receive' | 'swap' | 'stake' | 'unstake' | 'claim_rewards' | 
          'provide_liquidity' | 'remove_liquidity' | 'purchase' | 'sale' | 'fee' | 'bridge';
  fromAddress: string;
  toAddress: string;
  contractAddress?: string;
  amount: string;
  tokenAddress?: string;
  tokenSymbol: string;
  tokenDecimals?: number;
  gasUsed?: string;
  gasPrice?: string;
  txFee?: string;
  status: 'pending' | 'confirmed' | 'failed' | 'dropped';
  confirmations?: number;
  createdAt: Date;
  confirmedAt?: Date;
  metadata?: any;
  notes?: string;
  tags?: string[];
}

/**
 * Transaction filters
 */
export interface TransactionFilters {
  userAddress?: string;
  txType?: TransactionRecord['txType'];
  status?: TransactionRecord['status'];
  tokenSymbol?: string;
  fromDate?: Date;
  toDate?: Date;
  minAmount?: string;
  maxAmount?: string;
  sortBy?: 'date' | 'amount' | 'status';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * Transaction statistics
 */
export interface TransactionStats {
  totalTransactions: number;
  totalVolume: string;
  pendingCount: number;
  failedCount: number;
  averageGasPrice: string;
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
  
  constructor(apiEndpoint?: string) {
    this.apiEndpoint = apiEndpoint || '/api/wallet';
  }
  
  /**
   * Store a new transaction
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
   */
  async getTransaction(txHash: string): Promise<TransactionRecord | null> {
    const response = await fetch(`${this.apiEndpoint}/transactions/${txHash}`);
    
    if (response.status === 404) {
      return null;
    }
    
    if (!response.ok) {
      throw new Error(`Failed to get transaction: ${response.statusText}`);
    }
    
    const data = await response.json();
    return this.mapToTransactionRecord(data);
  }
  
  /**
   * Get user's transaction history
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
    
    if (filters) {
      if (filters.txType) params.set('type', filters.txType);
      if (filters.status) params.set('status', filters.status);
      if (filters.tokenSymbol) params.set('token', filters.tokenSymbol);
      if (filters.fromDate) params.set('from_date', filters.fromDate.toISOString());
      if (filters.toDate) params.set('to_date', filters.toDate.toISOString());
      if (filters.minAmount) params.set('min_amount', filters.minAmount);
      if (filters.maxAmount) params.set('max_amount', filters.maxAmount);
      if (filters.sortBy) params.set('sort_by', filters.sortBy);
      if (filters.sortOrder) params.set('sort_order', filters.sortOrder);
      params.set('limit', (filters.limit || 50).toString());
      params.set('offset', (filters.offset || 0).toString());
    }
    
    const response = await fetch(`${this.apiEndpoint}/transactions?${params}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get transactions: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return {
      transactions: data.transactions.map((t: any) => this.mapToTransactionRecord(t)),
      total: data.total
    };
  }
  
  /**
   * Get transaction statistics for a user
   */
  async getUserStats(userAddress: string): Promise<TransactionStats> {
    const response = await fetch(`${this.apiEndpoint}/transactions/stats?user=${userAddress}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get statistics: ${response.statusText}`);
    }
    
    return await response.json();
  }
  
  /**
   * Add a note to a transaction
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
   */
  async getPendingTransactions(userAddress?: string): Promise<TransactionRecord[]> {
    const params = new URLSearchParams();
    params.set('status', 'pending');
    if (userAddress) params.set('user', userAddress);
    
    const response = await fetch(`${this.apiEndpoint}/transactions/pending?${params}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get pending transactions: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.map((t: any) => this.mapToTransactionRecord(t));
  }
  
  /**
   * Bulk update transaction confirmations
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
    
    const response = await fetch(`${this.apiEndpoint}/transactions/export?${params}`);
    
    if (!response.ok) {
      throw new Error(`Failed to export transactions: ${response.statusText}`);
    }
    
    return await response.blob();
  }
  
  /**
   * Map database row to TransactionRecord
   */
  private mapToTransactionRecord(row: any): TransactionRecord {
    return {
      id: row.id,
      txHash: row.tx_hash,
      blockNumber: row.block_number,
      blockHash: row.block_hash,
      userAddress: row.user_address,
      txType: row.tx_type,
      fromAddress: row.from_address,
      toAddress: row.to_address,
      contractAddress: row.contract_address,
      amount: row.amount,
      tokenAddress: row.token_address,
      tokenSymbol: row.token_symbol,
      tokenDecimals: row.token_decimals,
      gasUsed: row.gas_used,
      gasPrice: row.gas_price,
      txFee: row.tx_fee,
      status: row.status,
      confirmations: row.confirmations,
      createdAt: new Date(row.created_at),
      confirmedAt: row.confirmed_at ? new Date(row.confirmed_at) : undefined,
      metadata: row.metadata,
      notes: row.notes,
      tags: row.tags
    };
  }
  
  /**
   * Check database connectivity
   */
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiEndpoint}/health`);
      return response.ok;
    } catch (error) {
      console.error('Database connection check failed:', error);
      return false;
    }
  }
}