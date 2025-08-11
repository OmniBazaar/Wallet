# Wallet Module Testing Guide

## Quick Reference

### Test Locations
- **Active Tests**: `/tests/`
- **Integration Tests**: `/tests/integration/`
- **Core Unit Tests**: `/tests/core/`
- **Deprecated Tests**: `/tests/deprecated/` (DO NOT USE)
- **Test Documentation**: `/tests/TEST_STRUCTURE.md`

## Running Tests

### Quick Commands
```bash
# Run all tests
npm test

# Run specific integration test suites
npm run test:database        # Database integration
npm run test:bazaar-ui       # Bazaar UI integration  
npm run test:nft-platform    # NFT platform integration
npm run test:coin-token      # Coin/token integration
npm run test:validator       # Validator/oracle integration
npm run test:keyring         # Keyring integration
npm run test:dex             # DEX integration
npm run test:cross-chain     # Cross-chain integration

# Run test categories
npm run test:integration     # All integration tests
npm run test:components      # All component tests
npm run test:pages          # All page tests
npm run test:core           # All core unit tests
npm run test:coverage       # With coverage report
```

## Test Structure Overview

### Integration Tests (Comprehensive)
Located in `/tests/integration/`:

1. **database.test.ts** - Database operations, encryption, sync
2. **bazaar-ui.test.ts** - Marketplace UI integration
3. **nft-platform.test.ts** - NFT minting, trading, standards
4. **coin-token.test.ts** - Token operations, bridging, DeFi
5. **validator-oracle.test.ts** - Validator nodes, oracles, KYC
6. **keyring.test.ts** - Key management, signing, hardware wallets
7. **dex-wallet.test.ts** - DEX operations, swaps, liquidity
8. **cross-chain.test.ts** - Multi-chain accounts and transfers

### Component Tests
Located in `/tests/components/`:

1. **WalletConnect.test.ts** - Wallet connection UI component
2. **TokenList.test.ts** - Token list display component
3. **NFTGallery.test.ts** - NFT gallery display component

### Page Tests
Located in `/tests/pages/`:

1. **Dashboard.test.ts** - Main dashboard page
2. **SwapPage.test.ts** - Token swap page

### Core Unit Tests
Located in `/tests/core/`:
- Bridge services
- Chain-specific providers
- Keyring implementations
- NFT management
- Payment routing
- Provider management

## Test Configuration

- **Jest Config**: `jest.config.js`
- **Test Setup**: `tests/setup.ts`
- **TypeScript Config**: `tsconfig.json`

## Coverage Requirements

- Minimum: 80% overall
- Critical paths: 100%
- Integration tests for all features
- Error handling coverage required

## Writing New Tests

1. Choose appropriate directory (integration vs core)
2. Follow naming: `*.test.ts`
3. Include setup/teardown
4. Update TEST_STRUCTURE.md
5. Add npm script if needed

## Deprecated Tests

Tests in `/tests/deprecated/` are obsolete and should NOT be used:
- `validator-wallet.test.ts` → Use `validator-oracle.test.ts`
- `nft.test.ts` → Use `nft-platform.test.ts`
- `simple-minter.test.ts` → Use `nft-platform.test.ts`

See `/tests/deprecated/README.md` for migration details.

## Troubleshooting

### Common Issues
1. **Tests not found**: Check path in jest.config.js
2. **Import errors**: Verify module mappings
3. **Timeout errors**: Increase timeout in jest.config.js
4. **Mock failures**: Check setup.ts configuration

### Debug Mode
```bash
# Run with verbose output
npm test -- --verbose

# Run single test file
npm test -- tests/integration/database.test.ts

# Run with debugging
node --inspect-brk ./node_modules/.bin/jest --runInBand
```

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Main branch commits
- Release builds
- Nightly builds

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up after tests
3. **Mocking**: Mock external services appropriately
4. **Assertions**: Use specific, meaningful assertions
5. **Documentation**: Comment complex test logic
6. **Performance**: Keep tests fast (<30s per suite)

## Support

For test-related questions:
1. Check TEST_STRUCTURE.md
2. Review existing test examples
3. Consult team documentation
4. Open issue if needed