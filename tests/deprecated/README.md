# Deprecated Tests

This directory contains test files that have been superseded by newer, more comprehensive test suites.

## Why These Tests Were Deprecated

### validator-wallet.test.ts
- **Deprecated Date**: 2024
- **Reason**: Superseded by `integration/validator-oracle.test.ts`
- **What Changed**: 
  - The new test provides more comprehensive validator integration testing
  - Includes oracle services, KYC integration, and reputation scoring
  - Better alignment with current architecture
  - No longer uses vitest, standardized on Jest

### nft.test.ts
- **Deprecated Date**: 2024
- **Reason**: Superseded by `integration/nft-platform.test.ts`
- **What Changed**:
  - New test covers multi-chain NFT support
  - Includes minting, trading, metadata, and collections
  - Tests all NFT standards (ERC-721, ERC-1155, ERC-2981)
  - More comprehensive marketplace integration

### simple-minter.test.ts
- **Deprecated Date**: 2024
- **Reason**: Functionality absorbed into `integration/nft-platform.test.ts`
- **What Changed**:
  - Simple minting is now part of comprehensive NFT testing
  - Includes batch minting, lazy minting, and cross-chain minting
  - Better error handling and edge case coverage

## Retention Policy

These deprecated tests are kept for reference purposes:
- Historical context
- Migration reference
- Code archaeology
- Understanding evolution of testing approach

## Do Not Use

**Important**: These tests should NOT be run or included in any test suites. They may:
- Reference outdated APIs
- Use deprecated dependencies
- Test non-existent functionality
- Produce false positives/negatives

## Migration Guide

If you need to reference these tests:

1. **validator-wallet.test.ts** → See `integration/validator-oracle.test.ts`
2. **nft.test.ts** → See `integration/nft-platform.test.ts`
3. **simple-minter.test.ts** → See NFT minting section in `integration/nft-platform.test.ts`

## Cleanup Schedule

These files may be permanently deleted after:
- 6 months from deprecation date
- Successful production deployment with new tests
- Team consensus on removal

## Contact

For questions about deprecated tests or migration, consult:
- TEST_STRUCTURE.md in parent directory
- New integration test files
- Development team