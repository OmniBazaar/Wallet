/**
 * TypeScript mock for @solana/web3.js in Jest environment
 * Provides a working implementation for tests
 */

export class PublicKey {
  private _value: string;
  
  constructor(value: string | number | Buffer | Uint8Array | number[] | PublicKey) {
    if (typeof value === 'string') {
      this._value = value;
    } else if (value instanceof PublicKey) {
      this._value = value._value;
    } else if (value instanceof Uint8Array || Array.isArray(value)) {
      // Simple base58 encoding simulation
      this._value = Buffer.from(value as any).toString('base64').replace(/=/g, '');
    } else {
      this._value = '11111111111111111111111111111111';
    }
  }
  
  toString(): string {
    return this._value;
  }
  
  toBase58(): string {
    return this._value;
  }
  
  toBuffer(): Buffer {
    return Buffer.from(this._value, 'base64');
  }
  
  equals(other: PublicKey | string): boolean {
    const otherKey = other instanceof PublicKey ? other._value : other;
    return this._value === otherKey;
  }
  
  static isOnCurve(publicKey: Uint8Array): boolean {
    return true;
  }
}

export class Connection {
  private endpoint: string;
  commitment: string;
  
  constructor(endpoint: string, config?: any) {
    this.endpoint = endpoint;
    this.commitment = config?.commitment || 'confirmed';
  }
  
  async getBalance(publicKey: PublicKey): Promise<number> {
    // Return 1 SOL in lamports for test addresses
    if (publicKey.toString() === 'So11111111111111111111111111111111111111112') {
      return 1000000000; // 1 SOL
    }
    return 0;
  }
  
  async getLatestBlockhash(commitment?: string): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
    return {
      blockhash: '4sGjkUTAcXJUGVErJgqe2dGfEJKhSgYXTGKrJQgHREeN',
      lastValidBlockHeight: 150000000
    };
  }
  
  async getFeeForMessage(message: any, commitment?: string): Promise<{ value: number | null; context: any }> {
    return {
      value: 5000, // 0.000005 SOL
      context: { slot: 150000000 }
    };
  }
  
  async getParsedTokenAccountsByOwner(owner: PublicKey, filter: any): Promise<{ value: any[] }> {
    // Return empty array for most addresses
    if (owner.toString() === 'EeUbpqJpArkBmu5uNRiP3EGZRaVpLkY4bfaUPMYYJXHx') {
      return { value: [] };
    }
    
    // Return sample token for test address
    return {
      value: [{
        pubkey: new PublicKey('TokenAccountAddress123'),
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
          owner: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
          rentEpoch: 350
        }
      }]
    };
  }
  
  async sendRawTransaction(serializedTransaction: Uint8Array, options?: any): Promise<string> {
    return '4vJ9JU1p5wPQZ2XqPY3jYnCNsGkYXTGKrJQgHREeN8YHSqY7m8nLjZjUQAv1ksWU';
  }
  
  async confirmTransaction(signature: string, commitment?: string): Promise<any> {
    return {
      value: { err: null },
      context: { slot: 150000000 }
    };
  }
  
  async getSignaturesForAddress(address: PublicKey, options?: any): Promise<any[]> {
    return [{
      signature: 'mockedSignature123',
      slot: 150000000,
      err: null,
      memo: null,
      blockTime: 1640000000
    }];
  }
  
  async getParsedTransaction(signature: string, options?: any): Promise<any> {
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
            { pubkey: new PublicKey('11111111111111111111111111111111'), signer: true, writable: true },
            { pubkey: new PublicKey('22222222222222222222222222222222'), signer: false, writable: true }
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
            programId: new PublicKey('11111111111111111111111111111111')
          }],
          recentBlockhash: '4sGjkUTAcXJUGVErJgqe2dGfEJKhSgYXTGKrJQgHREeN'
        },
        signatures: ['mockedSignature123']
      }
    };
  }
  
  onSlotChange(callback: (slotInfo: any) => void): number {
    const intervalId = setInterval(() => {
      callback({ slot: Date.now() });
    }, 1000) as any;
    return intervalId as any;
  }
  
  removeSlotChangeListener(subscriptionId: number): void {
    clearInterval(subscriptionId as any);
  }
  
  async getMinimumBalanceForRentExemption(dataLength: number): Promise<number> {
    return 890880 + dataLength * 6960;
  }
  
  async requestAirdrop(publicKey: PublicKey, lamports: number): Promise<string> {
    return 'airdropSignature' + Date.now();
  }
}

export class Keypair {
  publicKey: PublicKey;
  secretKey: Uint8Array;
  
  constructor(keypair?: { publicKey: PublicKey; secretKey: Uint8Array }) {
    if (keypair) {
      this.publicKey = keypair.publicKey;
      this.secretKey = keypair.secretKey;
    } else {
      this.publicKey = new PublicKey('11111111111111111111111111111111');
      this.secretKey = new Uint8Array(64);
    }
  }
  
  static generate(): Keypair {
    return new Keypair();
  }
  
  static fromSecretKey(secretKey: Uint8Array): Keypair {
    const keypair = new Keypair();
    keypair.secretKey = secretKey;
    // Simplified - in reality would derive from secret key
    const pubkeyBytes = secretKey.slice(32);
    keypair.publicKey = new PublicKey(pubkeyBytes);
    return keypair;
  }
  
}

export class Transaction {
  instructions: any[] = [];
  signatures: any[] = [];
  recentBlockhash: string | null = null;
  feePayer: PublicKey | null = null;
  
  add(instruction: any): Transaction {
    this.instructions.push(instruction);
    return this;
  }
  
  sign(...signers: Keypair[]): void {
    signers.forEach(signer => {
      this.signatures.push({
        signature: Buffer.alloc(64),
        publicKey: signer.publicKey
      });
    });
  }
  
  serialize(): Uint8Array {
    return new Uint8Array(Buffer.from('mockedSerializedTransaction'));
  }
  
  compileMessage(): any {
    return {
      header: {
        numRequiredSignatures: 1,
        numReadonlySignedAccounts: 0,
        numReadonlyUnsignedAccounts: 1
      },
      accountKeys: this.instructions.flatMap((i: any) => i.keys?.map((k: any) => k.pubkey) || []),
      recentBlockhash: this.recentBlockhash || '11111111111111111111111111111111',
      instructions: this.instructions
    };
  }
  
  static from(buffer: Uint8Array | Buffer | number[]): Transaction {
    return new Transaction();
  }
}

export const SystemProgram = {
  transfer: (params: { fromPubkey: PublicKey; toPubkey: PublicKey; lamports: number }) => ({
    keys: [
      { pubkey: params.fromPubkey, isSigner: true, isWritable: true },
      { pubkey: params.toPubkey, isSigner: false, isWritable: true }
    ],
    programId: new PublicKey('11111111111111111111111111111111'),
    data: Buffer.from([2, 0, 0, 0, ...Buffer.alloc(8)])
  }),
  
  createAccount: (params: any) => ({
    keys: [
      { pubkey: params.fromPubkey, isSigner: true, isWritable: true },
      { pubkey: params.newAccountPubkey, isSigner: true, isWritable: true }
    ],
    programId: new PublicKey('11111111111111111111111111111111'),
    data: Buffer.from([0, 0, 0, 0])
  })
};

export const LAMPORTS_PER_SOL = 1000000000;

export interface ParsedAccountData {
  // Empty interface for type compatibility
}

export interface TokenAccountBalancePair {
  // Empty interface for type compatibility  
}

export async function sendAndConfirmTransaction(
  connection: Connection,
  transaction: Transaction,
  signers: Keypair[],
  options?: any
): Promise<string> {
  transaction.sign(...signers);
  const signature = await connection.sendRawTransaction(transaction.serialize(), options);
  await connection.confirmTransaction(signature, options?.commitment);
  return signature;
}