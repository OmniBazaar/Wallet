/**
 * ReputationService - Reputation Service
 * 
 * Provides reputation tracking and scoring operations for wallet addresses.
 * This service manages user reputation scores which are used throughout
 * the OmniBazaar ecosystem for trust and reliability metrics.
 */

/**
 * Interface for reputation data storage
 */
interface ReputationData {
  address: string;
  score: number;
  lastUpdated: number;
}

/**
 * Reputation service for tracking user reputation scores
 * 
 * This service provides methods to retrieve and manage reputation scores
 * for wallet addresses. Reputation scores range from 0-100 where higher
 * scores indicate more trustworthy users.
 */
export class ReputationService {
  /** Flag indicating if the service has been initialized */
  private isInitialized = false;
  
  /** In-memory cache for reputation scores */
  private reputationCache: Map<string, ReputationData> = new Map();
  
  /** Cache expiry time in milliseconds (1 hour) */
  private readonly CACHE_EXPIRY_MS = 60 * 60 * 1000;

  /**
   * Creates a new ReputationService instance
   */
  constructor() {}

  /**
   * Initialize the reputation service
   * 
   * Sets up the service for use. This method is idempotent and can be
   * called multiple times safely.
   * 
   * @returns Promise that resolves when initialization is complete
   * @throws {Error} If initialization fails
   */
  init(): Promise<void> {
    return new Promise((resolve) => {
      if (this.isInitialized) {
        resolve();
        return;
      }
      
      // Perform any async initialization here if needed
      this.isInitialized = true;
      resolve();
    });
  }

  /**
   * Get reputation score for an address
   * 
   * Retrieves the reputation score for a given wallet address. If the score
   * is cached and not expired, it returns the cached value. Otherwise, it
   * fetches a new score.
   * 
   * @param address - Wallet address to get reputation for
   * @returns Promise that resolves to reputation score (0-100)
   * @throws {Error} If address is invalid or score cannot be retrieved
   */
  getReputationScore(address: string): Promise<number> {
    return new Promise((resolve, reject) => {
      // Validate address format
      if (address === '' || typeof address !== 'string' || address.length === 0) {
        reject(new Error('Invalid address provided'));
        return;
      }
      
      // Check cache first
      const cached = this.reputationCache.get(address.toLowerCase());
      if (cached !== undefined && Date.now() - cached.lastUpdated < this.CACHE_EXPIRY_MS) {
        resolve(cached.score);
        return;
      }
      
      // Simulate async operation to fetch reputation score
      // In production, this would make an API call or query blockchain
      setTimeout(() => {
        // Generate deterministic score based on address for consistency
        const hash = this.hashAddress(address);
        const score = Math.floor((hash % 90) + 10); // Score between 10-99
        
        // Cache the result
        this.reputationCache.set(address.toLowerCase(), {
          address: address.toLowerCase(),
          score,
          lastUpdated: Date.now()
        });
        
        resolve(score);
      }, 100);
    });
  }

  /**
   * Clear the reputation cache
   * 
   * Removes all cached reputation scores. This can be useful when
   * refreshing data or freeing memory.
   * 
   * @returns Promise that resolves when cache is cleared
   */
  clearCache(): Promise<void> {
    return new Promise((resolve) => {
      this.reputationCache.clear();
      resolve();
    });
  }

  /**
   * Clean up resources
   * 
   * Releases any resources held by the service and resets its state.
   * This should be called when the service is no longer needed.
   * 
   * @returns Promise that resolves when cleanup is complete
   */
  cleanup(): Promise<void> {
    return new Promise((resolve) => {
      this.reputationCache.clear();
      this.isInitialized = false;
      resolve();
    });
  }
  
  /**
   * Generate a simple hash from address for deterministic score generation
   * 
   * @param address - Wallet address to hash
   * @returns Numeric hash value
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
}