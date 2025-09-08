/**
 * Mock for Bitcoin Provider - avoids loading actual bitcoin provider which requires initEccLib
 */

class BitcoinProvider {
  constructor(config) {
    this.networkConfig = config;
    this.isConnected = false;
  }

  async connect() {
    this.isConnected = true;
  }

  async disconnect() {
    this.isConnected = false;
  }

  async getBalance(address) {
    return '1000000'; // 0.01 BTC in satoshis
  }

  async sendTransaction(txRequest) {
    return 'mock-bitcoin-tx-hash';
  }

  async getTransaction(hash) {
    return {
      hash,
      confirmations: 6,
      value: '1000000'
    };
  }

  async estimateFee() {
    return '5000'; // 5000 satoshis
  }
}

module.exports = BitcoinProvider;
module.exports.BitcoinProvider = BitcoinProvider;
module.exports.default = BitcoinProvider;