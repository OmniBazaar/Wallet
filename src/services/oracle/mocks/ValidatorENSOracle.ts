/**
 * Mock Validator ENS Oracle
 * Local implementation to avoid cross-module dependencies during testing
 */

/**
 * Mock ENS registration data
 */
interface ENSRegistration {
  name: string;
  address: string;
  resolver: string;
  registeredAt: number;
  expiresAt: number;
}

/**
 * Mock Validator ENS Oracle implementation for testing
 */
export class ValidatorENSOracle {
  private registrations: Map<string, ENSRegistration> = new Map();
  private reverseResolutions: Map<string, string> = new Map();

  /**
   * Creates a new ValidatorENSOracle instance
   * @param _merkleEngine - Merkle engine instance (ignored in mock)
   */
  constructor(_merkleEngine?: unknown) {
    // Mock constructor - merkleEngine parameter ignored
  }

  /**
   * Start the ENS oracle service
   * @returns Promise that resolves when service is started
   */
  async start(): Promise<void> {
    // Mock start - nothing to do
    return Promise.resolve();
  }

  /**
   * Resolve ENS name to address
   * @param name - ENS name to resolve
   * @returns Promise resolving to address or null
   */
  async resolve(name: string): Promise<string | null> {
    const registration = this.registrations.get(name);
    return Promise.resolve(registration?.address ?? null);
  }

  /**
   * Reverse resolve address to ENS name
   * @param address - Address to resolve
   * @returns Promise resolving to ENS name or null
   */
  async reverseResolve(address: string): Promise<string | null> {
    return Promise.resolve(this.reverseResolutions.get(address) ?? null);
  }

  /**
   * Check if ENS name is available
   * @param name - ENS name to check
   * @returns Promise resolving to availability status
   */
  async isAvailable(name: string): Promise<boolean> {
    return Promise.resolve(!this.registrations.has(name));
  }

  /**
   * Get ENS metadata
   * @param name - ENS name
   * @returns Promise resolving to ENS metadata
   */
  async getMetadata(name: string): Promise<{
    owner: string;
    resolver: string;
    registeredAt: number;
    expiresAt: number;
  } | null> {
    const registration = this.registrations.get(name);
    if (registration === undefined) {
      return Promise.resolve(null);
    }

    return Promise.resolve({
      owner: registration.address,
      resolver: registration.resolver,
      registeredAt: registration.registeredAt,
      expiresAt: registration.expiresAt
    });
  }

  /**
   * Register ENS name
   * @param name - ENS name to register
   * @param address - Address to register to
   * @param duration - Registration duration in seconds
   * @returns Promise resolving to registration result
   */
  async register(
    name: string,
    address: string,
    duration: number
  ): Promise<{
    success: boolean;
    transactionHash?: string;
    expiresAt?: number;
  }> {
    if (this.registrations.has(name)) {
      return Promise.resolve({ success: false });
    }

    const now = Date.now();
    const expiresAt = now + duration * 1000;

    const registration: ENSRegistration = {
      name,
      address,
      resolver: '0x' + '2'.repeat(40),
      registeredAt: now,
      expiresAt
    };

    this.registrations.set(name, registration);
    this.reverseResolutions.set(address, name);

    return Promise.resolve({
      success: true,
      transactionHash: '0x' + '3'.repeat(64),
      expiresAt
    });
  }
}