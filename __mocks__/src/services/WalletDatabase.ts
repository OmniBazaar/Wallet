/**
 * Mock WalletDatabase for testing
 */

export interface WalletAccountData {
  id: string;
  address: string;
  name: string;
  type: 'imported' | 'generated' | 'hardware';
  chainId: number;
  publicKey?: string;
  derivationPath?: string;
  createdAt: number;
  lastAccessedAt: number;
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

export class WalletDatabase {
  private wallets: Map<string, WalletAccountData> = new Map();
  private isInitialized = false;

  async init(): Promise<void> {
    this.isInitialized = true;
  }

  async saveWallet(wallet: Partial<WalletAccountData> & { address: string }): Promise<boolean> {
    const walletData: WalletAccountData = {
      id: wallet.address,
      address: wallet.address,
      name: wallet.name || 'Wallet',
      type: 'imported',
      chainId: 1,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      isActive: true,
      ...wallet
    };

    this.wallets.set(wallet.address, walletData);
    return true;
  }

  async getWallet(address: string): Promise<WalletAccountData | null> {
    const wallet = this.wallets.get(address);
    // Return null instead of undefined when wallet not found
    return wallet || null;
  }

  async deleteWallet(address: string): Promise<boolean> {
    return this.wallets.delete(address);
  }

  async close(): Promise<void> {
    this.wallets.clear();
    this.isInitialized = false;
  }

  async clearAll(): Promise<boolean> {
    this.wallets.clear();
    return true;
  }

  async clear(): Promise<boolean> {
    return this.clearAll();
  }
}