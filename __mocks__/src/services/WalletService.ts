/**
 * Mock WalletService for testing
 */

export class WalletService {
  private initialized = false;

  async init(): Promise<void> {
    this.initialized = true;
  }

  isServiceInitialized(): boolean {
    return this.initialized;
  }

  getWallet(): any {
    return null;
  }

  async getCurrentAddress(): Promise<string | null> {
    return null;
  }

  async getBalance(address: string): Promise<bigint> {
    return BigInt(0);
  }
}