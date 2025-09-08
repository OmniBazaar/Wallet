/**
 * Network Recovery Service
 * 
 * Provides resilient network operations with automatic retry logic,
 * fallback providers, and graceful error handling
 */

import { ethers } from 'ethers';

/**
 * Network error types
 */
export enum NetworkErrorType {
  ConnectionTimeout = 'CONNECTION_TIMEOUT',
  RateLimited = 'RATE_LIMITED',
  ServerError = 'SERVER_ERROR',
  InvalidResponse = 'INVALID_RESPONSE',
  NetworkDown = 'NETWORK_DOWN',
  ProviderError = 'PROVIDER_ERROR'
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay in milliseconds */
  initialDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Exponential backoff factor */
  backoffFactor: number;
  /** Timeout for each attempt in milliseconds */
  timeout: number;
}

/**
 * Network operation result
 */
export interface NetworkResult<T> {
  /** Success status */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Error if failed */
  error?: Error;
  /** Number of retry attempts made */
  attempts: number;
  /** Total time taken in milliseconds */
  duration: number;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  timeout: 30000
};

/**
 * Network Recovery Service
 */
export class NetworkRecoveryService {
  private static instance: NetworkRecoveryService;
  private providers: Map<string, ethers.Provider[]> = new Map();
  private currentProviderIndex: Map<string, number> = new Map();
  private networkStatus: Map<string, boolean> = new Map();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): NetworkRecoveryService {
    if (!NetworkRecoveryService.instance) {
      NetworkRecoveryService.instance = new NetworkRecoveryService();
    }
    return NetworkRecoveryService.instance;
  }

  /**
   * Register fallback providers for a network
   * @param network Network name
   * @param providers Array of providers (primary and fallbacks)
   */
  registerProviders(network: string, providers: ethers.Provider[]): void {
    this.providers.set(network, providers);
    this.currentProviderIndex.set(network, 0);
    this.networkStatus.set(network, true);
  }

  /**
   * Execute a network operation with retry logic
   * @param operation The async operation to execute
   * @param config Retry configuration
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<NetworkResult<T>> {
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        // Execute operation with timeout
        const result = await this.withTimeout(operation(), retryConfig.timeout);
        
        return {
          success: true,
          data: result,
          attempts: attempt,
          duration: Date.now() - startTime
        };
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry if it's a non-retryable error
        if (!this.isRetryableError(error)) {
          break;
        }

        // Calculate delay with exponential backoff
        if (attempt < retryConfig.maxRetries) {
          const delay = Math.min(
            retryConfig.initialDelay * Math.pow(retryConfig.backoffFactor, attempt - 1),
            retryConfig.maxDelay
          );
          
          // Add jitter to prevent thundering herd
          const jitter = Math.random() * 0.1 * delay;
          await new Promise(resolve => setTimeout(resolve, delay + jitter));
        }
      }
    }

    return {
      success: false,
      error: lastError,
      attempts: retryConfig.maxRetries,
      duration: Date.now() - startTime
    };
  }

  /**
   * Get the next available provider for a network
   * @param network Network name
   */
  async getNextProvider(network: string): Promise<ethers.Provider | null> {
    const providers = this.providers.get(network);
    if (!providers || providers.length === 0) {
      return null;
    }

    const currentIndex = this.currentProviderIndex.get(network) || 0;
    
    // Try each provider in sequence
    for (let i = 0; i < providers.length; i++) {
      const index = (currentIndex + i) % providers.length;
      const provider = providers[index];
      
      try {
        // Test provider connectivity
        await this.withTimeout(provider.getBlockNumber(), 5000);
        
        // Update current index if we had to switch
        if (i > 0) {
          this.currentProviderIndex.set(network, index);
        }
        
        return provider;
      } catch (error) {
        // Try next provider
        continue;
      }
    }

    // All providers failed
    this.networkStatus.set(network, false);
    return null;
  }

  /**
   * Check if network is available
   * @param network Network name
   */
  isNetworkAvailable(network: string): boolean {
    return this.networkStatus.get(network) || false;
  }

  /**
   * Classify error type
   * @param error Error to classify
   */
  classifyError(error: any): NetworkErrorType {
    const message = error?.message || '';
    const code = error?.code || '';

    if (message.includes('timeout') || code === 'NETWORK_ERROR') {
      return NetworkErrorType.ConnectionTimeout;
    }
    
    if (message.includes('rate limit') || code === 'RATE_LIMIT') {
      return NetworkErrorType.RateLimited;
    }
    
    if (message.includes('server error') || code === 'SERVER_ERROR') {
      return NetworkErrorType.ServerError;
    }
    
    if (message.includes('invalid') && message.includes('response')) {
      return NetworkErrorType.InvalidResponse;
    }
    
    if (message.includes('network') || message.includes('connection')) {
      return NetworkErrorType.NetworkDown;
    }

    return NetworkErrorType.ProviderError;
  }

  /**
   * Check if error is retryable
   * @param error Error to check
   */
  private isRetryableError(error: any): boolean {
    const errorType = this.classifyError(error);
    
    // These errors are typically transient and worth retrying
    const retryableErrors = [
      NetworkErrorType.ConnectionTimeout,
      NetworkErrorType.RateLimited,
      NetworkErrorType.ServerError,
      NetworkErrorType.NetworkDown
    ];

    return retryableErrors.includes(errorType);
  }

  /**
   * Execute operation with timeout
   * @param promise Promise to execute
   * @param timeout Timeout in milliseconds
   */
  private async withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Operation timeout')), timeout)
      )
    ]);
  }

  /**
   * Reset network status
   * @param network Network name
   */
  resetNetworkStatus(network: string): void {
    this.networkStatus.set(network, true);
    this.currentProviderIndex.set(network, 0);
  }
}

/**
 * Export singleton instance
 */
export const networkRecovery = NetworkRecoveryService.getInstance();