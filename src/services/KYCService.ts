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
import * as crypto from 'crypto';

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

/** Simple type for tier limits */
type TierLimit = { daily: string; monthly: string; perTransaction: string };

/**
 * User data for KYC verification
 */
export interface KYCUserData {
  /** User's email address */
  email?: string;
  /** User's phone number */
  phone?: string;
  /** User's first name */
  firstName?: string;
  /** User's last name */
  lastName?: string;
  /** User's date of birth */
  dateOfBirth?: string;
  /** User's country code */
  country?: string;
  /** Company name (for institutional accounts) */
  companyName?: string;
  /** Company registration number */
  companyNumber?: string;
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
 * Raw KYC data from validator
 */
interface RawKYCData {
  currentTier?: number;
  status?: VerificationStatus;
  applicantId?: string;
  tierStatus?: UserKYCData['tierStatus'];
  expiryDate?: number;
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
   * Create a KYC service configured for Sumsub sandbox by default.
   * @param provider Ethers provider (for network context/logging)
   * @param config Optional overrides for tokens, URLs and validator endpoint
   */
  constructor(provider: ethers.Provider, config?: Partial<KYCServiceConfig>) {
    this.provider = provider;
    
    // Default configuration for Sumsub testnet/sandbox
    this.config = {
      appToken: ((process?.env?.['SUMSUB_APP_TOKEN'] !== null && process?.env?.['SUMSUB_APP_TOKEN'] !== undefined && process?.env?.['SUMSUB_APP_TOKEN'].length > 0) ? process.env['SUMSUB_APP_TOKEN'] : 'sbx:test_app_token_omnibazaar'),
      secretKey: ((process?.env?.['SUMSUB_SECRET_KEY'] !== null && process?.env?.['SUMSUB_SECRET_KEY'] !== undefined && process?.env?.['SUMSUB_SECRET_KEY'].length > 0) ? process.env['SUMSUB_SECRET_KEY'] : 'test_secret_key_omnibazaar'),
      apiUrl: 'https://api.sumsub.com',
      webhookSecret: ((process?.env?.['SUMSUB_WEBHOOK_SECRET'] !== null && process?.env?.['SUMSUB_WEBHOOK_SECRET'] !== undefined && process?.env?.['SUMSUB_WEBHOOK_SECRET'].length > 0) ? process.env['SUMSUB_WEBHOOK_SECRET'] : 'test_webhook_secret'),
      isTestnet: true, // Always use testnet for development
      validatorEndpoint: 'http://localhost:3001/api/kyc',
      ...config
    };
  }
  
  /** Initialize by requesting an access token from Sumsub. */
  async initialize(): Promise<void> {
    // Get access token for Sumsub API
    await this.refreshAccessToken();
    
    // console.log('KYC Service initialized (Sumsub Testnet Mode)');
  }
  
  /**
   * Get the user's current KYC status with caching.
   * @param address User wallet address
   * @returns Promise that resolves to user KYC data
   */
  async getUserKYCStatus(address: string): Promise<UserKYCData> {
    // Check cache
    const cached = this.userCache.get(address);
    if (cached !== undefined && Date.now() - cached.lastUpdated < 60000) {
      return cached;
    }
    
    try {
      // Fetch from validator
      const response = await fetch(`${this.config.validatorEndpoint}/status/${address}`);
      if (!response.ok) {
        return this.getDefaultKYCData(address);
      }
      
      const data = await response.json() as RawKYCData;
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
   * @param address - User wallet address
   * @param targetTier - Target KYC tier to achieve
   * @param userData - Optional user data for verification
   * @param userData.email - User's email address
   * @param userData.phone - User's phone number
   * @param userData.firstName - User's first name
   * @param userData.lastName - User's last name
   * @param userData.dateOfBirth - User's date of birth (YYYY-MM-DD)
   * @param userData.country - User's country code (ISO 3166-1 alpha-2)
   * @returns KYC submission result with success status and optional verification URL
   */
  async startVerification(
    address: string,
    targetTier: KYCTier,
    userData?: KYCUserData
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
   * @param address - User's wallet address
   * @param userData - User data containing email and phone
   * @param userData.email - User's email address
   * @param userData.phone - User's phone number
   * @returns Success status with optional error message
   */
  private async startTier1Verification(
    address: string,
    userData?: { email?: string; phone?: string }
  ): Promise<{ success: boolean; verificationUrl?: string; error?: string }> {
    const email = userData?.email;
    const phone = userData?.phone;
    
    if (email === undefined || email === null || email.length === 0 || phone === undefined || phone === null || phone.length === 0) {
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
        email,
        phone
      })
    });
    
    if (!response.ok) {
      return {
        success: false,
        error: 'Failed to send verification codes'
      };
    }

    return {
      success: true,
      verificationUrl: `${this.config.validatorEndpoint}/verify/tier1/confirm?address=${address}`
    };
  }
  
  /**
   * Verify Tier 1 codes
   * @param address - User's wallet address
   * @param emailCode - Verification code sent to email
   * @param phoneCode - Verification code sent to phone
   * @returns Success status with optional error message
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
   * @param address - User's wallet address
   * @param targetTier - Target KYC tier
   * @param userData - User data for creating applicant
   * @returns Success status with verification URL and optional error
   */
  private async startSumsubVerification(
    address: string,
    targetTier: KYCTier,
    userData?: KYCUserData
  ): Promise<{ success: boolean; verificationUrl?: string; error?: string }> {
    try {
      // Ensure we have access token
      await this.ensureAccessToken();
      
      // Create or get applicant
      let applicantId = await this.getApplicantId(address);
      
      if (applicantId === null || applicantId.length === 0) {
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
   * @param address - User's wallet address
   * @param userData - User data for creating applicant
   * @returns Applicant ID
   */
  private async createApplicant(address: string, userData?: KYCUserData): Promise<string> {
    const response = await fetch(`${this.config.apiUrl}/resources/applicants`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        externalUserId: address,
        type: (userData?.companyName !== undefined && userData.companyName !== null && userData.companyName.length > 0) ? 'company' : 'individual',
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
    
    const data = await response.json() as { id: string };
    return data.id;
  }
  
  /**
   * Generate verification URL
   * @param applicantId - Sumsub applicant ID
   * @param targetTier - Target KYC tier for verification
   * @returns Verification URL for WebSDK
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
    
    const data = await response.json() as { token: string };
    
    // In production, would use WebSDK URL
    // For testnet, return a mock URL
    if (this.config.isTestnet) {
      return `https://test.sumsub.com/idensic/l/#/sbx_${data.token}`;
    }
    
    return `https://sumsub.com/idensic/l/#/${data.token}`;
  }
  
  /**
   * Handle Sumsub webhook
   * @param event - Webhook event from Sumsub
   * @param signature - HMAC signature for verification
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
        // console.log('Unhandled webhook event:', event.type);
    }
  }
  
  /**
   * Handle applicant reviewed webhook
   * @param event - Sumsub webhook event for reviewed applicant
   */
  private async handleApplicantReviewed(event: SumsubWebhookEvent): Promise<void> {
    const { applicantId, reviewResult } = event;
    
    // Get user address from applicant ID
    const address = await this.getAddressFromApplicantId(applicantId);
    if (address === null || address.length === 0) return;
    
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
   * @param event - Sumsub webhook event for pending applicant
   */
  private async handleApplicantPending(event: SumsubWebhookEvent): Promise<void> {
    const { applicantId } = event;
    
    const address = await this.getAddressFromApplicantId(applicantId);
    if (address === null || address.length === 0) return;
    
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
   * @param address - User's wallet address
   * @param amount - Transaction amount in XOM
   * @param daily - Current daily spending in XOM
   * @param monthly - Current monthly spending in XOM
   * @returns Allowed status with optional reason if not allowed
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
   * @param tier - KYC tier level
   * @returns Tier information with name, description and requirements
   */
  getTierInfo(tier: KYCTier): {
    name: string;
    description: string;
    requirements: string[];
    benefits: string[];
    limits: TierLimit;
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
    
    const data = await response.json() as { token: string; expiresIn: number };
    this.accessToken = data.token;
    this.tokenExpiry = Date.now() + (data.expiresIn * 1000);
  }
  
  /**
   * Ensure access token is valid
   */
  private async ensureAccessToken(): Promise<void> {
    if (this.accessToken === undefined || this.accessToken.length === 0 || this.tokenExpiry === undefined || this.tokenExpiry === 0 || Date.now() >= this.tokenExpiry) {
      await this.refreshAccessToken();
    }
  }
  
  /**
   * Generate signature for Sumsub API
   * @param timestamp - Unix timestamp for the request
   * @returns HMAC signature
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
   * @param event - Webhook event to verify
   * @param signature - HMAC signature to check
   * @returns True if signature is valid
   */
  private verifyWebhookSignature(event: SumsubWebhookEvent, signature: string): boolean {
    const payload = JSON.stringify(event);
    const expectedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(payload)
      .digest('hex');
    
    return signature === expectedSignature;
  }
  
  /**
   * Get applicant ID for address
   * @param address - User's wallet address
   * @returns Applicant ID or null if not found
   */
  private async getApplicantId(address: string): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.config.validatorEndpoint}/applicant/${address}`
      );
      
      if (!response.ok) return null;
      
      const data = await response.json() as { applicantId?: string };
      return data.applicantId ?? null;
    } catch {
      return null;
    }
  }
  
  /**
   * Get address from applicant ID
   * @param applicantId - Sumsub applicant ID
   * @returns Wallet address or null if not found
   */
  private async getAddressFromApplicantId(applicantId: string): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.config.validatorEndpoint}/address/${applicantId}`
      );
      
      if (!response.ok) return null;
      
      const data = await response.json() as { address?: string };
      return data.address ?? null;
    } catch {
      return null;
    }
  }
  
  /**
   * Get Sumsub level name for tier
   * @param tier - KYC tier
   * @returns Sumsub level name
   */
  private getLevelName(tier: KYCTier): string {
    switch (tier) {
      case KYCTier.TIER_0:
        return 'basic-kyc';
      case KYCTier.TIER_1:
        return 'basic-kyc';
      case KYCTier.TIER_2:
        return 'identity-verification';
      case KYCTier.TIER_3:
        return 'enhanced-kyc';
      case KYCTier.TIER_4:
        return 'institutional-kyc';
      default:
        return 'basic-kyc';
    }
  }
  
  /**
   * Process KYC data from validator
   * @param address - User's wallet address
   * @param data - Raw KYC data from validator
   * @returns Processed user KYC data
   */
  private processKYCData(address: string, data: RawKYCData): UserKYCData {
    return {
      address,
      currentTier: (data.currentTier as KYCTier) ?? KYCTier.TIER_0,
      status: data.status ?? VerificationStatus.NOT_STARTED,
      ...(data.applicantId !== undefined && { applicantId: data.applicantId }),
      tierStatus: data.tierStatus ?? this.getDefaultTierStatus(),
      limits: this.TIER_LIMITS[(data.currentTier as KYCTier) ?? KYCTier.TIER_0],
      lastUpdated: Date.now(),
      ...(data.expiryDate !== undefined && { expiryDate: data.expiryDate })
    };
  }
  
  /**
   * Get default KYC data
   * @param address - User's wallet address
   * @returns Default KYC data for new users
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
   * @returns Default tier status object
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
