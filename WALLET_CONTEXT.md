# Wallet Module - AI Context Document

**Purpose:** Comprehensive context for AI assistants working on the Wallet module
**Last Updated:** 2025-10-05 10:33 UTC
**Location:** `/home/rickc/OmniBazaar/Wallet/`

---

## MODULE FUNCTION

The Wallet module is a **multi-chain browser extension wallet** for OmniBazaar:
- **70+ blockchain support** - Ethereum, Bitcoin, Solana, Polkadot, Avalanche, and more
- **Browser extension** - Manifest v3 for Chrome/Firefox
- **Embedded in WebApp** - Can be used within OmniBazaar web interface
- **NFT marketplace integration** - Mint listings as NFTs, display cross-chain NFTs
- **DEX integration** - Trading, swaps, liquidity provision
- **Legacy migration** - Import balances from OmniCoin v1

**Key Innovation:** Zero-gas ENS resolution via `username.omnicoin` addresses

---

## CRITICAL ARCHITECTURE

### Hybrid Design

**Sources:** Best features from 4 reference wallets
1. **Enkrypt** - Multi-chain foundation
2. **Rainbow** - UX patterns
3. **Frame** - Security model
4. **DePay** - Payment integration

**Reference Code:** `/home/rickc/OmniBazaar/Wallet/source-repos` - Use this extensively!

### Core Components

**1. Keyring System**
- `src/core/keyring/BIP39Keyring.ts` - HD wallet (BIP39/BIP44)
- `src/core/keyring/KeyringService.ts` - Key management
- AES-256-GCM encryption with PBKDF2 (100,000 iterations)
- Secure memory wipe after use

**2. Provider System**
- `src/core/providers/ProviderManager.ts` - Unified multi-chain provider
- Chain-specific providers in `src/core/chains/*/`
- Multi-RPC fallback, health monitoring

**3. Wallet Core**
- `src/core/wallet/Wallet.ts` - Main wallet class
- Multi-account management
- Transaction signing
- Balance tracking

**4. Browser Extension**
- `src/background/background.ts` - Service worker
- `src/content/content-script.ts` - Web page injection
- `src/popup/` - Extension popup UI
- Manifest v3 compliant

---

## DIRECTORY STRUCTURE

```text
src/
├── background/               # Extension service worker
├── content/                  # Content script (web page injection)
├── popup/                    # Extension popup UI
│
├── core/                     # Core wallet engine
│   ├── wallet/              # Wallet class
│   ├── keyring/             # BIP39, KeyringService
│   ├── chains/              # Chain-specific code
│   │   ├── bitcoin/         # Bitcoin support
│   │   ├── evm/             # EVM chains (20+)
│   │   ├── solana/          # Solana support
│   │   └── polkadot/        # Substrate chains
│   ├── providers/           # ProviderManager
│   ├── bridge/              # Cross-chain bridges
│   ├── nft/                 # NFT operations
│   ├── hardware/            # Hardware wallet integration
│   │   ├── ledger/          # Ledger support
│   │   └── trezor/          # Trezor support
│   └── storage/             # IndexedDB, encryption
│
├── services/                 # Business logic services
│   ├── WalletService.ts     # Main wallet service
│   ├── NFTService.ts        # NFT operations
│   ├── DEXService.ts        # DEX trading
│   ├── TokenService.ts      # Token management
│   ├── BridgeService.ts     # Cross-chain bridges
│   ├── BiometricService.ts  # WebAuthn biometric
│   ├── EncryptionService.ts # AES-256-GCM
│   └── BackupService.ts     # Backup/restore
│
├── components/               # UI components
├── pages/                    # Extension pages
├── hooks/                    # React hooks
├── stores/                   # State management (Zustand)
├── types/                    # TypeScript types
└── utils/                    # Utilities
```

**Config:** `manifest/`, `vite.config.ts`, `tsconfig.json`
**Tests:** `tests/` (Jest)
**Reference:** `DePay/` - Working implementations
**Static:** `static/` - Extension assets

---

## BLOCKCHAIN SUPPORT (70+ Chains)

### EVM Chains (20+)

**Tier 1:** Ethereum, Arbitrum, Optimism, Base, Polygon, Avalanche
**Tier 2:** BSC, Fantom, Gnosis, Moonbeam, Aurora, Celo, Harmony, Cronos
**Tier 3:** zkSync, Linea, Scroll, Metis, World Chain
**Testnets:** Sepolia, Arbitrum Sepolia, Optimism Sepolia, Base Sepolia, Mumbai

**Implementation:** `src/core/chains/evm/`

### Bitcoin

**Networks:** Mainnet, Testnet
**Address:** BIP84 Native SegWit (bc1...)
**Implementation:** `src/core/chains/bitcoin/`

### Solana

**Networks:** Mainnet, Devnet, Testnet
**Features:** SPL tokens, Solana Pay
**Implementation:** `src/core/chains/solana/`

### Polkadot/Substrate (15+)

**Networks:** Polkadot, Kusama, Acala, Karura, Astar, Shiden, Bifrost, Edgeware, Moonbeam, Unique, Pendulum, Vara, Westend, Rococo
**Implementation:** `src/core/chains/polkadot/`

### OmniCoin

**Network:** Avalanche-based
**Native:** Full integration with validators
**Implementation:** `src/core/chains/omnicoin/` (if exists) or via EVM

---

## KEY SERVICES

### WalletService

**File:** `src/services/WalletService.ts`

**Functions:**
- Create/restore wallet from mnemonic
- Account management (create, import, export)
- Transaction operations
- Balance queries
- Multi-chain support

### NFTService

**File:** `src/services/NFTService.ts`

**Functions:**
- Mint NFTs (for marketplace listings)
- Display NFTs from multiple chains
- Transfer NFTs
- NFT metadata (IPFS)

### DEXService

**File:** `src/services/DEXService.ts`

**Functions:**
- Place orders (Market, Limit, Stop, OCO, TWAP, VWAP)
- Token swaps
- Privacy swaps (XOM ↔ pXOM)
- Order management

### BridgeService

**File:** `src/services/BridgeService.ts`

**Functions:**
- Cross-chain asset transfers
- Bridge route finding
- Transaction monitoring

---

## DEVELOPMENT

### Quick Start

```bash
cd /home/rickc/OmniBazaar/Wallet

# Install
npm install

# Development build (watch mode)
npm run dev

# Build extension
npm run build:extension

# Build for specific browser
npm run build:chrome
npm run build:firefox

# Run tests
npm test
```

### Browser Extension Development

```bash
# Build extension
npm run build:extension:chrome

# Load in Chrome:
# 1. Go to chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select dist/ folder
```

### Testing

```bash
# All tests
npm test

# Specific categories
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:security

# Coverage
npm run test:coverage
```

---

## INTEGRATION WITH OTHER MODULES

### Validator Module

**Location:** `/home/rickc/OmniBazaar/Validator/`

**Wallet uses Validator services:**
- OmniWalletService - Wallet operations on validator
- ENS Oracle - Username resolution
- Storage Service - IPFS for NFT metadata
- PriceOracleService - Token prices

**Communication:** REST + WebSocket

### WebApp Module

**Location:** `/home/rickc/OmniBazaar/WebApp/`

**Wallet embedded in WebApp:**
- Shared wallet components
- Embedded wallet UI
- Shared state management
- Same services reused

### Coin Module

**Location:** `/home/rickc/OmniBazaar/Coin/`

**Smart contracts:**
- OmniCoin (XOM token)
- OmniCore (core logic)
- OmniBridge (cross-chain)
- OmniNameRegistry (usernames)

**Interaction:** Via ethers.js and validators

---

## CRITICAL FILES

### Documentation
1. **CURRENT_STATUS.md** - Current technical state
2. **TODO.md** - Task list
3. **HANDOFF.md** - Handoff document
4. **WALLET_CONTEXT.md** (this file) - AI context
5. **ENS_INTEGRATION_REFERENCE.md** - ENS guide
6. **TESTING_REFERENCE.md** - Testing guide
7. **ARCHITECTURE_REFERENCE.md** - Architecture overview
8. **INTEGRATION_REFERENCE.md** - Validator/OmniCoin integration
9. **SECURITY_REFERENCE.md** - Security implementation
10. **DEVELOPMENT_REFERENCE.md** - Development roadmap
11. **USERNAME_ADDRESSING_SYSTEM.md** - Username addressing
12. **DOCUMENTATION.md** - General documentation
13. **IMPLEMENTATION_INSTRUCTIONS.md** - Implementation guide

### Source Code
1. **src/background/background.ts** - Extension service worker
2. **src/core/wallet/Wallet.ts** - Main wallet class
3. **src/core/keyring/KeyringService.ts** - Key management
4. **src/core/providers/ProviderManager.ts** - Multi-chain providers
5. **src/services/WalletService.ts** - Main wallet service
6. **manifest/manifest.json** - Extension manifest
7. **vite.config.ts** - Build configuration

---

## CODING STANDARDS

**TypeScript Requirements:**
- ✅ Zero `any` types - use `unknown` or specific types
- ✅ Complete JSDoc for all exports
- ✅ Strict null checks
- ✅ No `console.log` - use proper logging
- ✅ Conditional spread: `...(value && { key: value })`

**Security Requirements:**
- Never log private keys or mnemonics
- Always use secure wipe for sensitive data
- Validate all user input
- Use constant-time comparisons
- Implement rate limiting

**Before Writing Code:**
1. **Search implementation references** - Working code in `source-repos`
2. Check if feature exists (95-98% complete)
3. Review existing patterns in `src/`
4. Verify compatibility with all chains

**After Writing Code:**
1. ESLint: `npm run lint`
2. Type check: `npm run type-check`
3. Tests: `npm test`
4. Build: `npm run build`

---

## COMMON TASKS

### Adding New Blockchain

```bash
# 1. Create chain configuration
touch src/core/chains/newchain/networks.ts
touch src/core/chains/newchain/provider.ts

# 2. Add to ProviderManager
# Edit: src/core/providers/ProviderManager.ts

# 3. Update KeyringService for key derivation
# Edit: src/core/keyring/BIP39Keyring.ts

# 4. Create tests
touch tests/core/chains/newchain/provider.test.ts
```

### Adding New Service

```typescript
// Create service class
export class NewService {
  private static instance: NewService;

  static getInstance(): NewService {
    if (!NewService.instance) {
      NewService.instance = new NewService();
    }
    return NewService.instance;
  }

  async doSomething(): Promise<Result> {
    // Implementation
  }
}
```

---

## SECURITY CHECKLIST

### Before Deployment

- [ ] All private keys encrypted
- [ ] Secure wipe implemented
- [ ] Input validation comprehensive
- [ ] Anti-phishing active
- [ ] Hardware wallet tested
- [ ] Biometric auth functional
- [ ] Transaction decoding enabled
- [ ] Security tests passing

---

## QUICK REFERENCE

**Project Root:** `/home/rickc/OmniBazaar/`
**This Module:** `/home/rickc/OmniBazaar/Wallet/`
**Backend:** `/home/rickc/OmniBazaar/Validator/`
**Frontend:** `/home/rickc/OmniBazaar/WebApp/`
**Contracts:** `/home/rickc/OmniBazaar/Coin/`
**Reference Code:** `/home/rickc/OmniBazaar/Wallet/DePay/`

**Dev Commands:**
- Build: `npm run build:extension`
- Test: `npm test`
- Dev: `npm run dev`
- Lint: `npm run lint`

**Extension Load:**
- Chrome: chrome://extensions → Load unpacked → dist/
- Firefox: about:debugging → Load Temporary Add-on → dist/

---

**Last Updated:** 2025-10-05 10:33 UTC
**For Latest Status:** Read HANDOFF.md, CURRENT_STATUS.md, TODO.md
**For Architecture:** Read ARCHITECTURE_REFERENCE.md
**For Security:** Read SECURITY_REFERENCE.md
**For Testing:** Read TESTING_REFERENCE.md
