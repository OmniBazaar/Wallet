/**
 * Mock for Ethereum Live Provider
 */

const { createMockProvider } = require('../../../setup');

class LiveEthereumProvider {
  constructor(network) {
    this.network = network || 'mainnet';
    const baseProvider = createMockProvider('ethereum');
    Object.assign(this, {
      ...baseProvider,
      getFormattedBalance: jest.fn().mockResolvedValue('1.0'),
      sendTransaction: jest.fn().mockResolvedValue({ hash: '0x' + '1'.repeat(64) }),
      switchNetwork: jest.fn().mockResolvedValue(true),
      on: baseProvider.on,
      off: baseProvider.off,
      removeAllListeners: baseProvider.removeAllListeners
    });
  }
}

const ETHEREUM_NETWORKS = {
  mainnet: { chainId: 1, name: 'Ethereum Mainnet' },
  sepolia: { chainId: 11155111, name: 'Sepolia Testnet' }
};

module.exports = {
  LiveEthereumProvider,
  ETHEREUM_NETWORKS
};