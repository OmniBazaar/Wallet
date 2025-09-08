/**
 * Mock for Bitcoin Live Provider
 */

export class LiveBitcoinProvider {
  network: string;

  constructor(network?: string) {
    this.network = network || 'mainnet';
  }

  async getFormattedBalance(): Promise<string> {
    return '0.001 BTC';
  }

  async sendBitcoin(): Promise<never> {
    throw new Error('Bitcoin transactions not implemented');
  }

  async getAddress(): Promise<string> {
    return '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
  }

  async getBalance(): Promise<number> {
    return 100000; // satoshis
  }

  async getTransactionHistory(): Promise<any[]> {
    return [];
  }
}