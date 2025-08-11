# Wallet Test Structure Documentation

## Overview
This document describes the organization and location of all test files in the Wallet module.

## Current Active Tests

### Integration Tests (`/tests/integration/`)
These are the primary comprehensive test suites that test full integration scenarios:

1. **database.test.ts**
   - Database operations and encryption
   - Transaction history storage
   - NFT metadata caching
   - Database synchronization
   - Backup and recovery

2. **bazaar-ui.test.ts**
   - Wallet connection to Bazaar marketplace
   - Listing creation and management
   - Purchase flow integration
   - User profile synchronization
   - UI component integration

3. **nft-platform.test.ts**
   - NFT minting and trading
   - Multi-chain NFT support (Ethereum, Avalanche, Polygon)
   - NFT metadata and IPFS integration
   - Collections and analytics
   - ERC-721, ERC-1155, ERC-2981 standards

4. **coin-token.test.ts**
   - XOM (OmniCoin) operations
   - Multi-chain token support
   - ERC-20 token operations
   - Cross-chain bridge operations
   - DeFi integration

5. **validator-oracle.test.ts**
   - Validator node operations
   - Oracle price feeds
   - KYC oracle integration
   - Reputation scoring
   - ENS resolution

6. **keyring.test.ts**
   - Keyring creation and management
   - Security and encryption
   - Message and transaction signing
   - Hardware wallet integration
   - Biometric authentication

7. **dex-wallet.test.ts**
   - Token swapping
   - Liquidity provision
   - Limit orders
   - DEX aggregation
   - Yield farming

8. **cross-chain.test.ts** (existing)
   - Multi-chain account creation
   - Cross-chain transfers
   - Bridge operations
   - Chain-specific features

### Component Tests (`/tests/components/`)
UI component unit tests:

1. **WalletConnect.test.ts**
   - Wallet connection UI
   - Network switching
   - Balance display
   - Account menu
   - Multi-wallet support

2. **TokenList.test.ts**
   - Token display and filtering
   - Sorting and searching
   - Token actions (send, receive, swap)
   - Loading and error states

3. **NFTGallery.test.ts**
   - NFT grid/list display
   - Filtering and searching
   - NFT actions (list, transfer)
   - Bulk operations
   - NFT details modal

### Page Tests (`/tests/pages/`)
Full page component tests:

1. **Dashboard.test.ts**
   - Portfolio overview
   - Quick actions
   - Recent activity
   - Token and NFT summaries
   - Notifications

2. **SwapPage.test.ts**
   - Swap interface
   - Quote calculation
   - Slippage settings
   - Swap execution
   - Transaction history

### Core Unit Tests (`/tests/core/`)
Lower-level unit tests for core functionality:

#### Bridge Tests (`/core/bridge/`)
- **BridgeService.test.ts** - Bridge service functionality

#### Chain-Specific Tests (`/core/chains/`)
- **solana/provider.test.ts** - Solana provider implementation

#### Keyring Tests (`/core/keyring/`)
- **BIP39Keyring.test.ts** - BIP39 mnemonic keyring
- **KeyringService.test.ts** - Keyring service operations

#### NFT Tests (`/core/nft/`)
- **discovery.test.ts** - NFT discovery mechanisms
- **NFTManager.test.ts** - NFT management operations

#### Payment Tests (`/core/payments/`)
- **routing.test.ts** - Payment routing logic

#### Provider Tests (`/core/providers/`)
- **ProviderManager.test.ts** - Provider management

### Deprecated Tests (`/tests/deprecated/`)
Tests that have been superseded or are no longer maintained:

1. **validator-wallet.test.ts**
   - Old validator integration (superseded by validator-oracle.test.ts)
   
2. **nft.test.ts**
   - Old NFT unit tests (superseded by nft-platform.test.ts)
   
3. **simple-minter.test.ts**
   - Basic minting tests (superseded by comprehensive NFT tests)

## Test Organization Principles

### Integration Tests
- Located in `/tests/integration/`
- Test complete workflows and integrations
- Can be run individually or as a suite
- Include setup and teardown procedures
- Test real-world scenarios

### Core Unit Tests
- Located in `/tests/core/`
- Test individual components in isolation
- Fast execution
- Focused on specific functionality
- Minimal external dependencies

### Test Utilities
- **setup.ts** - Global test setup and utilities
- **test-utils.tsx** - React testing utilities (if created)
- Mock data and fixtures

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Integration Tests Only
```bash
npm run test:integration
```

### Run Specific Integration Test
```bash
npm run test:database        # Database integration
npm run test:bazaar-ui       # Bazaar UI integration
npm run test:nft-platform    # NFT platform integration
npm run test:coin-token      # Coin/token integration
npm run test:validator       # Validator/oracle integration
npm run test:keyring         # Keyring integration
npm run test:dex             # DEX integration
```

### Run Core Unit Tests
```bash
npm run test:core
```

### Run With Coverage
```bash
npm run test:coverage
```

## Test Configuration Files

- **jest.config.js** - Jest configuration
- **setup.ts** - Test environment setup
- **tsconfig.json** - TypeScript configuration for tests

## Mocking Strategy

### Browser APIs
- Chrome extension APIs
- Web3 providers
- IndexedDB
- LocalStorage

### External Services
- IPFS
- ENS
- Price oracles
- Validator nodes

### Blockchain Interactions
- Transaction signing
- Smart contract calls
- Gas estimation
- Network switching

## Coverage Requirements

- Minimum 80% code coverage
- Critical paths must have 100% coverage
- Integration tests for all major features
- Error handling must be tested

## Adding New Tests

1. Determine if test is integration or unit
2. Place in appropriate directory
3. Follow naming convention: `*.test.ts`
4. Include proper setup/teardown
5. Update this documentation
6. Add test script to package.json if needed

## Maintenance

- Review and update tests when features change
- Move outdated tests to `/tests/deprecated/`
- Keep documentation current
- Run full test suite before releases
- Monitor test execution time

## CI/CD Integration

Tests are run automatically on:
- Pull requests
- Commits to main branch
- Release builds
- Nightly builds

## Contact

For questions about tests, consult:
- This documentation
- Test files themselves (well-commented)
- Project README.md
- CONTRIBUTING.md