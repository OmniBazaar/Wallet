# OmniBazaar Wallet Test Suite

Comprehensive test suite for the OmniBazaar multi-chain wallet covering all features, functions, and supported blockchains.

## Test Structure

```
tests/
├── setup.ts                    # Test utilities and mock data
├── jest.config.js             # Jest configuration
├── core/                      # Core functionality tests
│   ├── keyring/              # Keyring and account management
│   │   ├── BIP39Keyring.test.ts
│   │   └── KeyringService.test.ts
│   ├── providers/            # Blockchain provider tests
│   │   └── ProviderManager.test.ts
│   ├── chains/               # Chain-specific tests
│   │   └── solana/
│   │       └── provider.test.ts
│   ├── nft/                  # NFT functionality
│   │   ├── discovery.test.ts
│   │   └── NFTManager.test.ts
│   ├── payments/             # Payment routing
│   │   └── routing.test.ts
│   └── bridge/               # Cross-chain bridges
│       └── BridgeService.test.ts
└── integration/              # End-to-end integration tests
    └── cross-chain.test.ts
```

## Test Coverage

### 1. Keyring Tests (`core/keyring/`)
- **BIP39 mnemonic generation and validation**
- **Multi-chain key derivation (BIP44)**
- **Account creation for all chain types**
  - Ethereum (EVM)
  - Bitcoin (BIP84)
  - Solana (ed25519)
  - Substrate/Polkadot
- **Private key export formats**
- **Message and transaction signing**
- **Wallet lock/unlock with encryption**
- **Account recovery from mnemonic**

### 2. Provider Tests (`core/providers/`)
- **Multi-chain provider initialization**
- **Network switching (40+ networks)**
- **Balance operations**
- **Transaction sending**
- **Gas estimation**
- **Network information retrieval**
- **Event handling**

### 3. Chain-Specific Tests (`core/chains/`)
- **Solana Provider**
  - SOL transfers
  - SPL token operations
  - Token account discovery
  - Associated token account creation
  - Transaction fee estimation

### 4. NFT Tests (`core/nft/`)
- **Multi-chain NFT discovery (20+ chains)**
- **SimpleHash API integration**
- **Helius API for Solana NFTs**
- **Collection grouping**
- **NFT statistics and floor prices**
- **NFT search functionality**
- **Transfer operations**
- **Caching and performance**

### 5. Payment Routing Tests (`core/payments/`)
- **DePay-inspired route discovery**
- **Direct transfer detection**
- **Swap route finding**
- **Cross-chain bridge routes**
- **Multi-chain payment discovery**
- **Route execution**
- **Address validation**

### 6. Bridge Tests (`core/bridge/`)
- **Multi-bridge quote aggregation**
- **11+ bridge provider support**
  - Hop Protocol
  - Stargate
  - Across
  - Synapse
  - Celer
  - Wormhole
  - LayerZero
  - Native bridges
- **Bridge compatibility checking**
- **Transfer execution and monitoring**
- **Fee estimation**

### 7. Integration Tests (`integration/`)
- **End-to-end cross-chain scenarios**
- **Multi-chain account management**
- **Cross-chain NFT discovery**
- **Payment routing with bridges**
- **Chain switching**
- **Complex multi-hop transfers**
- **Concurrent operations**

## Running Tests

### Run all tests
```bash
npm test
```

### Run specific test suite
```bash
npm test -- BIP39Keyring.test.ts
npm test -- --testPathPattern=nft
npm test -- --testPathPattern=integration
```

### Run with coverage
```bash
npm test -- --coverage
```

### Run in watch mode
```bash
npm test -- --watch
```

### Run integration tests only
```bash
npm test -- --testPathPattern=integration
```

## Test Configuration

### Environment Setup
Tests use mock providers and API responses to ensure:
- Fast execution
- Deterministic results
- No external dependencies
- No real transactions

### Mock Data
- Test mnemonic: Consistent 12-word phrase
- Test addresses for each chain type
- Mock NFT data
- Mock token information
- Mock API responses

### Timeout Configuration
- Default: 30 seconds per test
- Adjustable in jest.config.js

## Coverage Requirements

Minimum coverage thresholds:
- Branches: 80%
- Functions: 80%
- Lines: 80%
- Statements: 80%

## Supported Chains Tested

### EVM Chains (15+)
- Ethereum, Polygon, Arbitrum, Optimism, Base
- BSC, Avalanche, Fantom, Celo, Moonbeam
- Aurora, Cronos, Gnosis, Klaytn, Metis

### Non-EVM Chains
- Bitcoin (mainnet, testnet)
- Solana (mainnet-beta, devnet, testnet)
- Substrate/Polkadot (polkadot, kusama, westend)

### Total: 40+ Networks

## Key Features Tested

1. **Multi-Chain Support**
   - Unified interface across all chains
   - Consistent address derivation
   - Chain-specific features

2. **NFT Ecosystem**
   - Discovery across 20+ chains
   - Multiple NFT standards
   - Real-time pricing
   - Spam filtering

3. **Payment Infrastructure**
   - Automatic route discovery
   - DEX integration ready
   - Bridge aggregation
   - Optimal path selection

4. **Security**
   - Encrypted vault storage
   - Secure key derivation
   - Password protection
   - No key exposure in tests

## Adding New Tests

When adding new features:
1. Create test file in appropriate directory
2. Import test utilities from `setup.ts`
3. Mock external dependencies
4. Test both success and error cases
5. Ensure coverage meets thresholds

## Continuous Integration

Tests are designed to run in CI/CD pipelines:
- No external API calls
- Deterministic results
- Fast execution
- Clear error reporting