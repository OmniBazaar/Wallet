/**
 * Mock for Polkadot Live Provider  
 */

class LivePolkadotProvider {
  constructor(network) {
    this.network = network || 'polkadot';
  }

  async getActiveFormattedBalance() {
    return '1.0 DOT';
  }

  getCurrentNetwork() {
    return { decimals: 10 };
  }

  async sendNativeToken(to, amount) {
    return 'mockTxId';
  }
}

const POLKADOT_NETWORKS = {
  polkadot: { name: 'Polkadot' },
  kusama: { name: 'Kusama' },
  westend: { name: 'Westend' }
};

module.exports = {
  LivePolkadotProvider,
  POLKADOT_NETWORKS
};