// Mock for COTI live provider
class MockLiveCotiProvider {
  constructor() {
    this.provider = {
      getNetwork: () => Promise.resolve({ name: 'coti-testnet', chainId: 13068200 }),
      getBalance: () => Promise.resolve(BigInt('1000000000000000000')),
      send: () => Promise.resolve({ hash: '0x123...abc' })
    };
  }

  getProvider() {
    return this.provider;
  }

  getNetwork() {
    return {
      name: 'coti-testnet',
      chainId: 13068200,
      rpcUrl: 'https://testnet.coti.io/rpc'
    };
  }

  async getBalance(address) {
    return BigInt('1000000000000000000');
  }

  async sendTransaction(transaction) {
    return { hash: '0x123...abc' };
  }
}

const liveCotiProvider = new MockLiveCotiProvider();

module.exports = {
  LiveCotiProvider: MockLiveCotiProvider,
  liveCotiProvider,
  createLiveCotiProvider: () => new MockLiveCotiProvider()
};