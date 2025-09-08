# Wallet Module Implementation Instructions

**Date:** 2025-09-08
**Module Status:** 95% Complete (Frontend Ready, Backend Services Required)

## Overview

The Wallet module is nearly complete with all frontend features implemented. The remaining work involves integrating backend services and connecting to other OmniBazaar modules. This document provides detailed instructions for implementing the missing features.

## Critical Requirements

Before starting any implementation:

1. **FOLLOW CODING STANDARDS**
   - Read and follow `/home/rickc/OmniBazaar/TYPESCRIPT_CODING_STANDARDS.md`
   - Read and follow `/home/rickc/OmniBazaar/.claude/CLAUDE.md`
   - Use TypeScript strict mode - NO `any` types allowed
   - Write complete JSDoc for all exports
   - Run ESLint and fix all errors: `npm run lint`

2. **NO MOCKS OR STUBS**
   - Replace ALL TODO comments with actual implementations
   - Replace ALL placeholder implementations with real code
   - Do NOT use mock data or stub functions - implement real functionality

3. **INTEGRATION REQUIREMENTS**
   - Use YugabyteDB for all database operations (already configured)
   - Connect to Validator module for RPC operations
   - Import from Coin module for blockchain functionality
   - Reuse UI components from Bazaar module where appropriate

## 1. Authentication Backend Services

### Location
Create new directory: `/home/rickc/OmniBazaar/Wallet/src/services/auth/`

### Required Implementations

#### 1.1 OAuth Provider Service

```typescript
// File: src/services/auth/OAuthService.ts
// Imports needed:
import { EmailProvider } from '/home/rickc/OmniBazaar/Validator/src/services/providers/EmailProvider';
import { SMSProvider } from '/home/rickc/OmniBazaar/Validator/src/services/providers/SMSProvider';
import { UserRegistryDatabase } from '/home/rickc/OmniBazaar/Validator/src/database/UserRegistryDatabase';
```

**Requirements:**
- Implement OAuth2 flow for Google, Twitter, GitHub
- Store user sessions in YugabyteDB
- Generate MPC key shards (device, server, recovery)
- Use HMAC-SHA256 for API authentication

#### 1.2 OTP Verification Service

```typescript
// File: src/services/auth/OTPService.ts
// Imports needed:
import { SMSProvider } from '/home/rickc/OmniBazaar/Validator/src/services/providers/SMSProvider';
import { EmailProvider } from '/home/rickc/OmniBazaar/Validator/src/services/providers/EmailProvider';
import { SecureStorageService } from '/home/rickc/OmniBazaar/Validator/src/services/SecureStorageService';
```

**Requirements:**
- Generate 6-digit OTP codes
- Send via SMS/Email using provider abstraction
- Store OTP attempts in YugabyteDB with rate limiting
- 5-minute expiration, max 3 attempts

#### 1.3 Session Management Service

```typescript
// File: src/services/auth/SessionService.ts
// Imports needed:
import { CacheService } from '/home/rickc/OmniBazaar/Validator/src/services/CacheService';
import { SecureStorageService } from '/home/rickc/OmniBazaar/Validator/src/services/SecureStorageService';
```

**Requirements:**
- JWT token generation with 24-hour expiration
- Refresh token mechanism (7-day expiration)
- Session storage in distributed cache
- Device fingerprinting for security

## 2. MPC Key Management

### Location
Update existing: `/home/rickc/OmniBazaar/Wallet/src/core/keyring/`

### Required Implementations

#### 2.1 MPC Key Shard Coordination

```typescript
// File: src/core/keyring/MPCKeyManager.ts
// Imports needed:
import { SecureStorageService } from '/home/rickc/OmniBazaar/Validator/src/services/SecureStorageService';
import { RecoveryService } from '/home/rickc/OmniBazaar/Validator/src/services/RecoveryService';
```

**Requirements:**
- Split private keys into 3 shards (2-of-3 threshold)
- Store device shard in browser localStorage
- Store server shard in YugabyteDB (encrypted)
- Generate recovery shard for user backup
- Implement Shamir's Secret Sharing

## 3. DEX Integration Features

### Location
Update existing: `/home/rickc/OmniBazaar/Wallet/src/services/`

### Required Implementations

#### 3.1 Complete SwapService Methods

```typescript
// Update: src/services/SwapService.ts
// Imports needed:
import { DEXService } from '/home/rickc/OmniBazaar/Validator/src/services/DEXService';
import { DecentralizedOrderBook } from '/home/rickc/OmniBazaar/Validator/src/services/dex/DecentralizedOrderBook';
import { SwapCalculator } from '/home/rickc/OmniBazaar/Validator/src/services/dex/amm/SwapCalculator';
import { HybridRouter } from '/home/rickc/OmniBazaar/Validator/src/services/dex/amm/HybridRouter';
```

**Implement these missing methods:**
- `executeMultiHopSwap()` - Use HybridRouter for complex swaps
- `findBestRoute()` - Query DecentralizedOrderBook and AMM pools
- `calculatePriceImpact()` - Use SwapCalculator for accurate calculations
- `signPermit()` - EIP-2612 permit signature generation

#### 3.2 Liquidity Pool Management

```typescript
// Create: src/services/LiquidityService.ts
// Imports needed:
import { LiquidityPoolManager } from '/home/rickc/OmniBazaar/Validator/src/services/dex/amm/LiquidityPoolManager';
import { AMMIntegration } from '/home/rickc/OmniBazaar/Validator/src/services/dex/amm/AMMIntegration';
```

**Implement:**
- `addLiquidity()` - Add tokens to Uniswap V3 style pools
- `removeLiquidity()` - Remove liquidity with proper slippage
- `getPosition()` - Query user's LP positions
- `calculateImpermanentLoss()` - IL calculations
- `harvestRewards()` - Claim LP rewards
- `getPoolAnalytics()` - APY, volume, TVL data

#### 3.3 Order Book Integration

```typescript
// Create: src/services/OrderBookService.ts
// Imports needed:
import { DecentralizedOrderBook } from '/home/rickc/OmniBazaar/Validator/src/services/dex/DecentralizedOrderBook';
import { MEVProtection } from '/home/rickc/OmniBazaar/Validator/src/services/dex/mev/MEVProtection';
```

**Implement:**
- `placeLimitOrder()` - Submit orders to off-chain order book
- `cancelOrder()` - Cancel pending orders
- `getUserOrders()` - Query user's open orders
- `fillOrder()` - Execute order matching
- `getOrderBookDepth()` - Get bid/ask depth data

## 4. Cross-Chain Bridge Integration

### Location
Update existing: `/home/rickc/OmniBazaar/Wallet/src/core/bridge/`

### Required Implementations

#### 4.1 Bridge Provider Integration

```typescript
// Update: src/core/bridge/BridgeService.ts
// Imports needed:
import { CrossChainBridge } from '/home/rickc/OmniBazaar/Validator/src/services/dex/crosschain/CrossChainBridge';
import { OmniOracleService } from '/home/rickc/OmniBazaar/Coin/src/services/OmniOracleService';
```

**Replace mock implementations with:**
- Real bridge API integrations (Hop, Stargate, Across)
- Actual fee calculations from bridge providers
- Real-time quote aggregation
- Transaction monitoring via bridge APIs

#### 4.2 Cross-Chain Swap Support

```typescript
// Create: src/services/CrossChainSwapService.ts
// Imports needed:
import { CrossChainBridge } from '/home/rickc/OmniBazaar/Validator/src/services/dex/crosschain/CrossChainBridge';
import { HybridRouter } from '/home/rickc/OmniBazaar/Validator/src/services/dex/amm/HybridRouter';
```

**Implement:**
- Bridge + Swap in single transaction
- Cross-chain route optimization
- Multi-chain balance aggregation

## 5. Token Price Oracle Integration

### Location
Create new: `/home/rickc/OmniBazaar/Wallet/src/services/oracle/`

### Required Implementations

#### 5.1 Price Feed Service

```typescript
// Create: src/services/oracle/PriceFeedService.ts
// Imports needed:
import { PriceOracleService } from '/home/rickc/OmniBazaar/Validator/src/services/PriceOracleService';
import { OracleAggregator } from '/home/rickc/OmniBazaar/Validator/src/services/dex/oracles/OracleAggregator';
import { OmniOracleService } from '/home/rickc/OmniBazaar/Coin/src/services/OmniOracleService';
```

**Requirements:**
- Aggregate prices from multiple oracles
- Cache prices with 30-second TTL
- Fallback mechanism for oracle failures
- Support for XOM/pXOM pricing

## 6. NFT Features Completion

### Location
Update existing: `/home/rickc/OmniBazaar/Wallet/src/core/nft/`

### Required Implementations

#### 6.1 Replace Placeholder NFT Utils

```typescript
// Update: src/utils/nft.ts
// Imports needed:
import { NFTManager } from '/home/rickc/OmniBazaar/Bazaar/src/services/nft/NFTManager';
import { NFTService } from '/home/rickc/OmniBazaar/Bazaar/src/services/nft/NFTService';
```

**Replace ALL placeholder functions with real implementations**

#### 6.2 Gallery and Collection Support

```typescript
// Update: src/core/nft/galleryNfts.ts
// Update: src/core/nft/nftsForCollection.ts
// Imports needed:
import { MarketplaceService } from '/home/rickc/OmniBazaar/Bazaar/src/services/MarketplaceService';
```

**Implement:**
- Actual NFT fetching from blockchain
- Collection metadata resolution
- IPFS gateway integration
- Pagination and lazy loading

## 7. Validator RPC Integration

### Location
Update existing: `/home/rickc/OmniBazaar/Wallet/src/core/providers/`

### Required Implementations

#### 7.1 Complete OmniProvider

```typescript
// Update: src/core/providers/OmniProvider.ts
// Imports needed:
import { OmniWalletService } from '/home/rickc/OmniBazaar/Validator/src/services/OmniWalletService';
import { LoadBalancerService } from '/home/rickc/OmniBazaar/Validator/src/services/LoadBalancerService';
```

**Requirements:**
- Connect to actual validator network
- Implement load balancing across validators
- Add request authentication (HMAC-SHA256)
- Handle validator failover

## 8. Legacy Migration Features

### Location
Update existing: `/home/rickc/OmniBazaar/Wallet/src/components/migration/`

### Required Implementations

#### 8.1 Migration Backend

```typescript
// Create: src/services/migration/MigrationService.ts
// Imports needed:
import { MigrationProofVerifier } from '/home/rickc/OmniBazaar/Coin/contracts/migration/MigrationProofVerifier.sol';
import { LegacyOmniCoinMigration } from '/home/rickc/OmniBazaar/Coin/contracts/migration/LegacyOmniCoinMigration.sol';
```

**Requirements:**
- Verify legacy user signatures
- Submit migration proofs to smart contract
- Track migration status in YugabyteDB
- Handle vesting schedules

## 9. Privacy Features (XOM ↔ pXOM)

### Location
Create new: `/home/rickc/OmniBazaar/Wallet/src/services/privacy/`

### Required Implementations

#### 9.1 Privacy Token Service

```typescript
// Create: src/services/privacy/PrivacyTokenService.ts
// Imports needed:
import { COTIPrivacyService } from '/home/rickc/OmniBazaar/Validator/src/services/privacy/COTIPrivacyService';
import { PrivacyService } from '/home/rickc/OmniBazaar/Validator/src/services/PrivacyService';
import { AvalancheWarpMessaging } from '/home/rickc/OmniBazaar/Validator/src/avalanche/AvalancheWarpMessaging';
```

**Implement:**
- XOM to pXOM conversion UI backend
- Garbled Circuits integration
- Cross-subnet messaging via AWM
- Privacy fee calculations

## 10. Staking Integration

### Location
Update existing: `/home/rickc/OmniBazaar/Wallet/src/services/`

### Required Implementations

#### 10.1 Complete Staking Features

```typescript
// Update: src/services/StakingService.ts (if exists) or create new
// Imports needed:
import { StakingService } from '/home/rickc/OmniBazaar/Validator/src/services/StakingService';
import { StakingEngine } from '/home/rickc/OmniBazaar/Validator/src/engines/OmniStakingEngine';
import { OmniStaking } from '/home/rickc/OmniBazaar/Coin/contracts/staking/OmniStaking.sol';
```

**Implement:**
- Real staking contract interactions
- APY calculations from StakingEngine
- Reward claiming functionality
- Delegation management

## Database Schema Requirements

All services should use YugabyteDB with these collections:

```sql
-- User authentication
CREATE TABLE wallet_users (
    id UUID PRIMARY KEY,
    email VARCHAR(255),
    phone VARCHAR(50),
    oauth_provider VARCHAR(50),
    oauth_id VARCHAR(255),
    created_at TIMESTAMP,
    last_login TIMESTAMP
);

-- MPC key shards
CREATE TABLE key_shards (
    user_id UUID,
    shard_type VARCHAR(20), -- 'server', 'recovery'
    encrypted_shard TEXT,
    created_at TIMESTAMP,
    PRIMARY KEY (user_id, shard_type)
);

-- Sessions
CREATE TABLE user_sessions (
    token_id UUID PRIMARY KEY,
    user_id UUID,
    refresh_token TEXT,
    device_fingerprint TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP
);

-- Migration tracking
CREATE TABLE legacy_migrations (
    legacy_address VARCHAR(42) PRIMARY KEY,
    new_address VARCHAR(42),
    amount VARCHAR(80),
    vesting_schedule JSONB,
    claimed BOOLEAN DEFAULT FALSE,
    claim_tx_hash VARCHAR(66),
    created_at TIMESTAMP
);
```

## Testing Requirements

1. **Unit Tests**: Write tests for all new services
2. **Integration Tests**: Test cross-module communication
3. **E2E Tests**: Test complete user flows
4. **Load Tests**: Ensure services can handle 10,000+ concurrent users

## Performance Requirements

1. **RPC Calls**: < 100ms average response time
2. **Database Queries**: Use indexes, < 50ms per query
3. **Cache Hit Rate**: > 80% for price data
4. **Session Creation**: < 500ms including MPC shard generation

## Security Requirements

1. **API Authentication**: All backend APIs must use HMAC-SHA256
2. **Key Storage**: Use AES-256-GCM for encrypting key shards
3. **Rate Limiting**: Implement on all public endpoints
4. **Input Validation**: Sanitize all user inputs
5. **CORS Policy**: Restrict to authorized domains only

## Deployment Checklist

Before marking complete:

- [ ] All TODO comments removed and replaced with implementations
- [ ] All placeholder functions replaced with real code
- [ ] All tests passing (npm test)
- [ ] Zero ESLint errors (npm run lint)
- [ ] Zero TypeScript errors (npm run typecheck)
- [ ] Database migrations created
- [ ] API documentation updated
- [ ] Performance benchmarks met
- [ ] Security audit passed

## Getting Started

1. **Set up YugabyteDB connection**:

   ```typescript
   // Use existing connection from Validator module
   import { Database } from '/home/rickc/OmniBazaar/Validator/src/database/Database';
   ```

2. **Import shared types**:

   ```typescript
   // OmniCoin types
   import { ChainType } from '/home/rickc/OmniBazaar/Coin/src/types';

   // Marketplace types
   import { NFTMetadata } from '/home/rickc/OmniBazaar/Bazaar/src/types/nft';
   ```

3. **Follow the module integration pattern**:
   - Validator module provides backend services
   - Coin module provides blockchain functionality
   - Bazaar module provides UI components
   - Wallet orchestrates everything for the user

## Questions or Issues

If you encounter any issues:
1. Check the module's TODO.md for known issues
2. Review the CURRENT_STATUS.md for recent changes
3. Ensure all module dependencies are installed
4. Verify YugabyteDB is running and accessible

Remember: NO SHORTCUTS. Implement everything properly according to the coding standards.
