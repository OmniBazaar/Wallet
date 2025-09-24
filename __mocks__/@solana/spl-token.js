// Mock for @solana/spl-token in Jest environment

// Define PublicKey locally to avoid circular dependency
class PublicKey {
  constructor(value) {
    if (typeof value === 'string') {
      this._value = value;
    } else if (value instanceof Uint8Array || Array.isArray(value)) {
      this._value = require('bs58').encode(value);
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
}

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

async function getAssociatedTokenAddress(mint, owner, allowOwnerOffCurve = false, programId = TOKEN_PROGRAM_ID) {
  // Mock implementation - returns a deterministic address based on mint and owner
  const mockAddress = `ATA-${mint.toString().slice(0, 6)}-${owner.toString().slice(0, 6)}`;
  return new PublicKey(mockAddress.padEnd(44, '1'));
}

function createAssociatedTokenAccountInstruction(
  payer,
  associatedToken,
  owner,
  mint,
  programId = TOKEN_PROGRAM_ID,
  associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID
) {
  return {
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: associatedToken, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false },
      { pubkey: programId, isSigner: false, isWritable: false },
      { pubkey: new MockPublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false },
    ],
    programId: associatedTokenProgramId,
    data: Buffer.alloc(0)
  };
}

function createTransferInstruction(
  source,
  destination,
  owner,
  amount,
  multiSigners = [],
  programId = TOKEN_PROGRAM_ID
) {
  return {
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
      ...multiSigners.map(signer => ({ pubkey: signer, isSigner: true, isWritable: false }))
    ],
    programId,
    data: Buffer.from([3, ...Buffer.alloc(8)]) // Transfer instruction
  };
}

async function getAccount(connection, address, commitment, programId = TOKEN_PROGRAM_ID) {
  // Mock implementation - check if account exists
  const addressStr = address.toString();
  
  // Simulate non-existent accounts for testing
  if (addressStr.includes('ATA-') && addressStr.includes('EPjFWd')) {
    throw new Error('Account not found');
  }
  
  return {
    address,
    mint: new MockPublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    owner: new MockPublicKey('11111111111111111111111111111111'),
    amount: BigInt(1000000),
    delegate: null,
    delegatedAmount: BigInt(0),
    isInitialized: true,
    isFrozen: false,
    isNative: false,
    rentExemptReserve: null,
    closeAuthority: null
  };
}

// Support both CommonJS and ES6 exports
const splToken = {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
};

// Export for CommonJS
module.exports = splToken;

// Also set individual exports for named imports
Object.keys(splToken).forEach(key => {
  module.exports[key] = splToken[key];
});

// Support default export
module.exports.default = splToken;

// ES6 export compatibility
module.exports.__esModule = true;