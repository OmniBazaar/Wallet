/**
 * BiometricService - Biometric Authentication Service
 * 
 * Provides biometric authentication capabilities using WebAuthn API,
 * supporting fingerprint, face recognition, and other biometric methods.
 */

/** Biometric authentication types */
export type BiometricType = 'fingerprint' | 'face' | 'voice' | 'iris' | 'palm';

/** Biometric capability information */
export interface BiometricCapability {
  /** Biometric type */
  type: BiometricType;
  /** Whether this type is available */
  available: boolean;
  /** Whether this type is configured */
  configured: boolean;
  /** Display name */
  displayName: string;
  /** Icon or emoji representation */
  icon: string;
}

/** Biometric enrollment options */
export interface BiometricEnrollmentOptions {
  /** User display name */
  displayName: string;
  /** User identifier */
  userId: string;
  /** Challenge for enrollment */
  challenge?: Uint8Array;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Whether to require user verification */
  requireUserVerification?: boolean;
}

/** Biometric authentication options */
export interface BiometricAuthOptions {
  /** Challenge for authentication */
  challenge?: Uint8Array;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Whether to require user verification */
  requireUserVerification?: boolean;
  /** Allowed credential IDs */
  allowedCredentialIds?: Uint8Array[];
}

/** Biometric credential information */
export interface BiometricCredential {
  /** Credential ID */
  id: string;
  /** Raw credential ID */
  rawId: Uint8Array;
  /** Public key */
  publicKey: Uint8Array;
  /** User ID */
  userId: string;
  /** Display name */
  displayName: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last used timestamp */
  lastUsedAt?: number;
  /** Authenticator type */
  authenticatorType: string;
  /** Whether credential is backed up */
  isBackedUp: boolean;
}

/** Authentication result */
export interface BiometricAuthResult {
  /** Success status */
  success: boolean;
  /** Credential used */
  credential?: BiometricCredential;
  /** Authentication signature */
  signature?: Uint8Array;
  /** Challenge that was signed */
  challenge?: Uint8Array;
  /** Error message if failed */
  error?: string;
  /** User verification status */
  userVerified?: boolean;
}

/** Enrollment result */
export interface BiometricEnrollmentResult {
  /** Success status */
  success: boolean;
  /** Created credential */
  credential?: BiometricCredential;
  /** Error message if failed */
  error?: string;
}

/**
 * Biometric authentication service
 */
export class BiometricService {
  private isInitialized = false;
  private credentials: Map<string, BiometricCredential> = new Map();
  private supportedTypes: BiometricType[] = [];

  /**
   * Creates a new BiometricService instance
   */
  constructor() {}

  /**
   * Initialize the biometric service
   * @throws {Error} When initialization fails
   */
  async init(): Promise<void> {
    try {
      if (this.isInitialized) {
        return;
      }

      // Check WebAuthn support
      if (!this.isWebAuthnSupported()) {
        console.warn('WebAuthn not supported in this environment');
      } else {
        // Detect available biometric types
        await this.detectCapabilities();
        
        // Load existing credentials
        await this.loadCredentials();
      }

      this.isInitialized = true;
      // console.log('BiometricService initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to initialize biometric service: ${errorMessage}`);
    }
  }

  /**
   * Check if WebAuthn is supported
   * @returns Support status
   */
  isWebAuthnSupported(): boolean {
    if (typeof window === 'undefined') {
      return false; // Not in browser environment
    }

    return !!(
      window.navigator?.credentials?.create &&
      window.navigator?.credentials?.get &&
      window.PublicKeyCredential
    );
  }

  /**
   * Check if biometric authentication is available
   * @returns Availability status
   */
  async isBiometricAvailable(): Promise<boolean> {
    if (!this.isWebAuthnSupported()) {
      return false;
    }

    try {
      // Check if platform authenticator is available
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch (error) {
      console.warn('Error checking biometric availability:', error);
      return false;
    }
  }

  /**
   * Alias for isBiometricAvailable for backward compatibility
   * @returns Availability status
   */
  async isAvailable(): Promise<boolean> {
    return this.isBiometricAvailable();
  }

  /**
   * Get available biometric capabilities
   * @returns Array of biometric capabilities
   */
  async getCapabilities(): Promise<BiometricCapability[]> {
    const capabilities: BiometricCapability[] = [
      {
        type: 'fingerprint',
        available: await this.isBiometricAvailable(),
        configured: this.hasCredentials(),
        displayName: 'Fingerprint',
        icon: '👆'
      },
      {
        type: 'face',
        available: await this.isBiometricAvailable(),
        configured: this.hasCredentials(),
        displayName: 'Face Recognition',
        icon: '😊'
      }
    ];

    return capabilities.filter(cap => cap.available);
  }

  /**
   * Enroll biometric credential
   * @param options - Enrollment options
   * @returns Enrollment result
   * @throws {Error} When enrollment fails
   */
  async enroll(options: BiometricEnrollmentOptions): Promise<BiometricEnrollmentResult> {
    if (!this.isInitialized) {
      throw new Error('Biometric service not initialized');
    }

    if (!this.isWebAuthnSupported()) {
      return {
        success: false,
        error: 'WebAuthn not supported'
      };
    }

    try {
      const challenge = options.challenge || this.generateChallenge();
      const userId = new TextEncoder().encode(options.userId);

      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: 'OmniWallet',
          id: window.location.hostname
        },
        user: {
          id: userId,
          name: options.userId,
          displayName: options.displayName
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' }, // ES256
          { alg: -257, type: 'public-key' } // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: options.requireUserVerification ? 'required' : 'preferred',
          residentKey: 'preferred'
        },
        timeout: options.timeout || 60000,
        attestation: 'direct'
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions
      }) as PublicKeyCredential;

      if (!credential) {
        return {
          success: false,
          error: 'Failed to create credential'
        };
      }

      // Store credential information
      const biometricCredential: BiometricCredential = {
        id: credential.id,
        rawId: new Uint8Array(credential.rawId),
        publicKey: new Uint8Array((credential.response as AuthenticatorAttestationResponse).getPublicKey()!),
        userId: options.userId,
        displayName: options.displayName,
        createdAt: Date.now(),
        authenticatorType: 'platform',
        isBackedUp: false // Platform authenticators are typically not backed up
      };

      this.credentials.set(credential.id, biometricCredential);
      await this.saveCredentials();

      // console.log('Biometric credential enrolled successfully');
      return {
        success: true,
        credential: biometricCredential
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Biometric enrollment failed:', error);
      return {
        success: false,
        error: `Enrollment failed: ${errorMessage}`
      };
    }
  }

  /**
   * Authenticate using biometric credential
   * @param options - Authentication options
   * @returns Authentication result
   * @throws {Error} When authentication fails
   */
  async authenticate(options: BiometricAuthOptions = {}): Promise<BiometricAuthResult> {
    if (!this.isInitialized) {
      throw new Error('Biometric service not initialized');
    }

    if (!this.isWebAuthnSupported()) {
      return {
        success: false,
        error: 'WebAuthn not supported'
      };
    }

    if (!this.hasCredentials()) {
      return {
        success: false,
        error: 'No biometric credentials enrolled'
      };
    }

    try {
      const challenge = options.challenge || this.generateChallenge();
      
      // Get allowed credential IDs
      const allowCredentials = options.allowedCredentialIds?.map(id => ({
        type: 'public-key' as const,
        id
      })) || Array.from(this.credentials.values()).map(cred => ({
        type: 'public-key' as const,
        id: cred.rawId
      }));

      const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        allowCredentials,
        userVerification: options.requireUserVerification ? 'required' : 'preferred',
        timeout: options.timeout || 60000
      };

      const assertion = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions
      }) as PublicKeyCredential;

      if (!assertion) {
        return {
          success: false,
          error: 'Authentication failed'
        };
      }

      // Find matching credential
      const credential = this.credentials.get(assertion.id);
      if (!credential) {
        return {
          success: false,
          error: 'Unknown credential'
        };
      }

      // Update last used timestamp
      credential.lastUsedAt = Date.now();
      this.credentials.set(credential.id, credential);
      await this.saveCredentials();

      const response = assertion.response as AuthenticatorAssertionResponse;
      
      // console.log('Biometric authentication successful');
      return {
        success: true,
        credential,
        signature: new Uint8Array(response.signature),
        challenge,
        userVerified: response.userHandle !== null
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Biometric authentication failed:', error);
      return {
        success: false,
        error: `Authentication failed: ${errorMessage}`
      };
    }
  }

  /**
   * Get enrolled credentials
   * @returns Array of credentials
   */
  getCredentials(): BiometricCredential[] {
    return Array.from(this.credentials.values());
  }

  /**
   * Remove a biometric credential
   * @param credentialId - Credential ID to remove
   * @returns Success status
   */
  async removeCredential(credentialId: string): Promise<boolean> {
    if (this.credentials.has(credentialId)) {
      this.credentials.delete(credentialId);
      await this.saveCredentials();
      // console.log(`Credential ${credentialId} removed`);
      return true;
    }
    return false;
  }

  /**
   * Check if any credentials are enrolled
   * @returns Credential status
   */
  hasCredentials(): boolean {
    return this.credentials.size > 0;
  }

  /**
   * Clear all biometric credentials
   * @returns Success status
   */
  async clearCredentials(): Promise<boolean> {
    try {
      this.credentials.clear();
      await this.saveCredentials();
      // console.log('All biometric credentials cleared');
      return true;
    } catch (error) {
      console.error('Error clearing credentials:', error);
      return false;
    }
  }

  /**
   * Generate random challenge
   * @private
   */
  private generateChallenge(): Uint8Array {
    const challenge = new Uint8Array(32);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(challenge);
    } else if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
      window.crypto.getRandomValues(challenge);
    } else {
      // Fallback
      for (let i = 0; i < challenge.length; i++) {
        challenge[i] = Math.floor(Math.random() * 256);
      }
    }
    return challenge;
  }

  /**
   * Detect available biometric capabilities
   * @private
   */
  private async detectCapabilities(): Promise<void> {
    try {
      if (await this.isBiometricAvailable()) {
        // Most platform authenticators support fingerprint
        this.supportedTypes.push('fingerprint');
        
        // Some devices support face recognition
        // This is a simplified detection - real implementation would be more sophisticated
        if (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')) {
          this.supportedTypes.push('face');
        }
      }
    } catch (error) {
      console.warn('Error detecting biometric capabilities:', error);
    }
  }

  /**
   * Load credentials from storage
   * @private
   */
  private async loadCredentials(): Promise<void> {
    try {
      const stored = localStorage.getItem('biometric_credentials');
      if (stored) {
        const credentialData = JSON.parse(stored);
        for (const [id, data] of Object.entries(credentialData)) {
          const credential = data as any;
          // Convert base64 back to Uint8Array
          credential.rawId = new Uint8Array(atob(credential.rawIdBase64).split('').map(c => c.charCodeAt(0)));
          credential.publicKey = new Uint8Array(atob(credential.publicKeyBase64).split('').map(c => c.charCodeAt(0)));
          delete credential.rawIdBase64;
          delete credential.publicKeyBase64;
          
          this.credentials.set(id, credential);
        }
      }
    } catch (error) {
      console.warn('Error loading biometric credentials:', error);
    }
  }

  /**
   * Save credentials to storage
   * @private
   */
  private async saveCredentials(): Promise<void> {
    try {
      const credentialData: Record<string, any> = {};
      for (const [id, credential] of this.credentials.entries()) {
        // Convert Uint8Array to base64 for storage
        const storableCredential = {
          ...credential,
          rawIdBase64: btoa(String.fromCharCode(...credential.rawId)),
          publicKeyBase64: btoa(String.fromCharCode(...credential.publicKey))
        };
        delete (storableCredential as any).rawId;
        delete (storableCredential as any).publicKey;
        
        credentialData[id] = storableCredential;
      }
      localStorage.setItem('biometric_credentials', JSON.stringify(credentialData));
    } catch (error) {
      console.warn('Error saving biometric credentials:', error);
    }
  }

  /**
   * Clear cache and reset data
   */
  async clearCache(): Promise<void> {
    // Clear any cached biometric data
    // console.log('BiometricService cache cleared');
  }

  /**
   * Cleanup service and release resources
   */
  async cleanup(): Promise<void> {
    try {
      this.credentials.clear();
      this.supportedTypes = [];
      this.isInitialized = false;
      // console.log('BiometricService cleanup completed');
    } catch (error) {
      console.error('Error during BiometricService cleanup:', error);
    }
  }
}