// Enhanced mock for @solana/web3.js in Jest environment
// Provides a working implementation for tests

const bs58 = require('bs58');

class MockPublicKey {
  constructor(value) {
    if (typeof value === 'string') {
      this._value = value;
    } else if (value instanceof Uint8Array || Array.isArray(value)) {
      this._value = bs58.encode(value);
    } else if (value && typeof value === 'object' && value._value) {
      this._value = value._value;
    } else {
      this._value = '11111111111111111111111111111111';
    }
  }
  
  toString() {
    return this._value;
  }
  
  toBase58() {
    return this._value;
  }
  
  toBuffer() {
    try {
      return bs58.decode(this._value);
    } catch {
      return Buffer.from(this._value);
    }
  }
  
  equals(other) {
    if (other instanceof MockPublicKey) {
      return this._value === other._value;
    }
    return this._value === other?.toString();
  }
  
  static isOnCurve(publicKeyBytes) {
    return true;
  }
}

class MockConnection {
  constructor(endpoint, commitmentOrConfig) {
    this.endpoint = endpoint;
    this.commitment = typeof commitmentOrConfig === 'string' 
      ? commitmentOrConfig 
      : commitmentOrConfig?.commitment || 'confirmed';
    
    // Simulate connection state
    this._connected = true;
    this._blockhashCache = new Map();
  }
  
  async getBalance(publicKey) {
    // Return 1 SOL in lamports for test addresses
    if (publicKey.toString() === 'So11111111111111111111111111111111111111112') {
      return 1000000000; // 1 SOL
    }
    return 0;
  }
  
  async getLatestBlockhash(commitment) {
    const blockhash = '4sGjkUTAcXJUGVErJgqe2dGfEJKhSgYXTGKrJQgHREeN';
    return {
      blockhash,
      lastValidBlockHeight: 150000000
    };
  }
  
  async getRecentBlockhash(commitment) {
    const result = await this.getLatestBlockhash(commitment);
    return {
      blockhash: result.blockhash,
      feeCalculator: {
        lamportsPerSignature: 5000
      }
    };
  }
  
  async getFeeForMessage(message, commitment) {
    return {
      value: 5000, // 0.000005 SOL
      context: {
        slot: 150000000
      }
    };
  }
  
  async getParsedTokenAccountsByOwner(owner, filter) {
    // Return empty array for most addresses
    if (owner.toString() === 'EeUbpqJpArkBmu5uNRiP3EGZRaVpLkY4bfaUPMYYJXHx') {
      return { value: [] };
    }
    
    // Return sample token for test address
    return {
      value: [{
        pubkey: new MockPublicKey('TokenAccountAddress123'),
        account: {
          data: {
            parsed: {
              info: {
                mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
                owner: owner.toString(),
                tokenAmount: {
                  amount: '1000000',
                  decimals: 6,
                  uiAmount: 1.0,
                  uiAmountString: '1.0'
                }
              },
              type: 'account'
            },
            program: 'spl-token',
            space: 165
          },
          executable: false,
          lamports: 2039280,
          owner: new MockPublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
          rentEpoch: 350
        }
      }]
    };
  }
  
  async sendRawTransaction(serializedTransaction, options) {
    return '4vJ9JU1p5wPQZ2XqPY3jYnCNsGkYXTGKrJQgHREeN8YHSqY7m8nLjZjUQAv1ksWU';
  }
  
  async confirmTransaction(signature, commitment) {
    return {
      value: {
        err: null
      },
      context: {
        slot: 150000000
      }
    };
  }
  
  async getSignaturesForAddress(address, options) {
    return [{
      signature: 'mockedSignature123',
      slot: 150000000,
      err: null,
      memo: null,
      blockTime: 1640000000
    }];
  }
  
  async getParsedTransaction(signature, options) {
    return {
      slot: 150000000,
      blockTime: 1640000000,
      meta: {
        err: null,
        fee: 5000,
        innerInstructions: [],
        logMessages: [],
        postBalances: [999995000, 1000005000],
        postTokenBalances: [],
        preBalances: [1000000000, 1000000000],
        preTokenBalances: [],
        rewards: []
      },
      transaction: {
        message: {
          accountKeys: [
            { pubkey: new MockPublicKey('11111111111111111111111111111111'), signer: true, writable: true },
            { pubkey: new MockPublicKey('22222222222222222222222222222222'), signer: false, writable: true }
          ],
          instructions: [{
            parsed: {
              info: {
                source: '11111111111111111111111111111111',
                destination: '22222222222222222222222222222222',
                lamports: 5000
              },
              type: 'transfer'
            },
            program: 'system',
            programId: new MockPublicKey('11111111111111111111111111111111')
          }],
          recentBlockhash: '4sGjkUTAcXJUGVErJgqe2dGfEJKhSgYXTGKrJQgHREeN'
        },
        signatures: ['mockedSignature123']
      }
    };
  }
  
  onSlotChange(callback) {
    const intervalId = setInterval(() => {
      callback({ slot: Date.now() });
    }, 1000);
    return intervalId;
  }
  
  removeSlotChangeListener(subscriptionId) {
    clearInterval(subscriptionId);
  }
}

class MockKeypair {
  constructor(publicKey, secretKey) {
    this.publicKey = publicKey || new MockPublicKey('11111111111111111111111111111111');
    this.secretKey = secretKey || new Uint8Array(64);
  }
  
  static fromSeed(seed) {
    // Create a deterministic keypair from seed
    const publicKey = new MockPublicKey('So11111111111111111111111111111111111111112');
    const secretKey = new Uint8Array(64);
    return new MockKeypair(publicKey, secretKey);
  }
  
  static generate() {
    return new MockKeypair();
  }
  
  static fromSecretKey(secretKey) {
    const keypair = new MockKeypair();
    keypair.secretKey = secretKey;
    // Derive public key from secret key (simplified)
    const publicKeyBytes = secretKey.slice(32);
    keypair.publicKey = new MockPublicKey(publicKeyBytes);
    return keypair;
  }
  
  static fromSeed(seed) {
    return new MockKeypair();
  }
}

class MockTransaction {
  constructor() {
    this.instructions = [];
    this.signatures = [];
    this.recentBlockhash = null;
    this.feePayer = null;
  }
  
  add(instruction) {
    this.instructions.push(instruction);
    return this;
  }
  
  sign(...signers) {
    signers.forEach(signer => {
      this.signatures.push({
        signature: Buffer.alloc(64),
        publicKey: signer.publicKey
      });
    });
  }
  
  serialize() {
    // Return a mock serialized transaction
    return Buffer.from('mockedSerializedTransaction');
  }
  
  compileMessage() {
    return {
      header: {
        numRequiredSignatures: 1,
        numReadonlySignedAccounts: 0,
        numReadonlyUnsignedAccounts: 1
      },
      accountKeys: this.instructions.flatMap(i => i.keys?.map(k => k.pubkey) || []),
      recentBlockhash: this.recentBlockhash || '11111111111111111111111111111111',
      instructions: this.instructions
    };
  }
  
  static from(buffer) {
    return new MockTransaction();
  }
}

const SystemProgram = {
  transfer: (params) => ({
    keys: [
      { pubkey: params.fromPubkey, isSigner: true, isWritable: true },
      { pubkey: params.toPubkey, isSigner: false, isWritable: true }
    ],
    programId: new MockPublicKey('11111111111111111111111111111111'),
    data: Buffer.from([2, 0, 0, 0, ...Buffer.alloc(8)])
  }),
  
  createAccount: (params) => ({
    keys: [
      { pubkey: params.fromPubkey, isSigner: true, isWritable: true },
      { pubkey: params.newAccountPubkey, isSigner: true, isWritable: true }
    ],
    programId: new MockPublicKey('11111111111111111111111111111111'),
    data: Buffer.from([0, 0, 0, 0])
  })
};

// Mock helper function
async function sendAndConfirmTransaction(connection, transaction, signers, options) {
  transaction.sign(...signers);
  const signature = await connection.sendRawTransaction(transaction.serialize(), options);
  await connection.confirmTransaction(signature, options?.commitment);
  return signature;
}

// Support both CommonJS and ES6 exports
const web3 = {
  Connection: MockConnection,
  PublicKey: MockPublicKey,
  Keypair: MockKeypair,
  Transaction: MockTransaction,
  SystemProgram,
  LAMPORTS_PER_SOL: 1000000000,
  ParsedAccountData: {},
  TokenAccountBalancePair: {},
  sendAndConfirmTransaction
};

// Export for CommonJS
module.exports = web3;

// Also set individual exports for named imports
Object.keys(web3).forEach(key => {
  module.exports[key] = web3[key];
});

// Support default export
module.exports.default = web3;

// ES6 export compatibility
module.exports.__esModule = true;