/**
 * Mock Master Merkle Engine
 * Local implementation to avoid cross-module dependencies during testing
 */

/**
 * Mock Master Merkle Engine implementation for testing
 */
export class MasterMerkleEngine {
  private merkleTree: Map<string, any> = new Map();

  /**
   * Initialize the merkle engine
   * @returns Promise that resolves when initialization is complete
   */
  async init(): Promise<void> {
    // Mock initialization
    return Promise.resolve();
  }

  /**
   * Add data to the merkle tree
   * @param key - Data key
   * @param value - Data value
   * @returns Promise that resolves when data is added
   */
  async addData(key: string, value: any): Promise<void> {
    this.merkleTree.set(key, value);
    return Promise.resolve();
  }

  /**
   * Get data from the merkle tree
   * @param key - Data key
   * @returns Promise resolving to data value
   */
  async getData(key: string): Promise<any> {
    return Promise.resolve(this.merkleTree.get(key));
  }

  /**
   * Get merkle root
   * @returns Promise resolving to merkle root hash
   */
  async getMerkleRoot(): Promise<string> {
    // Return mock merkle root
    return Promise.resolve('0x' + '1'.repeat(64));
  }

  /**
   * Verify merkle proof
   * @param key - Data key
   * @param proof - Merkle proof
   * @returns Promise resolving to verification result
   */
  async verifyProof(key: string, proof: string[]): Promise<boolean> {
    // Mock verification - always return true
    return Promise.resolve(true);
  }
}