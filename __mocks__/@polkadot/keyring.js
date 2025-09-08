// Mock for @polkadot/keyring in Jest environment
module.exports = {
  Keyring: class MockKeyring {
    constructor(options = {}) {
      this.options = options;
    }
    
    addFromUri(uri, meta = {}) {
      return {
        address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        publicKey: '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
        sign: jest.fn(() => ({ signature: '0x123456' }))
      };
    }
    
    addFromMnemonic(mnemonic, meta = {}) {
      return this.addFromUri(mnemonic, meta);
    }
  }
};