/**
 * Type definitions for hdkey module
 */
declare module 'hdkey' {
  /**
   * HDKey class for hierarchical deterministic key derivation
   */
  class HDKey {
    publicKey: Buffer;
    chainCode: Buffer;
    constructor();
    derive(path: string): HDKey;
  }
  
  export = HDKey;
}