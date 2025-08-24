/**
 * KYC Service for Wallet
 * 
 * Provides tiered identity verification for users using Sumsub's testnet/sandbox.
 * Enables progressive KYC with increasing transaction limits at higher tiers.
 * 
 * Tiers:
 * - Tier 0: No KYC (limited to viewing and small transactions)
 * - Tier 1: Email + Phone verification (basic trading)
 * - Tier 2: Government ID verification (increased limits)
 * - Tier 3: Enhanced verification with proof of address (full access)
 * - Tier 4: Institutional verification (for business accounts)
 * 
 * Uses Sumsub's free testnet for development and testing.
 * 
 * @module services/KYCService
 */

import { ethers } from 'ethers';
import crypto from 'crypto';

/**
 * KYC verification tiers
 */
export enum KYCTier {
  TIER_0 = 0, // No KYC
  TIER_1 = 1, // Email + Phone
  TIER_2 = 2, // Government ID
  TIER_3 = 3, // Enhanced with address proof
  TIER_4 = 4  // Institutional
}

/**
 * Verification status
 */
export enum VerificationStatus {
  NOT_STARTED = 'NOT_STARTED',
  PENDING = 'PENDING',
  IN_REVIEW = 'IN_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED'
}

/**
 * Document types for verification
 */
export enum DocumentType {
  PASSPORT = 'PASSPORT',
  DRIVERS_LICENSE = 'DRIVERS_LICENSE',
  NATIONAL_ID = 'NATIONAL_ID',
  RESIDENCE_PERMIT = 'RESIDENCE_PERMIT',
  UTILITY_BILL = 'UTILITY_BILL',
  BANK_STATEMENT = 'BANK_STATEMENT',
  COMPANY_REGISTRATION = 'COMPANY_REGISTRATION'
}

/**
 * User KYC data
 */
export interface UserKYCData {
  /** User wallet address */
  address: string;
  /** Current KYC tier */
  currentTier: KYCTier;
  /** Verification status */
  status: VerificationStatus;
  /** Sumsub applicant ID */
  applicantId?: string;
  /** Verification details by tier */
  tierStatus: {
    tier1: {
      email?: string;
      emailVerified: boolean;
      phone?: string;
      phoneVerified: boolean;
      verifiedAt?: number;
    };
    tier2: {
      documentType?: DocumentType;
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
  /** Transaction limits based on tier */
  limits: {
    daily: string; // In XOM
    monthly: string;
    perTransaction: string;
  };
  /** Last update timestamp */
  lastUpdated: number;
  /** Expiry date for verification */
  expiryDate?: number;
}

/**
 * Sumsub webhook event
 */
interface SumsubWebhookEvent {
  type: 'applicantCreated' | 'applicantPending' | 'applicantReviewed' | 'applicantOnHold' | 'applicantReset';
  applicantId: string;
  inspectionId?: string;
  reviewResult?: {
    reviewAnswer: 'GREEN' | 'RED' | 'YELLOW';
    rejectLabels?: string[];
    reviewRejectType?: string;
  };
  applicantType?: string;
  createdAt?: string;
}

/**
 * KYC Service configuration
 */
interface KYCServiceConfig {
  /** Sumsub app token (sandbox for testing) */
  appToken: string;
  /** Sumsub secret key (sandbox for testing) */
  secretKey: string;
  /** Sumsub API URL */
  apiUrl: string;
  /** Webhook secret for signature verification */
  webhookSecret: string;
  /** Is testnet/sandbox mode */
  isTestnet: boolean;
  /** Validator endpoint */
  validatorEndpoint: string;
}

/**
 * KYC Service
 */
export class KYCService {
  private config: KYCServiceConfig;
  private provider: ethers.Provider;
  private userCache = new Map<string, UserKYCData>();
  private accessToken?: string;
  private tokenExpiry?: number;
  
  // Transaction limits by tier (in XOM)
  private readonly TIER_LIMITS = {
    [KYCTier.TIER_0]: {
      daily: '10',
      monthly: '100',
      perTransaction: '5'
    },
    [KYCTier.TIER_1]: {
      daily: '100',
      monthly: '1000',
      perTransaction: '50'
    },
    [KYCTier.TIER_2]: {
      daily: '1000',
      monthly: '10000',
      perTransaction: '500'
    },
    [KYCTier.TIER_3]: {
      daily: '10000',
      monthly: '100000',
      perTransaction: '5000'
    },
    [KYCTier.TIER_4]: {
      daily: '1000000',
      monthly: '10000000',
      perTransaction: '500000'
    }
  };
  
  /**
   *
   * @param provider
   * @param config
   */
  constructor(provider: ethers.Provider, config?: Partial<KYCServiceConfig>) {
    this.provider = provider;
    
    // Default configuration for Sumsub testnet/sandbox
    this.config = {
      appToken: process.env.SUMSUB_APP_TOKEN || 'sbx:test_app_token_omnibazaar',
      secretKey: process.env.SUMSUB_SECRET_KEY || 'test_secret_key_omnibazaar',
      apiUrl: 'https://api.sumsub.com',
      webhookSecret: process.env.SUMSUB_WEBHOOK_SECRET || 'test_webhook_secret',
      isTestnet: true, // Always use testnet for development
      validatorEndpoint: 'http://localhost:3001/api/kyc',
      ...config
    };
  }
  
  /**
   * Initialize the KYC service
   */
  async initialize(): Promise<void> {
    // Get access token for Sumsub API
    await this.refreshAccessToken();
    
    console.log('KYC Service initialized (Sumsub Testnet Mode)');
  }
  
  /**
   * Get user's KYC status
   * @param address
   */
  async getUserKYCStatus(address: string): Promise<UserKYCData> {
    // Check cache
    const cached = this.userCache.get(address);
    if (cached && Date.now() - cached.lastUpdated < 60000) {
      return cached;
    }
    
    try {
      // Fetch from validator
      const response = await fetch(`${this.config.validatorEndpoint}/status/${address}`);
      if (!response.ok) {
        return this.getDefaultKYCData(address);
      }
      
      const data = await response.json();
      const kycData = this.processKYCData(address, data);
      
      // Update cache
      this.userCache.set(address, kycData);
      
      return kycData;
    } catch (error) {
      console.error('Error fetching KYC status:', error);
      return this.getDefaultKYCData(address);
    }
  }
  
  /**
   * Start KYC verification for a tier
   * @param address
   * @param targetTier
   * @param userData
   * @param userData.email
   * @param userData.phone
   * @param userData.firstName
   * @param userData.lastName
   * @param userData.dateOfBirth
   * @param userData.country
   */
  async startVerification(
    address: string,
    targetTier: KYCTier,
    userData?: {
      email?: string;
      phone?: string;
      firstName?: string;
      lastName?: string;
      dateOfBirth?: string;
      country?: string;
    }
  ): Promise<{ success: boolean; verificationUrl?: string; error?: string }> {
    try {
      const currentStatus = await this.getUserKYCStatus(address);
      
      // Check if already at or above target tier
      if (currentStatus.currentTier >= targetTier) {
        return {
          success: false,
          error: 'Already verified at this tier or higher'
        };
      }
      
      // Tier 1: Email and phone verification
      if (targetTier === KYCTier.TIER_1) {
        return this.startTier1Verification(address, userData);
      }
      
      // Tier 2+: Sumsub verification
      if (targetTier >= KYCTier.TIER_2) {
        return this.startSumsubVerification(address, targetTier, userData);
      }
      
      return {
        success: false,
        error: 'Invalid verification tier'
      };
      
    } catch (error) {
      console.error('Error starting verification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Start Tier 1 verification (email + phone)
   * @param address
   * @param userData
   * @param userData.email
   * @param userData.phone
   */
  private async startTier1Verification(
    address: string,
    userData?: { email?: string; phone?: string }
  ): Promise<{ success: boolean; error?: string }> {
    if (!userData?.email || !userData?.phone) {
      return {
        success: false,
        error: 'Email and phone required for Tier 1'
      };
    }
    
    // Send verification codes
    const response = await fetch(`${this.config.validatorEndpoint}/verify/tier1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address,
        email: userData.email,
        phone: userData.phone
      })
    });
    
    if (!response.ok) {
      return {
        success: false,
        error: 'Failed to send verification codes'
      };
    }
    
    return { success: true };
  }
  
  /**
   * Verify Tier 1 codes
   * @param address
   * @param emailCode
   * @param phoneCode
   */
  async verifyTier1Codes(
    address: string,
    emailCode: string,
    phoneCode: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.config.validatorEndpoint}/verify/tier1/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          emailCode,
          phoneCode
        })
      });
      
      if (!response.ok) {
        return {
          success: false,
          error: 'Invalid verification codes'
        };
      }
      
      // Clear cache to force refresh
      this.userCache.delete(address);
      
      return { success: true };
      
    } catch (error) {
      console.error('Error verifying codes:', error);
      return {
        success: false,
        error: 'Verification failed'
      };
    }
  }
  
  /**
   * Start Sumsub verification for Tier 2+
   * @param address
   * @param targetTier
   * @param userData
   */
  private async startSumsubVerification(
    address: string,
    targetTier: KYCTier,
    userData?: any
  ): Promise<{ success: boolean; verificationUrl?: string; error?: string }> {
    try {
      // Ensure we have access token
      await this.ensureAccessToken();
      
      // Create or get applicant
      let applicantId = await this.getApplicantId(address);
      
      if (!applicantId) {
        // Create new applicant
        applicantId = await this.createApplicant(address, userData);
      }
      
      // Generate verification URL
      const verificationUrl = await this.generateVerificationUrl(applicantId, targetTier);
      
      // Update status in validator
      await fetch(`${this.config.validatorEndpoint}/verify/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          applicantId,
          targetTier,
          timestamp: Date.now()
        })
      });
      
      return {
        success: true,
        verificationUrl
      };
      
    } catch (error) {
      console.error('Error starting Sumsub verification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Create Sumsub applicant
   * @param address
   * @param userData
   */
  private async createApplicant(address: string, userData?: any): Promise<string> {
    const response = await fetch(`${this.config.apiUrl}/resources/applicants`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        externalUserId: address,
        type: userData?.companyName ? 'company' : 'individual',
        email: userData?.email,
        phone: userData?.phone,
        fixedInfo: {
          firstName: userData?.firstName,
          lastName: userData?.lastName,
          dob: userData?.dateOfBirth,
          country: userData?.country
        },
        metadata: {
          platform: 'OmniBazaar',
          walletAddress: address,
          testnet: this.config.isTestnet
        }
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to create applicant');
    }
    
    const data = await response.json();
    return data.id;
  }
  
  /**
   * Generate verification URL
   * @param applicantId
   * @param targetTier
   */
  private async generateVerificationUrl(
    applicantId: string,
    targetTier: KYCTier
  ): Promise<string> {
    // Generate access token for WebSDK
    const response = await fetch(
      `${this.config.apiUrl}/resources/accessTokens?userId=${applicantId}&levelName=${this.getLevelName(targetTier)}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to generate access token');
    }
    
    const data = await response.json();
    
    // In production, would use WebSDK URL
    // For testnet, return a mock URL
    if (this.config.isTestnet) {
      return `https://test.sumsub.com/idensic/l/#/sbx_${data.token}`;
    }
    
    return `https://sumsub.com/idensic/l/#/${data.token}`;
  }
  
  /**
   * Handle Sumsub webhook
   * @param event
   * @param signature
   */
  async handleWebhook(
    event: SumsubWebhookEvent,
    signature: string
  ): Promise<void> {
    // Verify webhook signature
    if (!this.verifyWebhookSignature(event, signature)) {
      throw new Error('Invalid webhook signature');
    }
    
    // Process webhook event
    switch (event.type) {
      case 'applicantReviewed':
        await this.handleApplicantReviewed(event);
        break;
      case 'applicantPending':
        await this.handleApplicantPending(event);
        break;
      default:
        console.log('Unhandled webhook event:', event.type);
    }
  }
  
  /**
   * Handle applicant reviewed webhook
   * @param event
   */
  private async handleApplicantReviewed(event: SumsubWebhookEvent): Promise<void> {
    const { applicantId, reviewResult } = event;
    
    // Get user address from applicant ID
    const address = await this.getAddressFromApplicantId(applicantId);
    if (!address) return;
    
    // Update KYC status based on review result
    const status = reviewResult?.reviewAnswer === 'GREEN' 
      ? VerificationStatus.APPROVED 
      : VerificationStatus.REJECTED;
    
    // Update in validator
    await fetch(`${this.config.validatorEndpoint}/webhook/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address,
        applicantId,
        status,
        reviewResult,
        timestamp: Date.now()
      })
    });
    
    // Clear cache
    this.userCache.delete(address);
  }
  
  /**
   * Handle applicant pending webhook
   * @param event
   */
  private async handleApplicantPending(event: SumsubWebhookEvent): Promise<void> {
    const { applicantId } = event;
    
    const address = await this.getAddressFromApplicantId(applicantId);
    if (!address) return;
    
    // Update status to pending
    await fetch(`${this.config.validatorEndpoint}/webhook/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address,
        applicantId,
        status: VerificationStatus.PENDING,
        timestamp: Date.now()
      })
    });
    
    // Clear cache
    this.userCache.delete(address);
  }
  
  /**
   * Check if user meets tier requirements for transaction
   * @param address
   * @param amount
   * @param daily
   * @param monthly
   */
  async checkTransactionAllowed(
    address: string,
    amount: string,
    daily: string,
    monthly: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const kycData = await this.getUserKYCStatus(address);
    const limits = kycData.limits;
    
    // Check per transaction limit
    if (parseFloat(amount) > parseFloat(limits.perTransaction)) {
      return {
        allowed: false,
        reason: `Transaction exceeds limit of ${limits.perTransaction} XOM for your KYC tier`
      };
    }
    
    // Check daily limit
    if (parseFloat(daily) + parseFloat(amount) > parseFloat(limits.daily)) {
      return {
        allowed: false,
        reason: `Would exceed daily limit of ${limits.daily} XOM`
      };
    }
    
    // Check monthly limit
    if (parseFloat(monthly) + parseFloat(amount) > parseFloat(limits.monthly)) {
      return {
        allowed: false,
        reason: `Would exceed monthly limit of ${limits.monthly} XOM`
      };
    }
    
    return { allowed: true };
  }
  
  /**
   * Get KYC tier display information
   * @param tier
   */
  getTierInfo(tier: KYCTier): {
    name: string;
    description: string;
    requirements: string[];
    benefits: string[];
    limits: typeof this.TIER_LIMITS[KYCTier.TIER_0];
  } {
    const tierInfo = {
      [KYCTier.TIER_0]: {
        name: 'Unverified',
        description: 'No verification required',
        requirements: [],
        benefits: ['View marketplace', 'Small purchases'],
        limits: this.TIER_LIMITS[KYCTier.TIER_0]
      },
      [KYCTier.TIER_1]: {
        name: 'Basic',
        description: 'Email and phone verification',
        requirements: ['Valid email', 'Phone number'],
        benefits: ['Basic trading', 'Create listings', 'Participate in chat'],
        limits: this.TIER_LIMITS[KYCTier.TIER_1]
      },
      [KYCTier.TIER_2]: {
        name: 'Verified',
        description: 'Government ID verification',
        requirements: ['Government-issued ID', 'Selfie verification'],
        benefits: ['Increased limits', 'Access to DEX', 'Priority support'],
        limits: this.TIER_LIMITS[KYCTier.TIER_2]
      },
      [KYCTier.TIER_3]: {
        name: 'Enhanced',
        description: 'Full identity verification with address proof',
        requirements: ['ID verification', 'Proof of address', 'Enhanced screening'],
        benefits: ['High transaction limits', 'OTC trading', 'Advanced features'],
        limits: this.TIER_LIMITS[KYCTier.TIER_3]
      },
      [KYCTier.TIER_4]: {
        name: 'Institutional',
        description: 'Business account verification',
        requirements: ['Company registration', 'Authorized signatory', 'Business documents'],
        benefits: ['Unlimited transactions', 'API access', 'Dedicated support'],
        limits: this.TIER_LIMITS[KYCTier.TIER_4]
      }
    };
    
    return tierInfo[tier];
  }
  
  // Helper methods
  
  /**
   * Refresh Sumsub access token
   */
  private async refreshAccessToken(): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.generateSignature(timestamp);
    
    const response = await fetch(`${this.config.apiUrl}/resources/auth/access-token`, {
      method: 'POST',
      headers: {
        'X-App-Token': this.config.appToken,
        'X-App-Access-Sig': signature,
        'X-App-Access-Ts': timestamp.toString()
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to get access token');
    }
    
    const data = await response.json();
    this.accessToken = data.token;
    this.tokenExpiry = Date.now() + (data.expiresIn * 1000);
  }
  
  /**
   * Ensure access token is valid
   */
  private async ensureAccessToken(): Promise<void> {
    if (!this.accessToken || !this.tokenExpiry || Date.now() >= this.tokenExpiry) {
      await this.refreshAccessToken();
    }
  }
  
  /**
   * Generate signature for Sumsub API
   * @param timestamp
   */
  private generateSignature(timestamp: number): string {
    const data = timestamp + this.config.appToken;
    return crypto
      .createHmac('sha256', this.config.secretKey)
      .update(data)
      .digest('hex');
  }
  
  /**
   * Verify webhook signature
   * @param event
   * @param signature
   */
  private verifyWebhookSignature(event: any, signature: string): boolean {
    const payload = JSON.stringify(event);
    const expectedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(payload)
      .digest('hex');
    
    return signature === expectedSignature;
  }
  
  /**
   * Get applicant ID for address
   * @param address
   */
  private async getApplicantId(address: string): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.config.validatorEndpoint}/applicant/${address}`
      );
      
      if (!response.ok) return null;
      
      const data = await response.json();
      return data.applicantId;
    } catch {
      return null;
    }
  }
  
  /**
   * Get address from applicant ID
   * @param applicantId
   */
  private async getAddressFromApplicantId(applicantId: string): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.config.validatorEndpoint}/address/${applicantId}`
      );
      
      if (!response.ok) return null;
      
      const data = await response.json();
      return data.address;
    } catch {
      return null;
    }
  }
  
  /**
   * Get Sumsub level name for tier
   * @param tier
   */
  private getLevelName(tier: KYCTier): string {
    const levelNames = {
      [KYCTier.TIER_1]: 'basic-kyc',
      [KYCTier.TIER_2]: 'identity-verification',
      [KYCTier.TIER_3]: 'enhanced-kyc',
      [KYCTier.TIER_4]: 'institutional-kyc'
    };
    
    return levelNames[tier] || 'basic-kyc';
  }
  
  /**
   * Process KYC data from validator
   * @param address
   * @param data
   */
  private processKYCData(address: string, data: any): UserKYCData {
    return {
      address,
      currentTier: data.currentTier || KYCTier.TIER_0,
      status: data.status || VerificationStatus.NOT_STARTED,
      applicantId: data.applicantId,
      tierStatus: data.tierStatus || this.getDefaultTierStatus(),
      limits: this.TIER_LIMITS[data.currentTier || KYCTier.TIER_0],
      lastUpdated: Date.now(),
      expiryDate: data.expiryDate
    };
  }
  
  /**
   * Get default KYC data
   * @param address
   */
  private getDefaultKYCData(address: string): UserKYCData {
    return {
      address,
      currentTier: KYCTier.TIER_0,
      status: VerificationStatus.NOT_STARTED,
      tierStatus: this.getDefaultTierStatus(),
      limits: this.TIER_LIMITS[KYCTier.TIER_0],
      lastUpdated: Date.now()
    };
  }
  
  /**
   * Get default tier status
   */
  private getDefaultTierStatus(): UserKYCData['tierStatus'] {
    return {
      tier1: {
        emailVerified: false,
        phoneVerified: false
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
    };
  }
}

export default KYCService;