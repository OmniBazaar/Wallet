// Mock for @coti-io/coti-sdk-typescript in Jest environment
module.exports = {
  CotiSDK: class MockCotiSDK {
    constructor(config) {
      this.config = config;
    }
    
    async initialize() {
      return true;
    }
    
    async getBalance(address) {
      return '1000000000000000000'; // 1 XOM
    }
    
    async convertXOMToPXOM(amount, address) {
      return '0x' + '1'.repeat(64); // Mock transaction hash
    }
    
    async convertPXOMToXOM(amount, address) {
      return '0x' + '2'.repeat(64); // Mock transaction hash
    }
    
    async sendPrivateTransaction(transaction) {
      return '0x' + '3'.repeat(64); // Mock transaction hash
    }
  },
  
  GarbledCircuits: {
    encrypt: jest.fn((data) => 'encrypted_' + data),
    decrypt: jest.fn((encryptedData) => encryptedData.replace('encrypted_', ''))
  },
  
  PrivacyProtocol: {
    createPrivateTransaction: jest.fn(() => ({
      to: '0x742d35Cc6B34C4532E3F4b7c5b4E6b41c2b14BD3',
      value: '1000000000000000000',
      data: '0x',
      privateData: 'encrypted_private_data'
    }))
  }
};