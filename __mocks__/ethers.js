// Mock for ethers to avoid dependency issues in tests

const ethers = {
  isAddress: (address) => {
    if (typeof address !== 'string') return false;
    // Basic Ethereum address validation
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  },
  encodeBytes32String: (text) => {
    // Simple mock that returns a hex string
    const bytes = Buffer.from(text.padEnd(32, '\0').slice(0, 32), 'utf8');
    return '0x' + bytes.toString('hex');
  },
  decodeBytes32String: (hex) => {
    // Simple mock that decodes hex to string
    const bytes = Buffer.from(hex.slice(2), 'hex');
    return bytes.toString('utf8').replace(/\0+$/, '');
  },
  id: (text) => {
    // Mock keccak256 hash - returns a consistent 64-char hex string
    const hash = Buffer.from(text).toString('hex');
    return '0x' + (hash + '0'.repeat(64)).slice(0, 64);
  },
  zeroPadValue: (value, length) => {
    // Pad hex value to specified byte length
    const hex = value.startsWith('0x') ? value.slice(2) : value;
    return '0x' + hex.padStart(length * 2, '0');
  },
  Interface: jest.fn().mockImplementation(function MockInterface(abi) {
    this.abi = abi;
    this.encodeFunctionData = jest.fn().mockImplementation((functionName, params) => {
      // Simple mock that returns hex data based on function name
      if (functionName === 'allowance') {
        return '0xdd62ed3e' + '0'.repeat(56); // allowance function selector
      } else if (functionName === 'approve') {
        return '0x095ea7b3' + '0'.repeat(56); // approve function selector
      } else if (functionName === 'transfer') {
        return '0xa9059cbb' + '0'.repeat(56); // transfer function selector
      }
      return '0x' + '0'.repeat(64);
    });
    this.decodeFunctionResult = jest.fn().mockImplementation((functionName, data) => {
      if (functionName === 'allowance') {
        // Return BigInt allowance
        return [BigInt('1000000')];
      }
      return [true]; // Mock successful result
    });
  }),
  formatEther: (wei) => {
    // Convert wei to ether (divide by 10^18)
    const weiValue = typeof wei === 'string' ? BigInt(wei) : BigInt(wei.toString());
    const etherValue = Number(weiValue) / 1e18;
    
    // Format to string with proper decimal places
    let result = etherValue.toString();
    
    // If it's a whole number, add .0
    if (!result.includes('.') && result !== '0') {
      result = result + '.0';
    }
    
    return result;
  },
  parseEther: (ether) => {
    // Convert ether to wei (multiply by 10^18)
    if (!ether && ether !== 0 && ether !== '0') return BigInt('0');
    
    let etherStr = ether.toString();
    if (etherStr === '') return BigInt('0');
    
    // Handle scientific notation like 1e-9
    if (etherStr.includes('e') || etherStr.includes('E')) {
      const etherValue = parseFloat(etherStr);
      if (isNaN(etherValue) || etherValue === 0) return BigInt('0');
      
      // Convert to fixed notation with 18 decimal places
      etherStr = etherValue.toFixed(18);
    }
    
    const decimalIndex = etherStr.indexOf('.');
    
    if (decimalIndex === -1) {
      // No decimal point, simple multiplication
      return BigInt(etherStr) * BigInt('1000000000000000000');
    } else {
      // Handle decimal places
      const wholePart = etherStr.substring(0, decimalIndex) || '0';
      const fractionalPart = etherStr.substring(decimalIndex + 1);
      
      // Pad or truncate fractional part to 18 digits
      const paddedFractional = fractionalPart.padEnd(18, '0').substring(0, 18);
      
      // Remove trailing zeros to avoid BigInt conversion errors
      const trimmedFractional = paddedFractional.replace(/0+$/, '') || '0';
      
      const wholeWei = BigInt(wholePart) * BigInt('1000000000000000000');
      const fractionalWei = BigInt(trimmedFractional) * BigInt('10') ** BigInt(18 - trimmedFractional.length);
      
      return wholeWei + fractionalWei;
    }
  },
  parseUnits: (value, decimals = 18) => {
    // Convert value to smallest unit based on decimals
    try {
      const val = parseFloat(value?.toString() || '0');
      if (isNaN(val)) return BigInt('0');
      const multiplier = Math.pow(10, decimals || 18);
      const result = Math.floor(val * multiplier);
      if (isNaN(result) || !isFinite(result)) return BigInt('0');
      return BigInt(Math.max(0, Math.floor(result)));
    } catch (error) {
      return BigInt('0');
    }
  },
  formatUnits: (wei, decimals = 18) => {
    // Convert smallest unit to human readable based on decimals
    const weiValue = typeof wei === 'string' ? BigInt(wei) : BigInt(wei.toString());
    const divisor = Math.pow(10, decimals || 18);
    const value = Number(weiValue) / divisor;
    return value.toString();
  },
  parseUnits: (value, unit = 18) => {
    // Handle unit names like 'gwei', 'ether', etc.
    let decimals = unit;
    if (typeof unit === 'string') {
      const unitMap = {
        'wei': 0,
        'kwei': 3,
        'mwei': 6,
        'gwei': 9,
        'szabo': 12,
        'finney': 15,
        'ether': 18
      };
      decimals = unitMap[unit.toLowerCase()] || 18;
    }
    
    const multiplier = BigInt(10) ** BigInt(decimals);
    const numValue = parseFloat(value.toString() || '0');
    if (numValue === 0) return BigInt('0');
    
    // Handle decimal values properly
    const parts = numValue.toString().split('.');
    const wholePart = BigInt(parts[0] || '0') * multiplier;
    
    if (parts[1]) {
      const decimalPart = parts[1].padEnd(decimals, '0').slice(0, decimals);
      const decimalValue = BigInt(decimalPart) * multiplier / BigInt(10) ** BigInt(decimalPart.length);
      return wholePart + decimalValue;
    }
    
    return wholePart;
  },
  utils: {
    isAddress: (address) => {
      if (typeof address !== 'string') return false;
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    },
    formatEther: (wei) => '1.0',
    parseEther: (ether) => BigInt('1000000000000000000'),
    parseUnits: (value, decimals = 18) => {
      try {
        const val = parseFloat(value?.toString() || '0');
        if (isNaN(val)) return BigInt('0');
        const multiplier = Math.pow(10, decimals || 18);
        const result = Math.floor(val * multiplier);
        if (isNaN(result) || !isFinite(result)) return BigInt('0');
        return BigInt(Math.max(0, Math.floor(result)));
      } catch (error) {
        return BigInt('0');
      }
    },
    formatUnits: (wei, decimals = 18) => '1.0'
  },
  Contract: class MockContract {
    constructor(address, abi, provider) {
      this.address = address;
      this.abi = abi;
      this.provider = provider;
      
      // Add all the methods that NFT providers use
      this.balanceOf = jest.fn().mockResolvedValue(BigInt('5'));
      this.tokenOfOwnerByIndex = jest.fn().mockResolvedValue(BigInt('123'));
      this.tokenURI = jest.fn().mockResolvedValue('https://api.example.com/token/123');
      this.ownerOf = jest.fn().mockResolvedValue('0x742d35Cc6634C4532E3F4b7c5b4E6b41c2b14BD3');
      this.name = jest.fn().mockResolvedValue('Test Collection');
      this.symbol = jest.fn().mockResolvedValue('TEST');
      this.totalSupply = jest.fn().mockResolvedValue(BigInt('10000'));
      this.balanceOfBatch = jest.fn().mockResolvedValue([BigInt('1'), BigInt('2')]);
      this.uri = jest.fn().mockResolvedValue('https://api.example.com/token/{id}');
    }
  },
  JsonRpcProvider: class MockJsonRpcProvider {
    constructor(url) {
      this.url = url;
    }
    
    async getNetwork() {
      return { name: 'mock', chainId: 1337 };
    }
    
    async getBalance(address) {
      return BigInt('1000000000000000000');
    }
    
    async estimateGas(transaction) {
      return BigInt('21000');
    }
  },
  Wallet: class MockWallet {
    constructor(privateKey, provider) {
      this.privateKey = privateKey;
      this.provider = provider;
      this.address = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
      this.publicKey = '0x04f39fd6e51aad88f6f4ce6ab8827279cfffb92266e94b8a1060e5c4c4e6aa5cbe3f4f5a5ad6b3b8e2f3e8b1e0c6fb8d7a7f8e8f3e6b8e2c3a1b9f8e7d6c5';
      this.signingKey = {
        publicKey: this.publicKey,
        privateKey: this.privateKey
      };
    }
    
    async signTransaction(transaction) {
      // Return a proper hex string for transaction signature
      const hexChars = '0123456789abcdef';
      let result = '0x';
      for (let i = 0; i < 200; i++) {
        result += hexChars[Math.floor(Math.random() * 16)];
      }
      return result;
    }
    
    async signMessage(message) {
      // Return a properly formatted 130-character hex signature (65 bytes)
      return '0x' + '1234567890abcdef'.repeat(8) + '12'; // 128 chars + '0x' = 130 total
    }
    
    connect(provider) {
      return new MockWallet(this.privateKey, provider);
    }
  },
  HDNodeWallet: class MockHDNodeWallet {
    constructor(privateKey, publicKey, address, derivationPath, mnemonic) {
      this.privateKey = privateKey || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      this.publicKey = publicKey || '0x04f39fd6e51aad88f6f4ce6ab8827279cfffb92266e94b8a1060e5c4c4e6aa5cbe3f4f5a5ad6b3b8e2f3e8b1e0c6fb8d7a7f8e8f3e6b8e2c3a1b9f8e7d6c5';
      this.address = address || '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
      this.path = derivationPath || "m/44'/60'/0'/0/0";
      this.chainCode = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
      this.index = 0;
      this.depth = 0;
      this.mnemonic = mnemonic || {
        phrase: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        password: '',
        wordlist: null,
        entropy: '0x' + '00'.repeat(16)
      };
      this.signingKey = {
        publicKey: this.publicKey,
        privateKey: this.privateKey
      };
    }
    
    derivePath(path) {
      // Return new instance with different address for different paths
      const pathParts = path.split('/');
      const index = parseInt(pathParts[pathParts.length - 1]) || 0;
      const addresses = [
        '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
        '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65'
      ];
      const privateKeys = [
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
        '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
        '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
        '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
        '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a'
      ];
      const publicKeys = [
        '0x0427d6e51aad88f6f4ce6ab8827279cfffb92266...',
        '0x0470997970c51812dc3a010c7d01b50e0d17dc79c8...',
        '0x043c44cdddb6a900fa2b585dd299e03d12fa4293bc...',
        '0x0490f79bf6eb2c4f870365e785982e1f101e93b906...',
        '0x0415d34aaf54267db7d7c367839aaf71a00a2c6a65...'
      ];
      
      return new MockHDNodeWallet(
        privateKeys[index % privateKeys.length],
        publicKeys[index % publicKeys.length],
        addresses[index % addresses.length],
        path
      );
    }
    
    async signMessage(message) {
      // Return a properly formatted 130-character hex signature (65 bytes)
      return '0x' + '1234567890abcdef'.repeat(8) + '12';
    }
    
    async signTransaction(transaction) {
      // Return a proper hex string for transaction signature
      const hexChars = '0123456789abcdef';
      let result = '0x';
      for (let i = 0; i < 200; i++) {
        result += hexChars[Math.floor(Math.random() * 16)];
      }
      return result;
    }
    
    static fromMnemonic(mnemonic) {
      const mnemonicObj = {
        phrase: typeof mnemonic === 'string' ? mnemonic : mnemonic.phrase,
        password: '',
        wordlist: null,
        entropy: '0x' + '00'.repeat(16)
      };
      return new MockHDNodeWallet(undefined, undefined, undefined, undefined, mnemonicObj);
    }
    
    static fromPhrase(phrase) {
      const mnemonicObj = {
        phrase: phrase,
        password: '',
        wordlist: null,
        entropy: '0x' + '00'.repeat(16)
      };
      return new MockHDNodeWallet(undefined, undefined, undefined, undefined, mnemonicObj);
    }
  },
  Mnemonic: {
    fromPhrase: (phrase) => ({
      phrase: phrase,
      password: '',
      wordlist: null,
      entropy: '0x' + '00'.repeat(16)
    })
  },
  AbstractSigner: class MockAbstractSigner {
    constructor() {
      this.address = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
    }
    
    async signMessage(message) {
      // Return a properly formatted 130-character hex signature (65 bytes)
      return '0x' + '1234567890abcdef'.repeat(8) + '12'; // 128 chars + '0x' = 130 total
    }
    
    async signTransaction(transaction) {
      // Return a proper hex string for transaction signature
      const hexChars = '0123456789abcdef';
      let result = '0x';
      for (let i = 0; i < 200; i++) {
        result += hexChars[Math.floor(Math.random() * 16)];
      }
      return result;
    }
    
    connect(provider) {
      return new this.constructor();
    }
    
    async getAddress() {
      return this.address;
    }
  },
  getBytes: (value) => {
    if (typeof value === 'string') {
      // Remove 0x prefix if present
      const hex = value.startsWith('0x') ? value.slice(2) : value;
      // Convert hex string to bytes array
      const bytes = [];
      for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
      }
      return new Uint8Array(bytes);
    }
    return new Uint8Array(32); // Default 32 bytes for private keys
  },
  randomBytes: (length) => {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes;
  },
  hexlify: (value) => {
    if (typeof value === 'string' && value.startsWith('0x')) {
      return value; // Already hex
    }
    if (value instanceof Uint8Array || value instanceof Buffer) {
      let hex = '0x';
      for (let i = 0; i < value.length; i++) {
        hex += value[i].toString(16).padStart(2, '0');
      }
      return hex;
    }
    if (typeof value === 'number' || typeof value === 'bigint') {
      return '0x' + value.toString(16);
    }
    return '0x00';
  },
  verifyMessage: (message, signature) => {
    // Mock verification - return a consistent address
    return '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  },
  toBeArray: (value) => {
    if (typeof value === 'string') {
      // Remove 0x prefix if present
      const hex = value.startsWith('0x') ? value.slice(2) : value;
      // Convert hex string to bytes array
      const bytes = [];
      for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
      }
      return new Uint8Array(bytes);
    }
    return new Uint8Array(32); // Default 32 bytes for private keys
  },
  toUtf8Bytes: (str) => {
    return new TextEncoder().encode(str);
  },
  pbkdf2: (password, salt, iterations, keylen, algo) => {
    // Mock pbkdf2 for testing
    // In real implementation this would be a proper key derivation
    const mockKey = Buffer.alloc(keylen);
    for (let i = 0; i < keylen; i++) {
      mockKey[i] = (i + password.length + salt.length) % 256;
    }
    return mockKey;
  },
  keccak256: (data) => {
    // Mock keccak256 hash - return a deterministic mock hash based on input
    let hash = '0x';
    let seed = 0;
    
    if (typeof data === 'string') {
      const input = data.startsWith('0x') ? data.slice(2) : data;
      // Calculate a seed based on the entire input
      for (let i = 0; i < input.length; i++) {
        seed = (seed * 31 + input.charCodeAt(i)) % 0xffffffff;
      }
      // Generate hash based on seed
      for (let i = 0; i < 64; i++) {
        seed = (seed * 1103515245 + 12345) % 0xffffffff; // Linear congruential generator
        hash += (seed % 16).toString(16);
      }
    } else if (data instanceof Uint8Array) {
      // Calculate seed from bytes
      for (let i = 0; i < data.length; i++) {
        seed = (seed * 31 + data[i]) % 0xffffffff;
      }
      // Generate hash based on seed
      for (let i = 0; i < 64; i++) {
        seed = (seed * 1103515245 + 12345) % 0xffffffff;
        hash += (seed % 16).toString(16);
      }
    } else {
      // Default hash
      hash = '0x1234567890abcdef'.repeat(4);
    }
    return hash;
  },
  solidityPacked: (types, values) => {
    // Mock solidityPacked - concatenate hex values
    let result = '0x';
    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      if (typeof value === 'string' && value.startsWith('0x')) {
        result += value.slice(2);
      } else if (typeof value === 'number' || typeof value === 'bigint') {
        result += value.toString(16).padStart(64, '0');
      } else {
        result += value.toString();
      }
    }
    return result;
  },
  MaxUint256: BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
  ZeroAddress: '0x0000000000000000000000000000000000000000',
  BrowserProvider: class MockBrowserProvider {
    constructor(ethereum) {
      this.ethereum = ethereum;
    }
    
    async getNetwork() {
      return { name: 'mock', chainId: 1337 };
    }
  },
  AbiCoder: {
    defaultAbiCoder: () => ({
      encode: (types, values) => {
        // Mock encoding - return deterministic hex based on input
        let encoded = '0x';
        for (let i = 0; i < 64; i++) {
          const charCode = values.length > 0 ? values[0].toString().charCodeAt(i % values[0].toString().length) : 65;
          encoded += ((charCode + i) % 16).toString(16);
        }
        return encoded;
      },
      decode: (types, data) => {
        // Mock decoding - return mock values based on types
        return types.map(() => '0x1234567890123456789012345678901234567890');
      }
    })
  }
};

module.exports = ethers;
module.exports.ethers = ethers;
module.exports.isAddress = ethers.isAddress;
module.exports.formatEther = ethers.formatEther;
module.exports.parseEther = ethers.parseEther;
module.exports.parseUnits = ethers.parseUnits;
module.exports.formatUnits = ethers.formatUnits;
module.exports.utils = ethers.utils;
module.exports.Contract = ethers.Contract;
module.exports.JsonRpcProvider = ethers.JsonRpcProvider;
module.exports.Wallet = ethers.Wallet;
module.exports.HDNodeWallet = ethers.HDNodeWallet;
module.exports.Mnemonic = ethers.Mnemonic;
module.exports.AbstractSigner = ethers.AbstractSigner;
module.exports.getBytes = ethers.getBytes;
module.exports.randomBytes = ethers.randomBytes;
module.exports.hexlify = ethers.hexlify;
module.exports.verifyMessage = ethers.verifyMessage;
module.exports.toBeArray = ethers.toBeArray;
module.exports.toUtf8Bytes = ethers.toUtf8Bytes;
module.exports.MaxUint256 = ethers.MaxUint256;
module.exports.ZeroAddress = ethers.ZeroAddress;
module.exports.BrowserProvider = ethers.BrowserProvider;
module.exports.keccak256 = ethers.keccak256;
module.exports.pbkdf2 = ethers.pbkdf2;
module.exports.encodeBytes32String = ethers.encodeBytes32String;
module.exports.decodeBytes32String = ethers.decodeBytes32String;
module.exports.id = ethers.id;
module.exports.zeroPadValue = ethers.zeroPadValue;
module.exports.Interface = ethers.Interface;
module.exports.solidityPacked = ethers.solidityPacked;
module.exports.AbiCoder = ethers.AbiCoder;