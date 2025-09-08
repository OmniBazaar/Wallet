// Mock for OmniCoin live provider
class MockLiveOmniCoinProvider {
  constructor() {
    this.provider = {
      getNetwork: () => Promise.resolve({ name: 'omnicoin-testnet', chainId: 9999 }),
      getBalance: () => Promise.resolve(BigInt('1000000000000000000')),
      send: () => Promise.resolve({ hash: '0x123...abc' })
    };
  }

  getProvider() {
    return this.provider;
  }

  getNetwork() {
    return {
      name: 'omnicoin-testnet',
      chainId: 9999,
      rpcUrl: 'https://omnicoin-testnet.example.com'
    };
  }

  async getBalance(address) {
    return BigInt('1000000000000000000');
  }

  async sendTransaction(transaction) {
    return { hash: '0x123...abc' };
  }
}

const liveOmniCoinProvider = new MockLiveOmniCoinProvider();

module.exports = {
  LiveOmniCoinProvider: MockLiveOmniCoinProvider,
  liveOmniCoinProvider,
  createLiveOmniCoinProvider: () => new MockLiveOmniCoinProvider()
};