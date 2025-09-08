/**
 * Mock for Solana Live Provider
 */

class LiveSolanaProvider {
  constructor(network) {
    this.network = network || 'mainnet-beta';
  }

  async getActiveBalance() {
    return '1000000000'; // 1 SOL in lamports
  }

  async getActiveFormattedBalance() {
    return '1.0 SOL';
  }

  async getActiveTokenBalances() {
    return [];
  }

  async sendNativeToken(to, amount) {
    return 'mockTxId';
  }
}

const SOLANA_NETWORKS = {
  'mainnet-beta': { name: 'Solana Mainnet Beta' },
  'testnet': { name: 'Solana Testnet' },
  'devnet': { name: 'Solana Devnet' }
};

module.exports = {
  LiveSolanaProvider,
  SOLANA_NETWORKS
};