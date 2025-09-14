# Configurable Test Environment Documentation

## Overview
This document explains how to use the configurable test environment for the Wallet module's critical test suites. These tests can run with either mock endpoints (for fast local testing) or real endpoints (for integration testing with deployed contracts).

## Critical Test Suites
The following test suites have been made configurable:
1. **OmniCoin Blockchain Tests** (`tests/core/blockchain/OmniCoin.test.ts`)
2. **Coin/Token Integration Tests** (`tests/integration/coin-token.test.ts`)
3. **Transaction Service Tests** (`tests/core/transaction/TransactionService.test.ts`)

## How to Run Tests

### Using Mock Endpoints (Default - Fast)
```bash
# Run all tests with mocks
npm test

# Run specific test suite
npm test -- OmniCoin.test.ts
npm test -- coin-token.test.ts
npm test -- TransactionService.test.ts
```

### Using Real Endpoints (Integration Testing)
```bash
# Set environment variable to use real endpoints
export USE_REAL_ENDPOINTS=true

# Configure endpoint URLs (optional, defaults provided)
export OMNICOIN_RPC_URL=http://localhost:8545
export VALIDATOR_URL=http://localhost:8090
export VALIDATOR_WS_URL=ws://localhost:8091
export IPFS_URL=http://localhost:5001

# Configure test accounts (optional, defaults provided)
export USER1_ADDRESS=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
export USER1_PRIVATE_KEY=0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
export USER1_USERNAME=alice.omnicoin

export USER2_ADDRESS=0x90F79bf6EB2c4f870365E785982E1f101E93b906
export USER2_PRIVATE_KEY=0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
export USER2_USERNAME=bob.omnicoin

# Run tests
npm test

# Or run in one line
USE_REAL_ENDPOINTS=true npm test
```

### Skip Tests if Real Endpoints Required
```bash
# Forces tests to skip if real endpoints are required but not available
export REQUIRE_REAL_ENDPOINTS=true
USE_REAL_ENDPOINTS=false npm test
```

## Configuration Files

### Test Environment (`tests/config/test-environment.ts`)
- Controls whether to use mock or real endpoints
- Provides test accounts with addresses and private keys
- Configures endpoint URLs
- Sets appropriate timeouts (30s for real, 5s for mock)

### Provider Factory (`tests/mocks/provider-factory.ts`)
- Creates mock providers with test methods
- Provides mock validator clients
- Creates mock contracts
- Handles conditional provider creation

## Test Accounts
The test environment provides these accounts:
- **Deployer**: `deployer.omnicoin` - Contract deployment account
- **User 1**: `alice.omnicoin` - Main test user with 100 XOM
- **User 2**: `bob.omnicoin` - Secondary user with 50 XOM  
- **Validator**: `validator.omnicoin` - Validator account with 10,000 XOM

Note: Usernames can be customized via environment variables for real endpoint testing.

## Adding New Configurable Tests

To make a new test configurable:

1. Import the test environment:
```typescript
import { testEnv } from '../config/test-environment';
import { TestProviderFactory, resetAllMocks } from '../mocks/provider-factory';
```

2. Conditionally apply mocks:
```typescript
if (!testEnv.isUsingRealEndpoints()) {
  jest.mock('../../../src/core/keyring/KeyringService');
}
```

3. Create providers based on environment:
```typescript
if (testEnv.isUsingRealEndpoints()) {
  provider = new ethers.JsonRpcProvider(endpoints.omnicoinRpc);
} else {
  provider = TestProviderFactory.createOmniCoinProvider();
}
```

4. Use conditional assertions:
```typescript
if (!testEnv.isUsingRealEndpoints()) {
  expect(balance).toBe(ethers.parseEther('100'));
} else {
  expect(balance).toBeDefined();
  expect(typeof balance).toBe('bigint');
}
```

5. Add timeout support:
```typescript
it('should do something', async () => {
  // test code
}, testEnv.getTestTimeout());
```

## Debugging Tips

1. **Check which mode is active**:
   ```bash
   # Add this to your test
   console.log('Using real endpoints:', testEnv.isUsingRealEndpoints());
   ```

2. **View test accounts**:
   ```bash
   # Add this to see account details
   console.log('Test accounts:', testEnv.getTestAccounts());
   ```

3. **Mock-specific debugging**:
   - Mocks are reset between tests with `resetAllMocks()`
   - Check mock call counts with `expect(mockFn).toHaveBeenCalledTimes(n)`
   - Verify mock arguments with `expect(mockFn).toHaveBeenCalledWith(...)`

4. **Real endpoint debugging**:
   - Ensure contracts are deployed at expected addresses
   - Check that test accounts have sufficient balance
   - Verify network connectivity to RPC endpoints

## Common Issues and Solutions

### Issue: Tests timing out
**Solution**: Increase timeout or check network connectivity
```typescript
// Increase timeout for specific test
it('slow test', async () => {
  // test code  
}, 60000); // 60 second timeout
```

### Issue: Mock not working as expected
**Solution**: Ensure mocks are applied conditionally
```typescript
if (!testEnv.isUsingRealEndpoints()) {
  // Apply mocks only in mock mode
}
```

### Issue: Real endpoint tests failing
**Solution**: Check that contracts are deployed and funded
```bash
# Verify contract deployment
cast code $OMNICOIN_CONTRACT_ADDRESS --rpc-url $OMNICOIN_RPC_URL

# Check account balance
cast balance $TEST_ACCOUNT --rpc-url $OMNICOIN_RPC_URL
```

## Next Steps for Integration Testing

1. **Deploy OmniCoin contracts** to local testnet or network
2. **Start validator nodes** with proper configuration
3. **Fund test accounts** with XOM tokens
4. **Run integration tests** with `USE_REAL_ENDPOINTS=true`
5. **Debug failures** using actual blockchain state

## Related Documentation
- [Wallet Module README](../README.md)
- [OmniCoin Integration Guide](../../Coin/docs/INTEGRATION.md)
- [Validator Setup Guide](../../Validator/docs/SETUP.md)