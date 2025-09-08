// Mock for @polkadot/api in Jest environment
module.exports = {
  ApiPromise: class MockApiPromise {
    static create() {
      return Promise.resolve(new MockApiPromise());
    }
    
    async connect() {
      return this;
    }
    
    async disconnect() {
      return true;
    }
    
    get isConnected() {
      return true;
    }
    
    get isReady() {
      return Promise.resolve(true);
    }
  },
  
  WsProvider: class MockWsProvider {
    constructor(endpoint) {
      this.endpoint = endpoint;
    }
    
    async connect() {
      return true;
    }
    
    async disconnect() {
      return true;
    }
    
    get isConnected() {
      return true;
    }
  }
};