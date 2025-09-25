/**
 * Mock KYCService for testing
 */

import { ethers } from 'ethers';

/**
 * KYC verification result interface
 */
export interface KYCResult {
  /** Whether the user is verified */
  verified: boolean;
  /** KYC verification level (0-4) */
  level: number;
  /** Timestamp when verification occurred */
  timestamp: number;
  /** Address of the verifier */
  verifier: string;
  /** Optional expiry date for verification */
  expiryDate?: number;
}

/**
 * KYC verification tiers
 */
export enum KYCTier {
  /** Unverified user */
  TIER_0 = 0,
  /** Basic verification (email/phone) */
  TIER_1 = 1,
  /** ID verification */
  TIER_2 = 2,
  /** Enhanced verification (address proof) */
  TIER_3 = 3,
  /** Institutional verification */
  TIER_4 = 4
}

/**
 * KYC verification status
 */
export enum VerificationStatus {
  /** Verification not started */
  NOT_STARTED = 'NOT_STARTED',
  /** Verification pending */
  PENDING = 'PENDING',
  /** Under review */
  IN_REVIEW = 'IN_REVIEW',
  /** Approved */
  APPROVED = 'APPROVED',
  /** Rejected */
  REJECTED = 'REJECTED',
  /** Expired */
  EXPIRED = 'EXPIRED'
}

/**
 * User KYC data interface
 */
export interface UserKYCData {
  /** User's wallet address */
  address: string;
  /** Current KYC tier */
  currentTier: KYCTier;
  /** Verification status */
  status: VerificationStatus;
  /** Optional applicant ID from KYC provider */
  applicantId?: string;
  /** Tier-specific verification status */
  tierStatus: {
    /** Tier 1 status */
    tier1: {
      /** User's email */
      email?: string;
      /** Email verification status */
      emailVerified: boolean;
      /** User's phone number */
      phone?: string;
      /** Phone verification status */
      phoneVerified: boolean;
      /** When tier was verified */
      verifiedAt?: number;
    };
    /** Tier 2 status */
    tier2: {
      /** Type of document provided */
      documentType?: string;
      /** Document number */
      documentNumber?: string;
      /** Document verification status */
      documentVerified: boolean;
      /** User's first name */
      firstName?: string;
      /** User's last name */
      lastName?: string;
      /** Date of birth */
      dateOfBirth?: string;
      /** User's nationality */
      nationality?: string;
      /** When tier was verified */
      verifiedAt?: number;
    };
    /** Tier 3 status */
    tier3: {
      /** Address verification status */
      addressVerified: boolean;
      /** Address line 1 */
      addressLine1?: string;
      /** Address line 2 */
      addressLine2?: string;
      /** City */
      city?: string;
      /** State or province */
      state?: string;
      /** Postal code */
      postalCode?: string;
      /** Country */
      country?: string;
      /** When tier was verified */
      verifiedAt?: number;
    };
    /** Tier 4 status */
    tier4: {
      /** Company name */
      companyName?: string;
      /** Company registration number */
      companyNumber?: string;
      /** Company verification status */
      companyVerified: boolean;
      /** Authorized signatory status */
      authorizedSignatory: boolean;
      /** When tier was verified */
      verifiedAt?: number;
    };
  };
  /** Transaction limits based on tier */
  limits: {
    /** Daily limit in USD */
    daily: string;
    /** Monthly limit in USD */
    monthly: string;
    /** Per transaction limit in USD */
    perTransaction: string;
  };
  /** Last update timestamp */
  lastUpdated: number;
  /** Optional expiry date for verification */
  expiryDate?: number;
}

/**
 * KYC tier information interface
 */
export interface TierInfo {
  /** Tier name */
  name: string;
  /** Tier description */
  description: string;
  /** Requirements for this tier */
  requirements: string[];
  /** Optional benefits */
  benefits?: string[];
  /** Transaction limits */
  limits: {
    /** Daily limit in USD */
    daily: string;
    /** Monthly limit in USD */
    monthly: string;
    /** Per transaction limit in USD */
    perTransaction: string;
  };
}

/**
 * Mock KYC Service for testing
 */
export class KYCService {
  private isInitialized = false;
  private provider: ethers.Provider;

  /**
   * Constructor
   * @param provider - Ethereum provider instance
   */
  constructor(provider: ethers.Provider) {
    this.provider = provider;
  }

  /**
   * Initialize the KYC service
   * @returns Promise that resolves when initialized
   */
  async initialize(): Promise<void> {
    this.isInitialized = true;
    await Promise.resolve();
  }

  /**
   * Verify a user's KYC status
   * @param userAddress - User's wallet address
   * @param level - KYC level to verify
   * @returns Promise with KYC result
   */
  async verifyUser(userAddress: string, level: number): Promise<KYCResult> {
    if (!this.isInitialized) {
      throw new Error('KYCService not initialized');
    }

    await Promise.resolve();
    return {
      verified: true,
      level,
      timestamp: Date.now(),
      verifier: '0xverifier',
      expiryDate: Date.now() + 365 * 24 * 60 * 60 * 1000 // 1 year
    };
  }

  /**
   * Get KYC status for a user
   * @param userAddress - User's wallet address
   * @returns Promise with KYC result or null if not found
   */
  async getKYCStatus(userAddress: string): Promise<KYCResult | null> {
    if (!this.isInitialized) {
      throw new Error('KYCService not initialized');
    }

    await Promise.resolve();
    // Return verified status for test addresses
    if (userAddress.startsWith('0x')) {
      return {
        verified: true,
        level: 2,
        timestamp: Date.now() - 86400000, // 1 day ago
        verifier: '0xverifier',
        expiryDate: Date.now() + 364 * 24 * 60 * 60 * 1000
      };
    }

    return null;
  }

  /**
   * Revoke KYC for a user
   * @param _userAddress - User's wallet address (unused in mock)
   * @returns Promise with success status and transaction hash
   */
  async revokeKYC(_userAddress: string): Promise<{ success: boolean; txHash: string }> {
    if (!this.isInitialized) {
      throw new Error('KYCService not initialized');
    }

    await Promise.resolve();
    return {
      success: true,
      txHash: '0x' + '4'.repeat(64)
    };
  }

  /**
   * Get required KYC level for an operation
   * @param operation - Operation name
   * @returns Promise with required KYC level
   */
  async getRequiredKYCLevel(operation: string): Promise<number> {
    if (!this.isInitialized) {
      throw new Error('KYCService not initialized');
    }

    await Promise.resolve();
    const levels: Record<string, number> = {
      'transfer': 1,
      'swap': 1,
      'bridge': 2,
      'stake': 2,
      'borrow': 3,
      'lend': 3
    };

    return levels[operation] ?? 0;
  }

  /**
   * Submit KYC documents for verification
   * @param _userAddress - User's wallet address (unused in mock)
   * @param _documents - Array of documents (unused in mock)
   * @returns Promise with success status and reference ID
   */
  async submitKYCDocuments(
    _userAddress: string,
    _documents: unknown[]
  ): Promise<{ success: boolean; referenceId: string }> {
    if (!this.isInitialized) {
      throw new Error('KYCService not initialized');
    }

    await Promise.resolve();
    return {
      success: true,
      referenceId: 'KYC_' + Date.now()
    };
  }

  /**
   * Start KYC verification process
   * @param address - User's wallet address
   * @param targetTier - Target KYC tier
   * @param userData - Optional user data for tier 1
   * @param userData.email - User's email address
   * @param userData.phone - User's phone number
   * @returns Promise with verification result
   */
  async startVerification(
    address: string,
    targetTier: KYCTier,
    userData?: { email?: string; phone?: string }
  ): Promise<{ success: boolean; verificationUrl?: string; error?: string }> {
    if (!this.isInitialized) {
      throw new Error('KYCService not initialized');
    }

    await Promise.resolve();
    if (targetTier === KYCTier.TIER_1) {
      const emailTrimmed = userData?.email?.trim();
      const phoneTrimmed = userData?.phone?.trim();
      if (emailTrimmed === undefined || emailTrimmed === '' || phoneTrimmed === undefined || phoneTrimmed === '') {
        return {
          success: false,
          error: 'Email and phone required for Tier 1'
        };
      }
    }

    return {
      success: true,
      verificationUrl: `https://kyc.omnibazaar.com/verify/${address}?tier=${targetTier}`
    };
  }

  /**
   * Get user's KYC status and data
   * @param address - User's wallet address
   * @returns Promise with user KYC data
   */
  async getUserKYCStatus(address: string): Promise<UserKYCData> {
    if (!this.isInitialized) {
      throw new Error('KYCService not initialized');
    }

    await Promise.resolve();
    // Return mock KYC data
    return {
      address,
      currentTier: KYCTier.TIER_1,
      status: VerificationStatus.APPROVED,
      applicantId: 'app_' + address.substring(2, 10),
      tierStatus: {
        tier1: {
          email: 'test@example.com',
          emailVerified: true,
          phone: '+1234567890',
          phoneVerified: true,
          verifiedAt: Date.now() - 86400000
        },
        tier2: {
          documentVerified: false
        },
        tier3: {
          addressVerified: false
        },
        tier4: {
          companyVerified: false,
          authorizedSignatory: false
        }
      },
      limits: {
        daily: '100',
        monthly: '1000',
        perTransaction: '50'
      },
      lastUpdated: Date.now(),
      expiryDate: Date.now() + 365 * 86400000
    };
  }

  /**
   * Get tier information
   * @param tier - KYC tier
   * @returns Tier information
   */
  getTierInfo(tier: KYCTier): TierInfo {
    const tierInfoMap: Record<KYCTier, TierInfo> = {
      [KYCTier.TIER_0]: {
        name: 'Unverified',
        description: 'No verification required',
        requirements: [],
        benefits: ['View marketplace', 'Small purchases'],
        limits: { daily: '10', monthly: '100', perTransaction: '5' }
      },
      [KYCTier.TIER_1]: {
        name: 'Basic',
        description: 'Email and phone verification',
        requirements: ['Valid email', 'Phone number'],
        benefits: ['Basic trading', 'Create listings'],
        limits: { daily: '100', monthly: '1000', perTransaction: '50' }
      },
      [KYCTier.TIER_2]: {
        name: 'Verified',
        description: 'Government ID verification',
        requirements: ['Government-issued ID', 'Selfie verification'],
        benefits: ['Increased limits', 'Access to DEX'],
        limits: { daily: '1000', monthly: '10000', perTransaction: '500' }
      },
      [KYCTier.TIER_3]: {
        name: 'Enhanced',
        description: 'Full identity verification',
        requirements: ['ID verification', 'Proof of address'],
        benefits: ['High transaction limits', 'OTC trading'],
        limits: { daily: '10000', monthly: '100000', perTransaction: '5000' }
      },
      [KYCTier.TIER_4]: {
        name: 'Institutional',
        description: 'Business account verification',
        requirements: ['Company registration', 'Authorized signatory'],
        benefits: ['Unlimited transactions', 'API access'],
        limits: { daily: '1000000', monthly: '10000000', perTransaction: '500000' }
      }
    };

    return tierInfoMap[tier];
  }

  /**
   * Verify tier 1 verification codes
   * @param _address - User's wallet address (unused in mock)
   * @param _email - User's email (unused in mock)
   * @param emailCode - Email verification code
   * @param _phone - User's phone (unused in mock)
   * @param phoneCode - Phone verification code
   * @returns Promise with verification result
   */
  async verifyTier1Codes(
    _address: string,
    _email: string,
    emailCode: string,
    _phone: string,
    phoneCode: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isInitialized) {
      throw new Error('KYCService not initialized');
    }

    await Promise.resolve();
    // Mock verification - accept codes '123456' and '654321'
    if (emailCode === '123456' && phoneCode === '654321') {
      return { success: true };
    }

    return {
      success: false,
      error: 'Invalid verification codes'
    };
  }
}