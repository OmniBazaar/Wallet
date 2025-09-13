/**
 * Participation Score Service for OmniBazaar
 * 
 * Implements the actual OmniBazaar participation scoring system as specified in the design.
 * Maximum score: 100 points
 * Components tracked and scored according to specific algorithms.
 * 
 * Score Components:
 * - Referrals: 0-10 points (1 point per referral, max 10)
 * - Publisher Activity: 0-4 points (based on listings published)
 * - Forum Activity: 0-5 points (decaying over time)
 * - Marketplace Activity: 0-5 points (decaying over time)
 * - Community Policing: 0-5 points (decaying over time)
 * - Reliability: -5 to +5 points (as Publisher/Validator/Arbitrator)
 * 
 * @module services/ParticipationService
 */

import { ethers } from 'ethers';
import { OmniValidatorClient, createOmniValidatorClient } from '../../../Validator/dist/client/index';
import { StakingService } from './StakingService';
import { KYCService } from './KYCService';

/**
 * Participation score components
 */
export interface ParticipationComponents {
  /** Referrals made (0-10 points) */
  referrals: {
    count: number;
    points: number; // Max 10
  };
  /** Listings published for others (0-4 points) */
  publishing: {
    listingsPublished: number;
    points: number; // 100/1000/10000/100000 = 1/2/3/4 points
  };
  /** Forum activity (0-5 points) */
  forumActivity: {
    questionsAnswered: number;
    helpfulVotes: number;
    lastActivityDate: number;
    points: number; // Max 5, decays over time
  };
  /** Marketplace transactions (0-5 points) */
  marketplaceActivity: {
    buyTransactions: number;
    sellTransactions: number;
    lastTransactionDate: number;
    points: number; // Max 5, decays over time
  };
  /** Community policing (0-5 points) */
  communityPolicing: {
    reportsSubmitted: number;
    reportsVerified: number;
    lastReportDate: number;
    points: number; // Max 5, decays over time
  };
  /** Reliability score (-5 to +5 points) */
  reliability: {
    successfulValidations: number;
    failedValidations: number;
    disputesAsArbitrator: number;
    disputesResolved: number;
    lastActivityDate: number;
    points: number; // -5 to +5, decays over time
  };
}

/**
 * Participation score summary
 */
export interface ParticipationScore {
  /** User address */
  address: string;
  /** Total score (max 100) */
  totalScore: number;
  /** Individual components */
  components: ParticipationComponents;
  /** Validator qualification status (requires 50+ points) */
  qualifiedAsValidator: boolean;
  /** Listing node qualification status (requires 25+ points) */
  qualifiedAsListingNode: boolean;
  /** Last calculation timestamp */
  lastCalculated: number;
  /** Next decay timestamp */
  nextDecayTime: number;
}

/**
 * Activity decay configuration
 */
interface DecayConfig {
  /** Days before decay starts */
  gracePeriodDays: number;
  /** Points lost per period */
  decayRate: number;
  /** Decay period in days */
  decayPeriodDays: number;
  /** Minimum points after decay */
  minPoints: number;
}

/**
 * API response data structure for participation components
 */
interface ParticipationAPIData {
  referrals?: {
    count?: number;
    points?: number;
  };
  publishing?: {
    listingsPublished?: number;
    points?: number;
  };
  forumActivity?: {
    questionsAnswered?: number;
    helpfulVotes?: number;
    lastActivityDate?: number;
    points?: number;
  };
  marketplaceActivity?: {
    buyTransactions?: number;
    sellTransactions?: number;
    lastTransactionDate?: number;
    points?: number;
  };
  communityPolicing?: {
    reportsSubmitted?: number;
    reportsVerified?: number;
    lastReportDate?: number;
    points?: number;
  };
  reliability?: {
    successfulValidations?: number;
    failedValidations?: number;
    disputesAsArbitrator?: number;
    disputesResolved?: number;
    lastActivityDate?: number;
    points?: number;
  };
}

/**
 * Activity update types
 */
interface ReferralActivity {
  type: 'new_referral';
  referred: string;
}

interface PublishingActivity {
  type: 'listing_published';
  listingId: string;
}

interface ForumActivity {
  type: 'answer' | 'helpful_vote';
  [key: string]: unknown;
}

interface MarketplaceActivity {
  type: 'buy' | 'sell';
  transactionId: string;
}

interface CommunityPolicingActivity {
  type: 'report';
  reportId: string;
  verified: boolean;
}

interface ReliabilityActivity {
  type: 'validation_success' | 'validation_failure' | 'dispute_resolved' | 'dispute_failed';
  [key: string]: unknown;
}

type ActivityUpdate = ReferralActivity | PublishingActivity | ForumActivity | MarketplaceActivity | CommunityPolicingActivity | ReliabilityActivity;

/**
 * Participation Service
 */
export class ParticipationService {
  private provider: ethers.Provider;
  private validatorEndpoint: string;
  private scoreCache = new Map<string, ParticipationScore>();
  private participationScoreService?: ParticipationScoreService;
  private kycService?: KYCService;
  private stakingService?: StakingService;
  private merkleEngine?: MasterMerkleEngine;
  
  // Decay configurations for time-sensitive components
  private readonly DECAY_CONFIGS: Record<string, DecayConfig> = {
    forum: {
      gracePeriodDays: 30,
      decayRate: 0.5,
      decayPeriodDays: 30,
      minPoints: 0
    },
    marketplace: {
      gracePeriodDays: 30,
      decayRate: 0.5,
      decayPeriodDays: 30,
      minPoints: 0
    },
    communityPolicing: {
      gracePeriodDays: 60,
      decayRate: 0.25,
      decayPeriodDays: 30,
      minPoints: 0
    },
    reliability: {
      gracePeriodDays: 90,
      decayRate: 0.25,
      decayPeriodDays: 30,
      minPoints: -5
    }
  };
  
  // Publishing thresholds for points
  private readonly PUBLISHING_THRESHOLDS = [
    { listings: 100, points: 1 },
    { listings: 1000, points: 2 },
    { listings: 10000, points: 3 },
    { listings: 100000, points: 4 }
  ];
  
  /**
   * Create a participation service bound to a provider and validator endpoint.
   * @param provider Ethers provider for on-chain lookups (if needed)
   * @param validatorEndpoint REST endpoint for participation API
   */
  constructor(provider: ethers.Provider, validatorEndpoint?: string) {
    this.provider = provider;
    this.validatorEndpoint = validatorEndpoint ?? 'http://localhost:3001/api/participation';
  }
  
  /** Initialize any resources. */
  async initialize(): Promise<void> {
    try {
      // Initialize services
      this.merkleEngine = new MasterMerkleEngine();
      this.participationScoreService = new ParticipationScoreService(this.merkleEngine);
      this.kycService = new KYCService(this.merkleEngine);
      this.stakingService = new StakingService(this.merkleEngine, this.provider);
      
      // Start services
      await this.participationScoreService.start();
      await this.kycService.start();
      await this.stakingService.start();
    } catch (error) {
      console.error('Failed to initialize ParticipationService:', error);
      throw error;
    }
  }
  
  /**
   * Get or compute the participation score for an address.
   * Uses a 5-minute cache to reduce load.
   * @param address Wallet address
   * @returns Promise that resolves to participation score
   */
  async getScore(address: string): Promise<ParticipationScore> {
    // Check cache
    const cached = this.scoreCache.get(address);
    if (cached !== undefined && Date.now() - cached.lastCalculated < 300000) { // 5 minute cache
      return cached;
    }
    
    try {
      if (this.participationScoreService) {
        // Get score from real service
        const scoreData = await this.participationScoreService.getScore(address);
        
        // Convert to wallet format
        const score: ParticipationScore = {
          address,
          totalScore: scoreData.score,
          components: {
            referrals: {
              count: scoreData.components.referrals || 0,
              points: Math.min(scoreData.components.referrals || 0, 10)
            },
            publishing: {
              listingsPublished: scoreData.components.listingsPublished || 0,
              points: this.calculatePublishingPoints(scoreData.components.listingsPublished || 0)
            },
            forumActivity: {
              questionsAnswered: scoreData.components.forumQuestionsAnswered || 0,
              helpfulVotes: scoreData.components.forumHelpfulVotes || 0,
              lastActivityDate: scoreData.components.lastForumActivity || 0,
              points: scoreData.components.forumParticipation || 0
            },
            marketplaceActivity: {
              buyTransactions: scoreData.components.buyTransactions || 0,
              sellTransactions: scoreData.components.sellTransactions || 0,
              lastTransactionDate: scoreData.components.lastTransaction || 0,
              points: scoreData.components.marketplaceTransactions || 0
            },
            communityPolicing: {
              reportsSubmitted: scoreData.components.reportsSubmitted || 0,
              reportsVerified: scoreData.components.reportsVerified || 0,
              lastReportDate: scoreData.components.lastReport || 0,
              points: scoreData.components.communityModeration || 0
            },
            reliability: {
              successfulValidations: scoreData.components.successfulValidations || 0,
              failedValidations: scoreData.components.failedValidations || 0,
              disputesAsArbitrator: scoreData.components.disputesHandled || 0,
              disputesResolved: scoreData.components.disputesResolved || 0,
              lastActivityDate: scoreData.components.lastValidation || 0,
              points: scoreData.components.reliability || 0
            }
          },
          qualifiedAsValidator: scoreData.score >= 50,
          qualifiedAsListingNode: scoreData.score >= 25,
          lastCalculated: Date.now(),
          nextDecayTime: Date.now() + (24 * 60 * 60 * 1000)
        };
        
        // Update cache
        this.scoreCache.set(address, score);
        return score;
      }
      
      // Fallback to API if service not available
      const response = await fetch(`${this.validatorEndpoint}/score/${address}`);
      if (!response.ok) {
        return this.getDefaultScore(address);
      }
      
      const data = await response.json() as unknown;
      if (!this.isParticipationAPIData(data)) {
        throw new Error('Invalid response data');
      }
      const score = this.calculateScore(address, data);
      
      // Update cache
      this.scoreCache.set(address, score);
      
      return score;
    } catch (error) {
      // Log error internally but return default score
      // In production, this would be logged to a monitoring service
      return this.getDefaultScore(address);
    }
  }
  
  /**
   * Update an activity component and return the updated score.
   * @param address - Wallet address
   * @param component - Component key to update
   * @param activity - Component-specific payload
   * @returns Updated participation score
   */
  async updateActivity(
    address: string,
    component: keyof ParticipationComponents,
    activity: ActivityUpdate
  ): Promise<ParticipationScore> {
    if (this.participationScoreService) {
      // Update through real service based on component
      switch (component) {
        case 'referrals':
          if (activity.type === 'new_referral') {
            const referralActivity = activity as ReferralActivity;
            await this.participationScoreService.recordReferral(address, referralActivity.referred);
          }
          break;
        case 'publishing':
          if (activity.type === 'listing_published') {
            await this.participationScoreService.recordListingPublished(address);
          }
          break;
        case 'forumActivity':
          if (activity.type === 'answer') {
            await this.participationScoreService.recordForumAnswer(address);
          } else if (activity.type === 'helpful_vote') {
            await this.participationScoreService.recordHelpfulVote(address);
          }
          break;
        case 'marketplaceActivity':
          const marketActivity = activity as MarketplaceActivity;
          if (marketActivity.type === 'buy' || marketActivity.type === 'sell') {
            await this.participationScoreService.recordTransaction(address, marketActivity.type);
          }
          break;
        case 'communityPolicing':
          const policingActivity = activity as CommunityPolicingActivity;
          if (policingActivity.type === 'report') {
            await this.participationScoreService.recordCommunityReport(
              address,
              policingActivity.verified
            );
          }
          break;
        case 'reliability':
          const reliabilityActivity = activity as ReliabilityActivity;
          if (reliabilityActivity.type === 'validation_success') {
            await this.participationScoreService.recordValidation(address, true);
          } else if (reliabilityActivity.type === 'validation_failure') {
            await this.participationScoreService.recordValidation(address, false);
          } else if (reliabilityActivity.type === 'dispute_resolved') {
            await this.participationScoreService.recordDisputeResolution(address, true);
          } else if (reliabilityActivity.type === 'dispute_failed') {
            await this.participationScoreService.recordDisputeResolution(address, false);
          }
          break;
      }
      
      // Clear cache and get updated score
      this.scoreCache.delete(address);
      return await this.getScore(address);
    }
    
    // Fallback to API
    const response = await fetch(`${this.validatorEndpoint}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address,
        component,
        activity,
        timestamp: Date.now()
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to update activity');
    }
    
    const data = await response.json() as unknown;
    if (!this.isParticipationAPIData(data)) {
      throw new Error('Invalid response data');
    }
    const score = this.calculateScore(address, data);
    
    // Clear cache
    this.scoreCache.delete(address);
    
    return score;
  }
  
  /**
   * Track referral
   * @param referrer Address of the referrer
   * @param referred Address of the referred user
   */
  async trackReferral(referrer: string, referred: string): Promise<void> {
    await this.updateActivity(referrer, 'referrals', {
      type: 'new_referral',
      referred
    });
  }
  
  /**
   * Track listing publication
   * @param publisher Address of the publisher
   * @param listingId ID of the published listing
   */
  async trackListingPublished(publisher: string, listingId: string): Promise<void> {
    await this.updateActivity(publisher, 'publishing', {
      type: 'listing_published',
      listingId
    });
  }
  
  /**
   * Track forum activity
   * @param user User address
   * @param activityType Type of forum activity
   * @param metadata Additional metadata for the activity
   */
  async trackForumActivity(
    user: string,
    activityType: 'answer' | 'helpful_vote',
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.updateActivity(user, 'forumActivity', {
      type: activityType,
      ...(metadata ?? {})
    } as ForumActivity);
  }
  
  /**
   * Track marketplace transaction
   * @param user User address
   * @param transactionType Type of transaction (buy or sell)
   * @param transactionId ID of the transaction
   */
  async trackMarketplaceTransaction(
    user: string,
    transactionType: 'buy' | 'sell',
    transactionId: string
  ): Promise<void> {
    await this.updateActivity(user, 'marketplaceActivity', {
      type: transactionType,
      transactionId
    });
  }
  
  /**
   * Track community policing
   * @param reporter Address of the reporter
   * @param reportId ID of the report
   * @param verified Whether the report was verified
   */
  async trackCommunityPolicing(
    reporter: string,
    reportId: string,
    verified: boolean
  ): Promise<void> {
    await this.updateActivity(reporter, 'communityPolicing', {
      type: 'report',
      reportId,
      verified
    });
  }
  
  /**
   * Update reliability score
   * @param user User address
   * @param action Type of reliability action
   * @param metadata Additional metadata for the action
   */
  async updateReliability(
    user: string,
    action: 'validation_success' | 'validation_failure' | 'dispute_resolved' | 'dispute_failed',
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.updateActivity(user, 'reliability', {
      type: action,
      ...(metadata ?? {})
    } as ReliabilityActivity);
  }
  
  /**
   * Check validator qualification
   * @param address Wallet address to check
   * @returns Qualification status and requirements
   */
  async checkValidatorQualification(address: string): Promise<{
    qualified: boolean;
    score: number;
    requirements: {
      minScore: number;
      currentScore: number;
      hasKYC: boolean;
      stakingAmount: string;
      requiredStaking: string;
    };
  }> {
    const score = await this.getScore(address);
    
    // Check staking (would query blockchain)
    const stakingAmount = await this.getStakingAmount(address);
    
    // Check KYC (would query KYC service)
    const hasKYC = await this.checkKYCStatus(address);
    
    return {
      qualified: score.qualifiedAsValidator && hasKYC && parseFloat(stakingAmount) >= 1000000,
      score: score.totalScore,
      requirements: {
        minScore: 50,
        currentScore: score.totalScore,
        hasKYC,
        stakingAmount,
        requiredStaking: '1000000'
      }
    };
  }
  
  /**
   * Check listing node qualification
   * @param address Wallet address to check
   * @returns Qualification status and requirements
   */
  async checkListingNodeQualification(address: string): Promise<{
    qualified: boolean;
    score: number;
    minRequired: number;
  }> {
    const score = await this.getScore(address);
    
    return {
      qualified: score.qualifiedAsListingNode,
      score: score.totalScore,
      minRequired: 25
    };
  }
  
  /**
   * Get leaderboard
   * @param limit Maximum number of entries to return (default 100)
   * @returns Array of leaderboard entries
   */
  async getLeaderboard(limit = 100): Promise<Array<{
    rank: number;
    address: string;
    score: number;
    isValidator: boolean;
    isListingNode: boolean;
  }>> {
    try {
      const response = await fetch(
        `${this.validatorEndpoint}/leaderboard?limit=${limit}`
      );
      
      if (!response.ok) {
        return [];
      }
      
      const data = await response.json() as unknown;
      if (!Array.isArray(data)) {
        throw new Error('Invalid leaderboard data');
      }
      
      return data.map((entry: unknown, index: number) => {
        const leaderboardEntry = entry as {
          address?: string;
          score?: number;
        };
        return {
          rank: index + 1,
          address: leaderboardEntry.address ?? '',
          score: leaderboardEntry.score ?? 0,
          isValidator: (leaderboardEntry.score ?? 0) >= 50,
          isListingNode: (leaderboardEntry.score ?? 0) >= 25
        };
      });
    } catch (error) {
      // Return empty array on error
      // In production, this would be logged to a monitoring service
      return [];
    }
  }
  
  // Helper methods
  
  /**
   * Calculate total score from components
   * @param address - Wallet address
   * @param data - API response data
   * @returns Calculated participation score
   */
  private calculateScore(address: string, data: ParticipationAPIData): ParticipationScore {
    const now = Date.now();
    
    // Calculate referral points (max 10)
    const referralPoints = Math.min(data.referrals?.count ?? 0, 10);
    
    // Calculate publishing points (0-4 based on thresholds)
    const publishingPoints = this.calculatePublishingPoints(
      data.publishing?.listingsPublished ?? 0
    );
    
    // Calculate forum points with decay (max 5)
    const forumPoints = this.applyDecay(
      data.forumActivity?.points ?? 0,
      data.forumActivity?.lastActivityDate ?? 0,
      this.DECAY_CONFIGS.forum,
      5
    );
    
    // Calculate marketplace points with decay (max 5)
    const marketplacePoints = this.applyDecay(
      data.marketplaceActivity?.points ?? 0,
      data.marketplaceActivity?.lastTransactionDate ?? 0,
      this.DECAY_CONFIGS.marketplace,
      5
    );
    
    // Calculate community policing points with decay (max 5)
    const policingPoints = this.applyDecay(
      data.communityPolicing?.points ?? 0,
      data.communityPolicing?.lastReportDate ?? 0,
      this.DECAY_CONFIGS.communityPolicing,
      5
    );
    
    // Calculate reliability points with decay (-5 to +5)
    const reliabilityPoints = this.applyDecay(
      data.reliability?.points ?? 0,
      data.reliability?.lastActivityDate ?? 0,
      this.DECAY_CONFIGS.reliability,
      5,
      -5
    );
    
    // Calculate total score
    const totalScore = Math.max(0, Math.min(100,
      referralPoints +
      publishingPoints +
      forumPoints +
      marketplacePoints +
      policingPoints +
      reliabilityPoints
    ));
    
    return {
      address,
      totalScore,
      components: {
        referrals: {
          count: data.referrals?.count ?? 0,
          points: referralPoints
        },
        publishing: {
          listingsPublished: data.publishing?.listingsPublished ?? 0,
          points: publishingPoints
        },
        forumActivity: {
          questionsAnswered: data.forumActivity?.questionsAnswered ?? 0,
          helpfulVotes: data.forumActivity?.helpfulVotes ?? 0,
          lastActivityDate: data.forumActivity?.lastActivityDate ?? 0,
          points: forumPoints
        },
        marketplaceActivity: {
          buyTransactions: data.marketplaceActivity?.buyTransactions ?? 0,
          sellTransactions: data.marketplaceActivity?.sellTransactions ?? 0,
          lastTransactionDate: data.marketplaceActivity?.lastTransactionDate ?? 0,
          points: marketplacePoints
        },
        communityPolicing: {
          reportsSubmitted: data.communityPolicing?.reportsSubmitted ?? 0,
          reportsVerified: data.communityPolicing?.reportsVerified ?? 0,
          lastReportDate: data.communityPolicing?.lastReportDate ?? 0,
          points: policingPoints
        },
        reliability: {
          successfulValidations: data.reliability?.successfulValidations ?? 0,
          failedValidations: data.reliability?.failedValidations ?? 0,
          disputesAsArbitrator: data.reliability?.disputesAsArbitrator ?? 0,
          disputesResolved: data.reliability?.disputesResolved ?? 0,
          lastActivityDate: data.reliability?.lastActivityDate ?? 0,
          points: reliabilityPoints
        }
      },
      qualifiedAsValidator: totalScore >= 50,
      qualifiedAsListingNode: totalScore >= 25,
      lastCalculated: now,
      nextDecayTime: now + (24 * 60 * 60 * 1000) // Next day
    };
  }
  
  /**
   * Calculate publishing points based on thresholds
   * @param listingsPublished - Number of listings published
   * @returns Publishing points (0-4)
   */
  private calculatePublishingPoints(listingsPublished: number): number {
    let points = 0;
    
    for (const threshold of this.PUBLISHING_THRESHOLDS) {
      if (listingsPublished >= threshold.listings) {
        points = threshold.points;
      } else {
        break;
      }
    }
    
    return points;
  }
  
  /**
   * Apply time-based decay to points
   * @param currentPoints - Current points value
   * @param lastActivityDate - Timestamp of last activity
   * @param config - Decay configuration
   * @param maxPoints - Maximum allowed points
   * @param minPoints - Minimum allowed points (default 0)
   * @returns Decayed points value
   */
  private applyDecay(
    currentPoints: number,
    lastActivityDate: number,
    config: DecayConfig,
    maxPoints: number,
    minPoints = 0
  ): number {
    if (lastActivityDate === 0 || currentPoints === 0) {
      return currentPoints;
    }
    
    const now = Date.now();
    const daysSinceActivity = (now - lastActivityDate) / (1000 * 60 * 60 * 24);
    
    // No decay during grace period
    if (daysSinceActivity <= config.gracePeriodDays) {
      return Math.min(maxPoints, Math.max(minPoints, currentPoints));
    }
    
    // Calculate decay
    const decayPeriods = Math.floor(
      (daysSinceActivity - config.gracePeriodDays) / config.decayPeriodDays
    );
    
    const decayedPoints = currentPoints - (decayPeriods * config.decayRate);
    
    return Math.min(maxPoints, Math.max(minPoints, decayedPoints));
  }
  
  /**
   * Get default score for new user
   * @param address - Wallet address
   * @returns Default participation score
   */
  private getDefaultScore(address: string): ParticipationScore {
    return {
      address,
      totalScore: 0,
      components: {
        referrals: { count: 0, points: 0 },
        publishing: { listingsPublished: 0, points: 0 },
        forumActivity: {
          questionsAnswered: 0,
          helpfulVotes: 0,
          lastActivityDate: 0,
          points: 0
        },
        marketplaceActivity: {
          buyTransactions: 0,
          sellTransactions: 0,
          lastTransactionDate: 0,
          points: 0
        },
        communityPolicing: {
          reportsSubmitted: 0,
          reportsVerified: 0,
          lastReportDate: 0,
          points: 0
        },
        reliability: {
          successfulValidations: 0,
          failedValidations: 0,
          disputesAsArbitrator: 0,
          disputesResolved: 0,
          lastActivityDate: 0,
          points: 0
        }
      },
      qualifiedAsValidator: false,
      qualifiedAsListingNode: false,
      lastCalculated: Date.now(),
      nextDecayTime: Date.now() + (24 * 60 * 60 * 1000)
    };
  }
  
  /**
   * Type guard to validate API response data
   * @param data - Data to validate
   * @returns True if data matches expected structure
   */
  private isParticipationAPIData(data: unknown): data is ParticipationAPIData {
    if (typeof data !== 'object' || data === null) {
      return false;
    }
    
    // Basic structure validation
    const obj = data as Record<string, unknown>;
    
    // Check optional fields if present
    const fields = ['referrals', 'publishing', 'forumActivity', 'marketplaceActivity', 'communityPolicing', 'reliability'];
    
    for (const field of fields) {
      if (field in obj && typeof obj[field] !== 'object') {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Get staking amount
   * @param address - Wallet address
   * @returns Staking amount as string
   */
  private async getStakingAmount(address: string): Promise<string> {
    if (this.stakingService) {
      try {
        const balance = await this.stakingService.getStakedBalance(address);
        return balance.toString();
      } catch (error) {
        console.error('Failed to get staking amount:', error);
        return '0';
      }
    }
    return '0';
  }
  
  /**
   * Check KYC status
   * @param address - Wallet address
   * @returns KYC verification status
   */
  private async checkKYCStatus(address: string): Promise<boolean> {
    if (this.kycService) {
      try {
        const status = await this.kycService.getUserKYCStatus(address);
        // Check for top-tier verification
        return status.tier === 'professional' && status.verified;
      } catch (error) {
        console.error('Failed to check KYC status:', error);
        return false;
      }
    }
    return false;
  }
}

  /**
   * Cleanup resources and stop services
   */
  async cleanup(): Promise<void> {
    if (this.participationScoreService) {
      await this.participationScoreService.stop();
    }
    if (this.kycService) {
      await this.kycService.stop();
    }
    if (this.stakingService) {
      await this.stakingService.stop();
    }
    
    this.scoreCache.clear();
    this.participationScoreService = undefined;
    this.kycService = undefined;
    this.stakingService = undefined;
    this.merkleEngine = undefined;
  }
}

export default ParticipationService;
