/**
 * StakingService Test Suite
 * 
 * Tests staking functionality with contract integration and TypeScript strict compliance.
 * Validates XOM staking, reward distribution, and validator operations.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { ethers } from 'ethers';
import { StakingService, type StakePosition, type StakeRewards } from '../../../src/services/StakingService';
import { 
  mockWallet, 
  createMockProvider, 
  createMockContract, 
  STAKING_TEST_DATA,
  TEST_ADDRESSES,
  cleanupTest 
} from '../../setup';

describe('StakingService', () => {
  let service: StakingService;
  let mockProvider: any;
  let mockStakingContract: any;
  let mockRewardsContract: any;
  let mockXOMTokenContract: any;

  beforeAll(async () => {
    mockProvider = createMockProvider('ethereum');
    
    // Mock staking contract with bracket notation access
    mockStakingContract = createMockContract(STAKING_TEST_DATA.stakingContract, {
      'stake': jest.fn().mockResolvedValue({
        hash: '0xstaketx',
        wait: jest.fn().mockResolvedValue({ status: 1 })
      }),
      'unstake': jest.fn().mockResolvedValue({
        hash: '0xunstaketx',
        wait: jest.fn().mockResolvedValue({ status: 1 })
      }),
      'getStakeInfo': jest.fn().mockResolvedValue([
        ethers.parseEther('100'), // amount
        Math.floor(Date.now() / 1000), // startTime
        30 * 24 * 60 * 60, // duration
        false // claimed
      ]),
      'calculateRewards': jest.fn().mockResolvedValue(ethers.parseEther('5')),
      'claimRewards': jest.fn().mockResolvedValue({
        hash: '0xclaimtx',
        wait: jest.fn().mockResolvedValue({ status: 1 })
      }),
      'totalStaked': jest.fn().mockResolvedValue(ethers.parseEther('1000000')),
      'stakingAPY': jest.fn().mockResolvedValue(1250), // 12.5% APY (in basis points)
      'minimumStakeDuration': jest.fn().mockResolvedValue(7 * 24 * 60 * 60) // 7 days
    });

    // Mock rewards contract
    mockRewardsContract = createMockContract(STAKING_TEST_DATA.rewardsContract, {
      'distributorRewards': jest.fn().mockResolvedValue({
        hash: '0xdistributetx',
        wait: jest.fn().mockResolvedValue({ status: 1 })
      }),
      'getRewardRate': jest.fn().mockResolvedValue(ethers.parseEther('0.1')), // per second
      'pendingRewards': jest.fn().mockResolvedValue(ethers.parseEther('2.5')),
      'totalRewardsDistributed': jest.fn().mockResolvedValue(ethers.parseEther('50000'))
    });

    // Mock XOM token contract
    mockXOMTokenContract = createMockContract('0xXOMTokenAddress', {
      'allowance': jest.fn().mockResolvedValue(0n),
      'approve': jest.fn().mockResolvedValue({
        hash: '0xapproval',
        wait: jest.fn().mockResolvedValue({ status: 1 })
      }),
      'balanceOf': jest.fn().mockResolvedValue(ethers.parseEther('1000')),
      'transfer': jest.fn().mockResolvedValue({
        hash: '0xtransfer',
        wait: jest.fn().mockResolvedValue({ status: 1 })
      })
    });

    service = new StakingService(mockProvider, {
      stakingContract: mockStakingContract.address,
      rewardsContract: mockRewardsContract.address,
      xomTokenContract: mockXOMTokenContract.address,
      minimumStakeAmount: ethers.parseEther('10'),
      maximumStakeAmount: ethers.parseEther('1000000'),
      defaultAPY: 12.5
    });
  });

  afterAll(() => {
    cleanupTest();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization and Configuration', () => {
    it('should initialize with correct configuration', () => {
      expect(service).toBeDefined();
      expect(service.getConfiguration()).toMatchObject({
        stakingContract: STAKING_TEST_DATA.stakingContract,
        minimumStakeAmount: ethers.parseEther('10').toString(),
        defaultAPY: 12.5
      });
    });

    it('should validate contract addresses', () => {
      expect(() => {
        new StakingService(mockProvider, {
          stakingContract: 'invalid-address'
        });
      }).toThrow('Invalid staking contract address');
    });

    it('should set minimum and maximum stake limits', () => {
      const config = service.getConfiguration();
      
      expect(config.minimumStakeAmount).toBe(ethers.parseEther('10').toString());
      expect(config.maximumStakeAmount).toBe(ethers.parseEther('1000000').toString());
    });
  });

  describe('Stake Amount Validation', () => {
    it('should validate minimum stake amount', async () => {
      await expect(service.validateStakeAmount(ethers.parseEther('5')))
        .rejects.toThrow('Stake amount below minimum');
    });

    it('should validate maximum stake amount', async () => {
      await expect(service.validateStakeAmount(ethers.parseEther('2000000')))
        .rejects.toThrow('Stake amount exceeds maximum');
    });

    it('should accept valid stake amounts', async () => {
      const validation = await service.validateStakeAmount(ethers.parseEther('100'));
      
      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toHaveLength(0);
    });

    it('should handle zero and negative amounts', async () => {
      await expect(service.validateStakeAmount(0n))
        .rejects.toThrow('Stake amount must be positive');

      await expect(service.validateStakeAmount(-100n))
        .rejects.toThrow('Stake amount must be positive');
    });
  });

  describe('Staking Operations with parseEther', () => {
    it('should stake XOM tokens', async () => {
      const signer = await mockProvider.getSigner();
      const amount = '100';
      const duration = 30; // days

      const result = await service.stakeTokens({
        amount,
        durationDays: duration,
        signer
      });

      expect(result.success).toBe(true);
      expect(result.stakeId).toBeDefined();
      expect(result.transactionHash).toBeDefined();
      
      // Verify parseEther was used correctly
      expect(mockStakingContract['stake']).toHaveBeenCalledWith(
        ethers.parseEther(amount),
        duration * 24 * 60 * 60,
        expect.any(Object)
      );
    });

    it('should require token approval before staking', async () => {
      mockXOMTokenContract['allowance'].mockResolvedValueOnce(ethers.parseEther('50'));
      
      const signer = await mockProvider.getSigner();
      
      await service.stakeTokens({
        amount: '100',
        durationDays: 30,
        signer
      });

      // Should approve with MaxUint256 for gas optimization
      expect(mockXOMTokenContract['approve']).toHaveBeenCalledWith(
        mockStakingContract.address,
        ethers.MaxUint256
      );
    });

    it('should handle staking transaction failures', async () => {
      mockStakingContract['stake'].mockRejectedValueOnce(new Error('Staking failed'));

      const signer = await mockProvider.getSigner();

      await expect(service.stakeTokens({
        amount: '100',
        durationDays: 30,
        signer
      })).rejects.toThrow('Staking failed');
    });

    it('should calculate staking rewards correctly', async () => {
      const rewards = await service.calculateStakingRewards({
        amount: ethers.parseEther('100'),
        durationDays: 365,
        apy: 12.5
      });

      expect(rewards.totalRewards).toBeDefined();
      expect(rewards.dailyRewards).toBeDefined();
      expect(rewards.monthlyRewards).toBeDefined();
      expect(typeof rewards.totalRewards).toBe('bigint');
    });
  });

  describe('Unstaking Operations', () => {
    it('should unstake tokens after duration', async () => {
      const signer = await mockProvider.getSigner();
      const stakeId = 'stake-123';

      const result = await service.unstakeTokens({
        stakeId,
        signer
      });

      expect(result.success).toBe(true);
      expect(result.transactionHash).toBeDefined();
      expect(result.unstakedAmount).toBeDefined();
      expect(mockStakingContract['unstake']).toHaveBeenCalled();
    });

    it('should prevent early unstaking', async () => {
      // Mock stake info showing recent stake
      mockStakingContract['getStakeInfo'].mockResolvedValueOnce([
        ethers.parseEther('100'),
        Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        30 * 24 * 60 * 60, // 30 day duration
        false
      ]);

      const signer = await mockProvider.getSigner();

      await expect(service.unstakeTokens({
        stakeId: 'recent-stake',
        signer
      })).rejects.toThrow('Stake duration not completed');
    });

    it('should handle partial unstaking', async () => {
      const signer = await mockProvider.getSigner();
      
      const result = await service.unstakeTokens({
        stakeId: 'stake-123',
        amount: ethers.parseEther('50'), // Partial amount
        signer
      });

      expect(result.success).toBe(true);
      expect(result.remainingStake).toBeDefined();
    });

    it('should apply early unstaking penalties if allowed', async () => {
      const penalty = await service.calculateEarlyUnstakingPenalty({
        stakeAmount: ethers.parseEther('100'),
        remainingDays: 15,
        penaltyRate: 0.05 // 5%
      });

      expect(penalty.penaltyAmount).toBeDefined();
      expect(penalty.netAmount).toBeDefined();
      expect(penalty.netAmount < ethers.parseEther('100')).toBe(true);
    });
  });

  describe('Reward Management with Contract Bracket Notation', () => {
    it('should claim pending rewards', async () => {
      const signer = await mockProvider.getSigner();
      const stakeId = 'stake-123';

      const result = await service.claimRewards({
        stakeId,
        signer
      });

      expect(result.success).toBe(true);
      expect(result.rewardAmount).toBeDefined();
      expect(result.transactionHash).toBeDefined();
      expect(mockRewardsContract['claimRewards']).toHaveBeenCalled();
    });

    it('should calculate pending rewards using bracket notation', async () => {
      const pendingRewards = await service.getPendingRewards({
        stakeId: 'stake-123',
        userAddress: TEST_ADDRESSES.ethereum
      });

      expect(pendingRewards).toBeDefined();
      expect(typeof pendingRewards).toBe('bigint');
      expect(mockRewardsContract['pendingRewards']).toHaveBeenCalledWith(
        TEST_ADDRESSES.ethereum
      );
    });

    it('should compound rewards automatically', async () => {
      const signer = await mockProvider.getSigner();

      const result = await service.compoundRewards({
        stakeId: 'stake-123',
        signer
      });

      expect(result.success).toBe(true);
      expect(result.compoundedAmount).toBeDefined();
      expect(result.newStakeAmount).toBeDefined();
    });

    it('should distribute validator rewards', async () => {
      const signer = await mockProvider.getSigner();

      const result = await service.distributeValidatorRewards({
        totalRewards: ethers.parseEther('1000'),
        validators: [
          { address: '0xValidator1', weight: 60 },
          { address: '0xValidator2', weight: 40 }
        ],
        signer
      });

      expect(result.success).toBe(true);
      expect(result.distributions).toHaveLength(2);
      expect(mockRewardsContract['distributorRewards']).toHaveBeenCalled();
    });
  });

  describe('Staking Analytics and Reporting', () => {
    it('should get user staking positions', async () => {
      const positions = await service.getUserStakingPositions(TEST_ADDRESSES.ethereum);

      expect(positions).toBeInstanceOf(Array);
      expect(positions[0]).toMatchObject({
        stakeId: expect.any(String),
        amount: expect.any(String),
        startTime: expect.any(Number),
        duration: expect.any(Number),
        apy: expect.any(Number),
        status: expect.stringMatching(/active|completed|claimed/)
      });
    });

    it('should calculate total staked value', async () => {
      const totalStaked = await service.getTotalStakedValue();

      expect(totalStaked.amount).toBeDefined();
      expect(totalStaked.usdValue).toBeDefined();
      expect(typeof totalStaked.amount).toBe('bigint');
      expect(mockStakingContract['totalStaked']).toHaveBeenCalled();
    });

    it('should get staking statistics', async () => {
      const stats = await service.getStakingStatistics();

      expect(stats).toMatchObject({
        totalStakers: expect.any(Number),
        totalStaked: expect.any(String),
        averageStakeDuration: expect.any(Number),
        totalRewardsDistributed: expect.any(String),
        currentAPY: expect.any(Number)
      });
    });

    it('should generate staking history report', async () => {
      const history = await service.getStakingHistory({
        userAddress: TEST_ADDRESSES.ethereum,
        fromBlock: 18000000,
        toBlock: 'latest'
      });

      expect(history).toBeInstanceOf(Array);
      history.forEach(entry => {
        expect(entry).toHaveProperty('type');
        expect(entry).toHaveProperty('amount');
        expect(entry).toHaveProperty('timestamp');
        expect(entry).toHaveProperty('transactionHash');
      });
    });
  });

  describe('APY and Reward Rate Calculations', () => {
    it('should get current staking APY from contract', async () => {
      const apy = await service.getCurrentAPY();

      expect(apy).toBe(12.5); // 1250 basis points / 100
      expect(mockStakingContract['stakingAPY']).toHaveBeenCalled();
    });

    it('should calculate dynamic APY based on utilization', async () => {
      const dynamicAPY = await service.calculateDynamicAPY({
        totalStaked: ethers.parseEther('500000'),
        totalSupply: ethers.parseEther('10000000'),
        baseAPY: 10.0,
        maxAPY: 25.0
      });

      expect(dynamicAPY).toBeGreaterThan(10.0);
      expect(dynamicAPY).toBeLessThanOrEqual(25.0);
    });

    it('should calculate reward rate per second', async () => {
      const rewardRate = await service.getRewardRate();

      expect(rewardRate).toBeDefined();
      expect(typeof rewardRate).toBe('bigint');
      expect(mockRewardsContract['getRewardRate']).toHaveBeenCalled();
    });

    it('should project future rewards', async () => {
      const projection = await service.projectFutureRewards({
        currentStake: ethers.parseEther('100'),
        projectionDays: 90,
        assumedAPY: 12.5
      });

      expect(projection.day30).toBeDefined();
      expect(projection.day60).toBeDefined();
      expect(projection.day90).toBeDefined();
      expect(projection.total).toBeDefined();
    });
  });

  describe('Validator Staking Operations', () => {
    it('should stake as validator with higher requirements', async () => {
      const signer = await mockProvider.getSigner();

      const result = await service.stakeAsValidator({
        amount: ethers.parseEther('10000'), // Higher minimum for validators
        duration: 365, // 1 year
        validatorMetadata: {
          name: 'Test Validator',
          description: 'Testing validator',
          commissionRate: 5.0 // 5%
        },
        signer
      });

      expect(result.success).toBe(true);
      expect(result.validatorId).toBeDefined();
      expect(result.commissionRate).toBe(5.0);
    });

    it('should slash validator stake for misbehavior', async () => {
      const slashing = await service.calculateSlashingPenalty({
        validatorAddress: '0xBadValidator',
        offense: 'double_signing',
        stakeAmount: ethers.parseEther('50000')
      });

      expect(slashing.penaltyAmount).toBeDefined();
      expect(slashing.penaltyPercentage).toBeGreaterThan(0);
      expect(slashing.remainingStake).toBeDefined();
    });

    it('should distribute commission to validators', async () => {
      const commission = await service.calculateValidatorCommission({
        totalRewards: ethers.parseEther('100'),
        commissionRate: 5.0,
        validatorStake: ethers.parseEther('10000'),
        totalValidatorStake: ethers.parseEther('100000')
      });

      expect(commission.validatorReward).toBeDefined();
      expect(commission.delegatorReward).toBeDefined();
      expect(commission.commissionAmount).toBeDefined();
    });
  });

  describe('Delegation and Liquid Staking', () => {
    it('should delegate stake to validator', async () => {
      const signer = await mockProvider.getSigner();

      const result = await service.delegateStake({
        validatorAddress: '0xTrustedValidator',
        amount: ethers.parseEther('500'),
        signer
      });

      expect(result.success).toBe(true);
      expect(result.delegationId).toBeDefined();
      expect(result.expectedRewards).toBeDefined();
    });

    it('should undelegate stake with unbonding period', async () => {
      const signer = await mockProvider.getSigner();

      const result = await service.undelegateStake({
        delegationId: 'delegation-123',
        amount: ethers.parseEther('250'),
        signer
      });

      expect(result.success).toBe(true);
      expect(result.unbondingPeriod).toBeDefined();
      expect(result.availableAt).toBeDefined();
    });

    it('should mint liquid staking tokens', async () => {
      const signer = await mockProvider.getSigner();

      const result = await service.mintLiquidStakingTokens({
        amount: ethers.parseEther('1000'),
        signer
      });

      expect(result.success).toBe(true);
      expect(result.liquidTokens).toBeDefined();
      expect(result.exchangeRate).toBeDefined();
    });
  });

  describe('Gas Estimation and Optimization', () => {
    it('should estimate gas for staking operations', async () => {
      mockStakingContract.estimateGas = {
        stake: jest.fn().mockResolvedValue(120000n)
      };

      const gasEstimate = await service.estimateStakingGas({
        amount: ethers.parseEther('100'),
        duration: 30,
        fromAddress: TEST_ADDRESSES.ethereum
      });

      expect(gasEstimate).toBe(120000n);
      expect(typeof gasEstimate).toBe('bigint');
    });

    it('should optimize gas for batch operations', async () => {
      const batchGas = await service.estimateBatchGas({
        operations: [
          { type: 'stake', amount: ethers.parseEther('100') },
          { type: 'claim', stakeId: 'stake-123' },
          { type: 'compound', stakeId: 'stake-456' }
        ]
      });

      expect(batchGas.totalGas).toBeDefined();
      expect(batchGas.gasPerOperation).toBeInstanceOf(Array);
      expect(batchGas.estimatedCost).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle contract paused state', async () => {
      mockStakingContract['stake'].mockRejectedValueOnce(new Error('Contract paused'));

      const signer = await mockProvider.getSigner();

      await expect(service.stakeTokens({
        amount: '100',
        durationDays: 30,
        signer
      })).rejects.toThrow('Contract paused');
    });

    it('should handle insufficient token balance', async () => {
      mockXOMTokenContract['balanceOf'].mockResolvedValueOnce(ethers.parseEther('50'));

      const signer = await mockProvider.getSigner();

      await expect(service.stakeTokens({
        amount: '100', // More than balance
        durationDays: 30,
        signer
      })).rejects.toThrow('Insufficient token balance');
    });

    it('should handle network congestion', async () => {
      mockProvider.getFeeData.mockRejectedValueOnce(new Error('Network timeout'));

      await expect(service.getOptimalGasPricing()).rejects.toThrow('Network timeout');
    });

    it('should validate contract deployment', async () => {
      mockProvider.getCode.mockResolvedValueOnce('0x');

      await expect(service.validateContracts()).rejects.toThrow(
        'Staking contract not deployed'
      );
    });
  });

  describe('TypeScript Strict Mode Compliance', () => {
    it('should handle undefined values correctly', async () => {
      const result = await service.getStakeInfo('nonexistent-stake');
      
      expect(result).toBeNull();
      // No undefined access without proper checks
    });

    it('should use proper type assertions for contract calls', async () => {
      // Test that bracket notation works for strict mode
      const totalStaked = await mockStakingContract['totalStaked']();
      
      expect(typeof totalStaked).toBe('bigint');
      expect(totalStaked >= 0n).toBe(true);
    });

    it('should handle bigint arithmetic correctly', () => {
      const amount = ethers.parseEther('100');
      const duration = 365n;
      const apy = 1250n; // 12.5% in basis points
      
      const rewards = (amount * apy * duration) / (10000n * 365n);
      
      expect(typeof rewards).toBe('bigint');
      expect(rewards > 0n).toBe(true);
    });

    it('should properly validate input parameters', async () => {
      // Test with null/undefined inputs
      await expect(service.stakeTokens({
        amount: '',
        durationDays: 0,
        signer: null as any
      })).rejects.toThrow();
    });
  });

  describe('Integration with Real Contracts', () => {
    it('should handle real mainnet contract interaction', async () => {
      // Skip if not in mainnet fork environment
      if (process.env.FORK_URL) {
        const realProvider = new ethers.JsonRpcProvider(process.env.FORK_URL);
        const forkService = new StakingService(realProvider, {
          stakingContract: '0xRealStakingContract',
          rewardsContract: '0xRealRewardsContract',
          xomTokenContract: '0xRealXOMContract'
        });

        const totalStaked = await forkService.getTotalStakedValue();
        expect(totalStaked.amount).toBeDefined();
      }
    });

    it('should integrate with price feeds for USD calculations', async () => {
      const usdValue = await service.calculateUSDValue({
        xomAmount: ethers.parseEther('1000'),
        priceSource: 'chainlink'
      });

      expect(usdValue).toBeGreaterThan(0);
    });
  });
});