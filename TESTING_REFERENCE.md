# Testing Reference

**Last Updated:** 2025-10-05 10:26 UTC
**Purpose:** Complete testing guide for Wallet module

---

## Quick Start

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Specific test file
npx jest tests/services/WalletService.test.ts
```

---

## Test Structure

```text
tests/
├── core/                  # Core functionality
│   ├── keyring/          # BIP39, KeyringService
│   ├── wallet/           # Wallet class
│   ├── chains/           # Bitcoin, Solana, EVM, Substrate
│   └── providers/        # Provider managers
├── services/             # Service layer tests
├── hooks/                # React hooks
├── components/           # UI components
├── integration/          # Cross-service tests
├── e2e/                  # End-to-end workflows
├── security/             # Security infrastructure
└── error-handling/       # Edge cases
```

---

## Test Categories

### Unit Tests
- Services: WalletService, TokenService, NFTService
- Core: BIP39Keyring, KeyringService, Wallet
- Hooks: useWallet, useTokenBalance
- Components: WalletModal, TokenBalance

### Integration Tests
- Service coordination (WalletService ↔ KeyringService)
- Database integration
- Browser extension communication
- Multi-chain operations

### E2E Tests
- Complete user workflows
- Multi-chain asset management
- DEX trading flows
- NFT management
- Emergency recovery

### Security Tests
- BIP-39 seed phrase security
- Key derivation security
- Encryption (AES-256-GCM)
- Hardware wallet simulation
- Biometric authentication
- Transaction validation
- Anti-phishing protection

### Performance Tests
- High-frequency operations
- Large NFT collections (1000+)
- Concurrent workflows
- Memory management

---

## Configuration

**jest.config.js** - Configured for TypeScript
- ts-jest transformer
- Module path aliases
- Coverage thresholds: 80%
- Test environment: jsdom (for browser APIs)

**Test Utilities:**
- Mock providers (Ethereum, Bitcoin, Solana)
- Mock hardware wallets (Ledger, Trezor)
- Mock IndexedDB
- Mock WebAuthn
- Test data generators

---

## Writing Tests

### Service Tests

```typescript
import { WalletService } from '@/services/WalletService';

describe('WalletService', () => {
  it('should create wallet', async () => {
    const wallet = await walletService.createWallet('password123');
    expect(wallet.mnemonic).toBeDefined();
  });
});
```

### Component Tests

```typescript
import { render, screen } from '@testing-library/react';
import { WalletModal } from '@/components/WalletModal';

describe('WalletModal', () => {
  it('should render', () => {
    render(<WalletModal />);
    expect(screen.getByText('Wallet')).toBeInTheDocument();
  });
});
```

### Integration Tests

```typescript
describe('Multi-service integration', () => {
  it('should coordinate wallet and transaction services', async () => {
    const tx = await walletService.sendTransaction({...});
    expect(tx.hash).toBeDefined();
  });
});
```

---

## Test Priorities

### Critical (Must Pass for Production)
- BIP39 mnemonic generation and validation
- Key derivation across all chains
- Encryption/decryption with AES-256-GCM
- Transaction signing security
- Hardware wallet integration
- Balance accuracy across chains

### High Priority
- Multi-chain operations
- NFT functionality
- DEX integration
- Browser extension APIs
- Database persistence

### Medium Priority
- UI component rendering
- Error message accuracy
- Performance benchmarks

---

## Configurable Tests

Some tests can be configured via environment variables:

```bash
# Skip long-running tests
SKIP_SLOW_TESTS=true npm test

# Use real blockchain providers (not mocks)
USE_REAL_PROVIDERS=true npm test

# Enable detailed logging
DEBUG_TESTS=true npm test
```

---

## Common Issues

**Issue:** Tests timing out
- Increase timeout: `jest.setTimeout(30000)`
- Check for unclosed connections

**Issue:** Mock not working
- Verify mock setup in jest.config.js
- Check mock file path

**Issue:** IndexedDB errors
- Use fake-indexeddb mock
- Clear database between tests

**Issue:** WebAuthn not available
- Mock navigator.credentials
- Check test environment setup

---

## Coverage Goals

**Current:**
- Services: ~95%
- Core: ~90%
- Hooks: ~85%
- Components: ~70%

**Target for Production:**
- All critical paths: 100%
- Services: 95%+
- Overall: 90%+

---

## Test Results Archive

Historical test results available in: `tests/TEST_RESULTS_ARCHIVE.md`

---

**See Also:**
- tests/TEST_INFRASTRUCTURE_SUMMARY.md - Infrastructure details
- SECURITY_REFERENCE.md - Security testing
