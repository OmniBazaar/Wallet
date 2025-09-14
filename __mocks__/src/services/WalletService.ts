/**
 * Mock WalletService for testing
 */

export class WalletService {
  private initialized = false;
  private wallet: any = null;
  private connected = false;

  async init(): Promise<void> {
    this.initialized = true;
    this.wallet = {}; // Mock wallet object
  }

  isServiceInitialized(): boolean {
    return this.initialized;
  }

  getWallet(): any {
    return this.wallet;
  }

  async getCurrentAddress(): Promise<string | null> {
    return null;
  }

  async getBalance(address?: string): Promise<bigint> {
    return BigInt(1000000000000000000); // 1 ETH
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async cleanup(): Promise<void> {
    this.initialized = false;
    this.wallet = null;
    this.connected = false;
  }

  async getAddress(): Promise<string> {
    return '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  }

  async getChainId(): Promise<number> {
    return 1;
  }

  async switchChain(chainId: number): Promise<void> {
    // Mock implementation that throws for invalid chains
    const validChains = [1, 137, 42161, 10, 8453]; // Ethereum, Polygon, Arbitrum, Optimism, Base
    if (!validChains.includes(chainId)) {
      throw new Error(`Chain ${chainId} not configured`);
    }
  }

  isWalletConnected(): boolean {
    return this.connected && this.wallet !== null;
  }

  getTransactionService(): any {
    return {
      estimateGas: async () => BigInt(21000),
      signTransaction: async () => '0x' + '1'.repeat(130),
      sendTransaction: async (tx: any) => {
        if (!tx.to || tx.to === '') {
          throw new Error('Transaction recipient is required');
        }
        if (tx.value && BigInt(tx.value) > BigInt('1000000000000000000000')) {
          throw new Error('Insufficient funds');
        }
        return {
          hash: '0x' + '1'.repeat(64),
          from: await this.getAddress(),
          to: tx.to,
          value: tx.value || BigInt(0)
        };
      }
    };
  }

  getNFTService(): any {
    return {
      initialize: async () => {},
      getUserNFTs: async () => [],
      discoverNFTs: async () => {},
      clearCache: async () => {}
    };
  }

  clearCache(): Promise<void> {
    return Promise.resolve();
  }

  async getAccounts(): Promise<any[]> {
    return [];
  }
}