/**
 * Coin/Token Integration Tests
 * Tests wallet integration with various cryptocurrencies and tokens
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { WalletService } from '../../src/services/WalletService';
import { TokenService } from '../../src/services/TokenService';
import { XOMService } from '../../src/services/XOMService';
import { BridgeService } from '../../src/services/BridgeService';
import { mockWallet, MOCK_TOKENS, CHAIN_TEST_DATA } from '../setup';
import { ethers } from 'ethers';

describe('Coin/Token Integration', () => {
  let walletService: WalletService;
  let tokenService: TokenService;
  let xomService: XOMService;
  let bridgeService: BridgeService;

  beforeAll(async () => {
    walletService = new WalletService();
    tokenService = new TokenService(walletService);
    xomService = new XOMService(walletService);
    bridgeService = new BridgeService();
    
    await walletService.init();
    await tokenService.init();
    await xomService.init();
  });

  afterAll(async () => {
    await walletService.cleanup();
    await tokenService.cleanup();
    await xomService.cleanup();
  });

  beforeEach(async () => {
    await tokenService.clearCache();
  });

  describe('XOM (OmniCoin) Integration', () => {
    it('should get XOM balance', async () => {
      const balance = await xomService.getBalance(mockWallet.address);
      
      expect(balance).toBeDefined();
      expect(balance.raw).toBeDefined();
      expect(balance.formatted).toBeDefined();
      expect(balance.usd).toBeDefined();
    });

    it('should send XOM tokens', async () => {
      const recipient = '0x742d35Cc6634C0532925a3b844Bc9e7595f6BED7';
      const amount = ethers.parseEther('10');
      
      const tx = await xomService.transfer({
        to: recipient,
        amount,
        from: mockWallet.address
      });

      expect(tx.hash).toBeDefined();
      expect(tx.from).toBe(mockWallet.address);
      expect(tx.to).toBe(recipient);
      expect(tx.value).toBe(amount.toString());
    });

    it('should stake XOM tokens', async () => {
      const amountToStake = ethers.parseEther('100');
      
      const stakeResult = await xomService.stake({
        amount: amountToStake,
        duration: 30, // 30 days
        address: mockWallet.address
      });

      expect(stakeResult.success).toBe(true);
      expect(stakeResult.stakeId).toBeDefined();
      expect(stakeResult.rewards).toBeDefined();
      expect(stakeResult.unlockDate).toBeGreaterThan(Date.now());
    });

    it('should calculate staking rewards', async () => {
      const amount = ethers.parseEther('1000');
      const duration = 365; // 1 year
      
      const rewards = await xomService.calculateRewards(amount, duration);
      
      expect(rewards.base).toBeDefined();
      expect(rewards.bonus).toBeDefined();
      expect(rewards.total).toBeGreaterThan(0);
      expect(rewards.apy).toBeGreaterThan(0);
    });

    it('should get staking positions', async () => {
      const positions = await xomService.getStakingPositions(mockWallet.address);
      
      expect(Array.isArray(positions)).toBe(true);
      positions.forEach(position => {
        expect(position).toHaveProperty('stakeId');
        expect(position).toHaveProperty('amount');
        expect(position).toHaveProperty('rewards');
        expect(position).toHaveProperty('startTime');
        expect(position).toHaveProperty('endTime');
      });
    });

    it('should unstake XOM tokens', async () => {
      const stakeId = 'stake-123';
      
      const unstakeResult = await xomService.unstake({
        stakeId,
        address: mockWallet.address
      });

      expect(unstakeResult.success).toBe(true);
      expect(unstakeResult.principal).toBeDefined();
      expect(unstakeResult.rewards).toBeDefined();
      expect(unstakeResult.totalReceived).toBe(
        unstakeResult.principal + unstakeResult.rewards
      );
    });
  });

  describe('Multi-Chain Token Support', () => {
    it('should detect tokens on Ethereum', async () => {
      const tokens = await tokenService.getTokensByChain(
        mockWallet.address,
        'ethereum'
      );

      expect(Array.isArray(tokens)).toBe(true);
      tokens.forEach(token => {
        expect(token.chain).toBe('ethereum');
        expect(token).toHaveProperty('address');
        expect(token).toHaveProperty('symbol');
        expect(token).toHaveProperty('decimals');
        expect(token).toHaveProperty('balance');
      });
    });

    it('should detect tokens on Avalanche', async () => {
      const tokens = await tokenService.getTokensByChain(
        mockWallet.address,
        'avalanche'
      );

      expect(Array.isArray(tokens)).toBe(true);
      tokens.forEach(token => {
        expect(token.chain).toBe('avalanche');
      });
    });

    it('should detect tokens on Polygon', async () => {
      const tokens = await tokenService.getTokensByChain(
        mockWallet.address,
        'polygon'
      );

      expect(Array.isArray(tokens)).toBe(true);
      tokens.forEach(token => {
        expect(token.chain).toBe('polygon');
      });
    });

    it('should detect tokens on BSC', async () => {
      const tokens = await tokenService.getTokensByChain(
        mockWallet.address,
        'bsc'
      );

      expect(Array.isArray(tokens)).toBe(true);
      tokens.forEach(token => {
        expect(token.chain).toBe('bsc');
      });
    });

    it('should aggregate tokens from all chains', async () => {
      const allTokens = await tokenService.getAllTokens(mockWallet.address);
      
      expect(Array.isArray(allTokens)).toBe(true);
      
      const chains = new Set(allTokens.map(token => token.chain));
      expect(chains.size).toBeGreaterThan(0);
      
      // Check total portfolio value
      const portfolio = await tokenService.getPortfolioValue(mockWallet.address);
      expect(portfolio.totalUSD).toBeDefined();
      expect(portfolio.byChain).toBeDefined();
      expect(portfolio.byToken).toBeDefined();
    });
  });

  describe('ERC-20 Token Operations', () => {
    it('should get token balance', async () => {
      const usdcBalance = await tokenService.getTokenBalance(
        MOCK_TOKENS.ethereum.USDC.address,
        mockWallet.address,
        'ethereum'
      );

      expect(usdcBalance).toBeDefined();
      expect(usdcBalance.raw).toBeDefined();
      expect(usdcBalance.formatted).toBeDefined();
      expect(usdcBalance.decimals).toBe(6);
    });

    it('should transfer tokens', async () => {
      const recipient = '0x742d35Cc6634C0532925a3b844Bc9e7595f6BED7';
      const amount = ethers.parseUnits('100', 6); // 100 USDC
      
      const tx = await tokenService.transferToken({
        tokenAddress: MOCK_TOKENS.ethereum.USDC.address,
        to: recipient,
        amount,
        from: mockWallet.address,
        chain: 'ethereum'
      });

      expect(tx.hash).toBeDefined();
      expect(tx.status).toBe('pending');
    });

    it('should approve token spending', async () => {
      const spender = '0xDEX_CONTRACT_ADDRESS';
      const amount = ethers.parseUnits('1000', 6);
      
      const approval = await tokenService.approveToken({
        tokenAddress: MOCK_TOKENS.ethereum.USDC.address,
        spender,
        amount,
        from: mockWallet.address,
        chain: 'ethereum'
      });

      expect(approval.hash).toBeDefined();
      expect(approval.success).toBe(true);
    });

    it('should check token allowance', async () => {
      const spender = '0xDEX_CONTRACT_ADDRESS';
      
      const allowance = await tokenService.getAllowance({
        tokenAddress: MOCK_TOKENS.ethereum.USDC.address,
        owner: mockWallet.address,
        spender,
        chain: 'ethereum'
      });

      expect(allowance).toBeDefined();
      expect(allowance.raw).toBeDefined();
      expect(allowance.formatted).toBeDefined();
    });

    it('should add custom token', async () => {
      const customToken = {
        address: '0x1234567890123456789012345678901234567890',
        symbol: 'CUSTOM',
        decimals: 18,
        name: 'Custom Token',
        chain: 'ethereum'
      };

      const added = await tokenService.addCustomToken(
        customToken,
        mockWallet.address
      );

      expect(added.success).toBe(true);
      
      const tokens = await tokenService.getCustomTokens(mockWallet.address);
      expect(tokens).toContainEqual(expect.objectContaining(customToken));
    });
  });

  describe('Native Currency Operations', () => {
    it('should get ETH balance', async () => {
      const balance = await walletService.getNativeBalance(
        mockWallet.address,
        'ethereum'
      );

      expect(balance).toBeDefined();
      expect(balance.raw).toBeDefined();
      expect(balance.formatted).toBeDefined();
      expect(balance.symbol).toBe('ETH');
    });

    it('should send ETH', async () => {
      const recipient = '0x742d35Cc6634C0532925a3b844Bc9e7595f6BED7';
      const amount = ethers.parseEther('0.1');
      
      const tx = await walletService.sendNativeCurrency({
        to: recipient,
        amount,
        from: mockWallet.address,
        chain: 'ethereum'
      });

      expect(tx.hash).toBeDefined();
      expect(tx.from).toBe(mockWallet.address);
      expect(tx.to).toBe(recipient);
    });

    it('should estimate gas for transaction', async () => {
      const tx = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f6BED7',
        value: ethers.parseEther('0.1'),
        from: mockWallet.address
      };

      const gasEstimate = await walletService.estimateGas(tx, 'ethereum');
      
      expect(gasEstimate).toBeDefined();
      expect(gasEstimate.gasLimit).toBeDefined();
      expect(gasEstimate.gasPrice).toBeDefined();
      expect(gasEstimate.maxFeePerGas).toBeDefined();
      expect(gasEstimate.maxPriorityFeePerGas).toBeDefined();
      expect(gasEstimate.estimatedCost).toBeDefined();
    });

    it('should get current gas prices', async () => {
      const gasPrices = await walletService.getGasPrices('ethereum');
      
      expect(gasPrices).toBeDefined();
      expect(gasPrices.slow).toBeDefined();
      expect(gasPrices.standard).toBeDefined();
      expect(gasPrices.fast).toBeDefined();
      expect(gasPrices.instant).toBeDefined();
    });
  });

  describe('Cross-Chain Bridge Operations', () => {
    it('should get bridge routes', async () => {
      const routes = await bridgeService.getRoutes({
        fromChain: 'ethereum',
        toChain: 'avalanche',
        token: MOCK_TOKENS.ethereum.USDC.address,
        amount: ethers.parseUnits('100', 6)
      });

      expect(Array.isArray(routes)).toBe(true);
      routes.forEach(route => {
        expect(route).toHaveProperty('bridge');
        expect(route).toHaveProperty('fee');
        expect(route).toHaveProperty('estimatedTime');
        expect(route).toHaveProperty('steps');
      });
    });

    it('should initiate bridge transfer', async () => {
      const bridgeParams = {
        fromChain: 'ethereum',
        toChain: 'avalanche',
        token: MOCK_TOKENS.ethereum.USDC.address,
        amount: ethers.parseUnits('100', 6),
        recipient: mockWallet.address,
        route: 'hop'
      };

      const bridgeTx = await bridgeService.bridge(bridgeParams);
      
      expect(bridgeTx.transactionHash).toBeDefined();
      expect(bridgeTx.status).toBe('initiated');
      expect(bridgeTx.estimatedArrival).toBeDefined();
    });

    it('should track bridge transaction', async () => {
      const txHash = '0x123...';
      
      const status = await bridgeService.getTransactionStatus(txHash);
      
      expect(status).toBeDefined();
      expect(status.status).toBeDefined();
      expect(['pending', 'completed', 'failed']).toContain(status.status);
      
      if (status.status === 'completed') {
        expect(status.destinationTxHash).toBeDefined();
      }
    });

    it('should estimate bridge fees', async () => {
      const fees = await bridgeService.estimateFees({
        fromChain: 'ethereum',
        toChain: 'avalanche',
        token: MOCK_TOKENS.ethereum.USDC.address,
        amount: ethers.parseUnits('100', 6)
      });

      expect(fees).toBeDefined();
      expect(fees.bridgeFee).toBeDefined();
      expect(fees.gasFee).toBeDefined();
      expect(fees.totalFee).toBeDefined();
      expect(fees.estimatedReceived).toBeDefined();
    });
  });

  describe('Token Price and Market Data', () => {
    it('should get token prices', async () => {
      const prices = await tokenService.getTokenPrices([
        MOCK_TOKENS.ethereum.USDC.address,
        MOCK_TOKENS.ethereum.USDT.address
      ], 'ethereum');

      expect(prices).toBeDefined();
      Object.values(prices).forEach(price => {
        expect(price).toHaveProperty('usd');
        expect(price).toHaveProperty('change24h');
        expect(price).toHaveProperty('marketCap');
        expect(price).toHaveProperty('volume24h');
      });
    });

    it('should get price history', async () => {
      const history = await tokenService.getPriceHistory(
        MOCK_TOKENS.ethereum.USDC.address,
        'ethereum',
        '7d'
      );

      expect(Array.isArray(history)).toBe(true);
      history.forEach(point => {
        expect(point).toHaveProperty('timestamp');
        expect(point).toHaveProperty('price');
      });
    });

    it('should convert token amounts', async () => {
      const usdcAmount = ethers.parseUnits('100', 6);
      
      const converted = await tokenService.convertToken({
        fromToken: MOCK_TOKENS.ethereum.USDC.address,
        toToken: MOCK_TOKENS.ethereum.USDT.address,
        amount: usdcAmount,
        chain: 'ethereum'
      });

      expect(converted).toBeDefined();
      expect(converted.fromAmount).toBe(usdcAmount.toString());
      expect(converted.toAmount).toBeDefined();
      expect(converted.rate).toBeDefined();
    });
  });

  describe('Token Lists and Discovery', () => {
    it('should get popular tokens', async () => {
      const popularTokens = await tokenService.getPopularTokens('ethereum');
      
      expect(Array.isArray(popularTokens)).toBe(true);
      expect(popularTokens.length).toBeGreaterThan(0);
      
      popularTokens.forEach(token => {
        expect(token).toHaveProperty('address');
        expect(token).toHaveProperty('symbol');
        expect(token).toHaveProperty('name');
        expect(token).toHaveProperty('logoURI');
      });
    });

    it('should search for tokens', async () => {
      const searchResults = await tokenService.searchTokens('USDC');
      
      expect(Array.isArray(searchResults)).toBe(true);
      
      const usdcTokens = searchResults.filter(t => t.symbol === 'USDC');
      expect(usdcTokens.length).toBeGreaterThan(0);
    });

    it('should validate token contract', async () => {
      const isValid = await tokenService.isValidToken(
        MOCK_TOKENS.ethereum.USDC.address,
        'ethereum'
      );

      expect(isValid).toBe(true);
      
      const invalidToken = await tokenService.isValidToken(
        '0x0000000000000000000000000000000000000000',
        'ethereum'
      );
      
      expect(invalidToken).toBe(false);
    });

    it('should get token metadata', async () => {
      const metadata = await tokenService.getTokenMetadata(
        MOCK_TOKENS.ethereum.USDC.address,
        'ethereum'
      );

      expect(metadata).toBeDefined();
      expect(metadata.name).toBe('USD Coin');
      expect(metadata.symbol).toBe('USDC');
      expect(metadata.decimals).toBe(6);
      expect(metadata.totalSupply).toBeDefined();
    });
  });

  describe('Transaction History', () => {
    it('should get token transaction history', async () => {
      const history = await tokenService.getTokenTransactionHistory(
        mockWallet.address,
        MOCK_TOKENS.ethereum.USDC.address,
        'ethereum'
      );

      expect(Array.isArray(history)).toBe(true);
      history.forEach(tx => {
        expect(tx).toHaveProperty('hash');
        expect(tx).toHaveProperty('from');
        expect(tx).toHaveProperty('to');
        expect(tx).toHaveProperty('value');
        expect(tx).toHaveProperty('timestamp');
        expect(tx).toHaveProperty('tokenAddress');
      });
    });

    it('should filter transactions by type', async () => {
      const sent = await tokenService.getTransactionsByType(
        mockWallet.address,
        'sent'
      );
      
      expect(Array.isArray(sent)).toBe(true);
      sent.forEach(tx => {
        expect(tx.from.toLowerCase()).toBe(mockWallet.address.toLowerCase());
      });

      const received = await tokenService.getTransactionsByType(
        mockWallet.address,
        'received'
      );
      
      expect(Array.isArray(received)).toBe(true);
      received.forEach(tx => {
        expect(tx.to.toLowerCase()).toBe(mockWallet.address.toLowerCase());
      });
    });
  });

  describe('DeFi Integration', () => {
    it('should get DeFi positions', async () => {
      const positions = await tokenService.getDeFiPositions(mockWallet.address);
      
      expect(positions).toBeDefined();
      expect(positions).toHaveProperty('lending');
      expect(positions).toHaveProperty('liquidity');
      expect(positions).toHaveProperty('farming');
      expect(positions).toHaveProperty('totalValueLocked');
    });

    it('should calculate yield', async () => {
      const yieldInfo = await tokenService.calculateYield({
        protocol: 'aave',
        token: MOCK_TOKENS.ethereum.USDC.address,
        amount: ethers.parseUnits('1000', 6),
        duration: 365
      });

      expect(yieldInfo).toBeDefined();
      expect(yieldInfo.apy).toBeGreaterThan(0);
      expect(yieldInfo.estimatedRewards).toBeDefined();
    });
  });
});