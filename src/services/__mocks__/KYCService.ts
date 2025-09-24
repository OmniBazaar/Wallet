/**
 * Mock KYCService for testing
 */

import { jest } from '@jest/globals';
import { ethers } from 'ethers';

export interface KYCResult {
  verified: boolean;
  level: number;
  timestamp: number;
  verifier: string;
  expiryDate?: number;
}

export enum KYCTier {
  TIER_0 = 0,
  TIER_1 = 1,
  TIER_2 = 2,
  TIER_3 = 3,
  TIER_4 = 4
}

export enum VerificationStatus {
  NOT_STARTED = 'NOT_STARTED',
  PENDING = 'PENDING',
  IN_REVIEW = 'IN_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED'
}

export interface UserKYCData {
  address: string;
  currentTier: KYCTier;
  status: VerificationStatus;
  applicantId?: string;
  tierStatus: {
    tier1: {
      email?: string;
      emailVerified: boolean;
      phone?: string;
      phoneVerified: boolean;
      verifiedAt?: number;
    };
    tier2: {
      documentType?: string;
      documentNumber?: string;
      documentVerified: boolean;
      firstName?: string;
      lastName?: string;
      dateOfBirth?: string;
      nationality?: string;
      verifiedAt?: number;
    };
    tier3: {
      addressVerified: boolean;
      addressLine1?: string;
      addressLine2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
      verifiedAt?: number;
    };
    tier4: {
      companyName?: string;
      companyNumber?: string;
      companyVerified: boolean;
      authorizedSignatory: boolean;
      verifiedAt?: number;
    };
  };
  limits: {
    daily: string;
    monthly: string;
    perTransaction: string;
  };
  lastUpdated: number;
  expiryDate?: number;
}

export interface TierInfo {
  name: string;
  description: string;
  requirements: string[];
  benefits?: string[];
  limits: {
    daily: string;
    monthly: string;
    perTransaction: string;
  };
}

export class KYCService {
  private isInitialized = false;
  private provider: ethers.Provider;

  constructor(provider: ethers.Provider) {
    this.provider = provider;
  }

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async verifyUser(userAddress: string, level: number): Promise<KYCResult> {
    if (!this.isInitialized) {
      throw new Error('KYCService not initialized');
    }

    return {
      verified: true,
      level,
      timestamp: Date.now(),
      verifier: '0xverifier',
      expiryDate: Date.now() + 365 * 24 * 60 * 60 * 1000 // 1 year
    };
  }

  async getKYCStatus(userAddress: string): Promise<KYCResult | null> {
    if (!this.isInitialized) {
      throw new Error('KYCService not initialized');
    }

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

  async revokeKYC(userAddress: string): Promise<{ success: boolean; txHash: string }> {
    if (!this.isInitialized) {
      throw new Error('KYCService not initialized');
    }

    return {
      success: true,
      txHash: '0x' + '4'.repeat(64)
    };
  }

  async getRequiredKYCLevel(operation: string): Promise<number> {
    if (!this.isInitialized) {
      throw new Error('KYCService not initialized');
    }

    const levels: Record<string, number> = {
      'transfer': 1,
      'swap': 1,
      'bridge': 2,
      'stake': 2,
      'borrow': 3,
      'lend': 3
    };

    return levels[operation] || 0;
  }

  async submitKYCDocuments(userAddress: string, documents: any[]): Promise<{ success: boolean; referenceId: string }> {
    if (!this.isInitialized) {
      throw new Error('KYCService not initialized');
    }

    return {
      success: true,
      referenceId: 'KYC_' + Date.now()
    };
  }

  async startVerification(
    address: string,
    targetTier: KYCTier,
    userData?: { email?: string; phone?: string }
  ): Promise<{ success: boolean; verificationUrl?: string; error?: string }> {
    if (!this.isInitialized) {
      throw new Error('KYCService not initialized');
    }

    if (targetTier === KYCTier.TIER_1 && (!userData?.email || !userData?.phone)) {
      return {
        success: false,
        error: 'Email and phone required for Tier 1'
      };
    }

    return {
      success: true,
      verificationUrl: `https://kyc.omnibazaar.com/verify/${address}?tier=${targetTier}`
    };
  }

  async getUserKYCStatus(address: string): Promise<UserKYCData> {
    if (!this.isInitialized) {
      throw new Error('KYCService not initialized');
    }

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

  async verifyTier1Codes(
    address: string,
    email: string,
    emailCode: string,
    phone: string,
    phoneCode: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isInitialized) {
      throw new Error('KYCService not initialized');
    }

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