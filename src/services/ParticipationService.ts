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
 * Participation Service
 */
export class ParticipationService {
  private provider: ethers.Provider;
  private validatorEndpoint: string;
  private scoreCache = new Map<string, ParticipationScore>();
  
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
   *
   * @param provider
   * @param validatorEndpoint
   */
  constructor(provider: ethers.Provider, validatorEndpoint?: string) {
    this.provider = provider;
    this.validatorEndpoint = validatorEndpoint || 'http://localhost:3001/api/participation';
  }
  
  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    console.log('Participation Service initialized');
  }
  
  /**
   * Get participation score for address
   * @param address
   */
  async getScore(address: string): Promise<ParticipationScore> {
    // Check cache
    const cached = this.scoreCache.get(address);
    if (cached && Date.now() - cached.lastCalculated < 300000) { // 5 minute cache
      return cached;
    }
    
    try {
      // Fetch components from validator
      const response = await fetch(`${this.validatorEndpoint}/score/${address}`);
      if (!response.ok) {
        return this.getDefaultScore(address);
      }
      
      const data = await response.json();
      const score = this.calculateScore(address, data);
      
      // Update cache
      this.scoreCache.set(address, score);
      
      return score;
    } catch (error) {
      console.error('Error fetching participation score:', error);
      return this.getDefaultScore(address);
    }
  }
  
  /**
   * Update activity component
   * @param address
   * @param component
   * @param activity
   */
  async updateActivity(
    address: string,
    component: keyof ParticipationComponents,
    activity: any
  ): Promise<ParticipationScore> {
    try {
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
      
      const data = await response.json();
      const score = this.calculateScore(address, data);
      
      // Clear cache
      this.scoreCache.delete(address);
      
      return score;
    } catch (error) {
      console.error('Error updating activity:', error);
      throw error;
    }
  }
  
  /**
   * Track referral
   * @param referrer
   * @param referred
   */
  async trackReferral(referrer: string, referred: string): Promise<void> {
    await this.updateActivity(referrer, 'referrals', {
      type: 'new_referral',
      referred
    });
  }
  
  /**
   * Track listing publication
   * @param publisher
   * @param listingId
   */
  async trackListingPublished(publisher: string, listingId: string): Promise<void> {
    await this.updateActivity(publisher, 'publishing', {
      type: 'listing_published',
      listingId
    });
  }
  
  /**
   * Track forum activity
   * @param user
   * @param activityType
   * @param metadata
   */
  async trackForumActivity(
    user: string,
    activityType: 'answer' | 'helpful_vote',
    metadata?: any
  ): Promise<void> {
    await this.updateActivity(user, 'forumActivity', {
      type: activityType,
      ...metadata
    });
  }
  
  /**
   * Track marketplace transaction
   * @param user
   * @param transactionType
   * @param transactionId
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
   * @param reporter
   * @param reportId
   * @param verified
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
   * @param user
   * @param action
   * @param metadata
   */
  async updateReliability(
    user: string,
    action: 'validation_success' | 'validation_failure' | 'dispute_resolved' | 'dispute_failed',
    metadata?: any
  ): Promise<void> {
    await this.updateActivity(user, 'reliability', {
      type: action,
      ...metadata
    });
  }
  
  /**
   * Check validator qualification
   * @param address
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
   * @param address
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
   * @param limit
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
      
      const data = await response.json();
      
      return data.map((entry: any, index: number) => ({
        rank: index + 1,
        address: entry.address,
        score: entry.score,
        isValidator: entry.score >= 50,
        isListingNode: entry.score >= 25
      }));
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }
  }
  
  // Helper methods
  
  /**
   * Calculate total score from components
   * @param address
   * @param data
   */
  private calculateScore(address: string, data: any): ParticipationScore {
    const now = Date.now();
    
    // Calculate referral points (max 10)
    const referralPoints = Math.min(data.referrals?.count || 0, 10);
    
    // Calculate publishing points (0-4 based on thresholds)
    const publishingPoints = this.calculatePublishingPoints(
      data.publishing?.listingsPublished || 0
    );
    
    // Calculate forum points with decay (max 5)
    const forumPoints = this.applyDecay(
      data.forumActivity?.points || 0,
      data.forumActivity?.lastActivityDate || 0,
      this.DECAY_CONFIGS.forum,
      5
    );
    
    // Calculate marketplace points with decay (max 5)
    const marketplacePoints = this.applyDecay(
      data.marketplaceActivity?.points || 0,
      data.marketplaceActivity?.lastTransactionDate || 0,
      this.DECAY_CONFIGS.marketplace,
      5
    );
    
    // Calculate community policing points with decay (max 5)
    const policingPoints = this.applyDecay(
      data.communityPolicing?.points || 0,
      data.communityPolicing?.lastReportDate || 0,
      this.DECAY_CONFIGS.communityPolicing,
      5
    );
    
    // Calculate reliability points with decay (-5 to +5)
    const reliabilityPoints = this.applyDecay(
      data.reliability?.points || 0,
      data.reliability?.lastActivityDate || 0,
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
          count: data.referrals?.count || 0,
          points: referralPoints
        },
        publishing: {
          listingsPublished: data.publishing?.listingsPublished || 0,
          points: publishingPoints
        },
        forumActivity: {
          questionsAnswered: data.forumActivity?.questionsAnswered || 0,
          helpfulVotes: data.forumActivity?.helpfulVotes || 0,
          lastActivityDate: data.forumActivity?.lastActivityDate || 0,
          points: forumPoints
        },
        marketplaceActivity: {
          buyTransactions: data.marketplaceActivity?.buyTransactions || 0,
          sellTransactions: data.marketplaceActivity?.sellTransactions || 0,
          lastTransactionDate: data.marketplaceActivity?.lastTransactionDate || 0,
          points: marketplacePoints
        },
        communityPolicing: {
          reportsSubmitted: data.communityPolicing?.reportsSubmitted || 0,
          reportsVerified: data.communityPolicing?.reportsVerified || 0,
          lastReportDate: data.communityPolicing?.lastReportDate || 0,
          points: policingPoints
        },
        reliability: {
          successfulValidations: data.reliability?.successfulValidations || 0,
          failedValidations: data.reliability?.failedValidations || 0,
          disputesAsArbitrator: data.reliability?.disputesAsArbitrator || 0,
          disputesResolved: data.reliability?.disputesResolved || 0,
          lastActivityDate: data.reliability?.lastActivityDate || 0,
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
   * @param listingsPublished
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
   * @param currentPoints
   * @param lastActivityDate
   * @param config
   * @param maxPoints
   * @param minPoints
   */
  private applyDecay(
    currentPoints: number,
    lastActivityDate: number,
    config: DecayConfig,
    maxPoints: number,
    minPoints = 0
  ): number {
    if (!lastActivityDate || currentPoints === 0) {
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
   * @param address
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
   * Get staking amount (mock - would query blockchain)
   * @param address
   */
  private async getStakingAmount(address: string): Promise<string> {
    // In production, would query staking contract
    return '0';
  }
  
  /**
   * Check KYC status (mock - would query KYC service)
   * @param address
   */
  private async checkKYCStatus(address: string): Promise<boolean> {
    // In production, would query KYC service for top-tier verification
    return false;
  }
}

export default ParticipationService;