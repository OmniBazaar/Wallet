# Integration Testing Guide

## Overview

This guide documents the integration testing setup for the Wallet module, including how tests interact with real services from the Validator module.

## Test Environment Setup

### Prerequisites

1. **Hardhat Local Blockchain**: Tests require a running Hardhat EVM instance on port 8545
2. **Test Validator**: The Validator module provides backend services including:
   - YugabyteDB for server-side storage
   - Helia IPFS for distributed storage
   - GraphQL API endpoints
   - WebSocket connections

### Starting the Test Environment

1. Start Hardhat (from Coin module):
   ```bash
   cd ../Coin
   npx hardhat node
   ```

2. Deploy contracts (from Coin module):
   ```bash
   npx hardhat run scripts/deploy-all.ts --network localhost
   ```

3. Start Test Validator (from Validator module):
   ```bash
   cd ../Validator
   NODE_ENV=test npx ts-node tests/integration/start-test-validator.ts
   ```

## Integration Test Configuration

### Real Services vs Mocks

As of the latest update, integration tests use **real service implementations** instead of mocks:

- ✅ **WalletService**: Real implementation with full keyring integration
- ✅ **WalletDatabase**: Real IndexedDB-based storage
- ✅ **TransactionDatabase**: Real transaction storage service
- ✅ **NFTDatabase**: Real NFT storage service

The following are still mocked for isolated testing:
- External blockchain providers (ethers, @polkadot/api, @solana/web3.js)
- External token contracts (for predictable test behavior)

### Key Test Files

1. **service-integration.test.ts**: Main integration test suite
   - Tests coordination between WalletService, KeyringService, TransactionService, NFTService, and DEXService
   - Validates database consistency across services
   - Tests event coordination and service lifecycle

2. **Database Storage**:
   - **Browser-side (IndexedDB)**: WalletDatabase, TransactionDatabase, NFTDatabase
   - **Server-side (YugabyteDB via Validator)**: User profiles, KYC data, transaction history

## Running Integration Tests

### Run specific integration test:
```bash
npm test tests/integration/service-integration.test.ts
```

### Run all integration tests:
```bash
npm test tests/integration/
```

## Test Results Summary

Current status of key integration tests:
- ✅ **service-integration.test.ts**: All tests passing (8 passed, 4 skipped)
- ✅ **cross-chain-validation.test.ts**: Passing
- ✅ **browser-extension.test.ts**: Passing
- ✅ **database.test.ts**: Passing

## Architecture Notes

### Service Communication

The Wallet module communicates with the Validator module through:
1. **OmniValidatorClient API**: REST/GraphQL endpoints for blockchain operations
2. **WebSocket connections**: Real-time updates and subscriptions
3. **Direct service access**: For testing, services can be accessed directly

### Database Architecture

1. **Client-side Storage (Wallet)**:
   - Uses IndexedDB for browser-based storage
   - Stores wallet accounts, preferences, and cached data
   - Survives browser restarts but is device-specific

2. **Server-side Storage (Validator)**:
   - Uses YugabyteDB for distributed SQL storage
   - Stores cross-device user data, transaction history, KYC info
   - Provides consistency across all user devices

## Troubleshooting

### Common Issues

1. **"walletDB.clear is not a function"**
   - Ensure you're not using mocked databases
   - Check jest.config.js moduleNameMapper doesn't override database imports

2. **"Cannot read properties of undefined"**
   - Verify services are properly initialized before use
   - Check that required environment variables are set

3. **Connection failures**
   - Ensure Hardhat is running on port 8545
   - Verify test validator is running on port 8090
   - Check no firewall blocking localhost connections

## Future Improvements

1. **Complete Mock Removal**: Continue removing remaining mocks for external providers
2. **Real IPFS Integration**: Use Validator's Helia IPFS service instead of mocks
3. **Cross-module Testing**: Add tests that span Wallet, Bazaar, and DEX modules
4. **Performance Testing**: Add benchmarks for database operations and API calls