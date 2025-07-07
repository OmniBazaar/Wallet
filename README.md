# OmniBazaar Wallet Development

A hybrid multi-chain privacy wallet built by combining the best features from multiple open-source Web3 wallets: Enkrypt (foundation), Rainbow (NFT), Frame (privacy), and DePay (payments).

## 🏗️ Architecture Overview

This wallet combines:
- **Foundation**: Enkrypt's multi-chain architecture (70+ chains)
- **NFT Capabilities**: Rainbow's minting and marketplace features
- **Privacy Features**: Frame's direct RPC and metadata protection
- **Payment Processing**: DePay's cross-chain routing and widgets

## 📁 Project Structure

```text
Wallet/
├── src/
│   ├── core/                          # Core wallet functionality
│   │   ├── chains/                     # Multi-chain support (from Enkrypt)
│   │   ├── storage/                    # Encrypted storage & keyring
│   │   ├── privacy/                    # Privacy features (from Frame)
│   │   ├── nft/                        # NFT capabilities (from Rainbow)
│   │   ├── payments/                   # Payment processing (from DePay)
│   │   ├── hardware/                   # Hardware wallet support
│   │   └── utils/                      # Shared utilities
│   │
│   ├── background/                     # Extension background services
│   ├── content/                        # Content scripts for dApp interaction
│   ├── popup/                          # Vue.js popup UI
│   ├── omnibazaar/                     # OmniBazaar-specific integrations
│   └── types/                          # TypeScript definitions
│
├── source-repos/                       # Cloned source repositories
│   ├── enKrypt/                        # Enkrypt foundation
│   ├── browser-extension/              # Rainbow NFT features
│   ├── frame/                          # Frame privacy architecture
│   └── web3-wallets/                   # DePay payment processing
│
├── manifest/                           # Browser extension manifests
├── static/                             # Static assets
├── tests/                              # Test suites
├── scripts/                            # Build and extraction scripts
└── docs/                               # Documentation
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm 8+
- Git
- Chrome/Firefox for testing

### 1. Install Dependencies

```bash
cd Wallet
npm install
```

### 2. Component Extraction

The source repositories have been cloned to `source-repos/`. Extract components manually:

#### Extract Enkrypt Core Architecture

```bash
# Core chain providers
cp -r source-repos/enKrypt/packages/extension/src/providers/ethereum src/core/chains/
cp -r source-repos/enKrypt/packages/extension/src/providers/bitcoin src/core/chains/
cp -r source-repos/enKrypt/packages/extension/src/providers/solana src/core/chains/
cp -r source-repos/enKrypt/packages/extension/src/providers/polkadot src/core/chains/
cp -r source-repos/enKrypt/packages/extension/src/types src/core/chains/

# Storage and keyring
cp -r source-repos/enKrypt/packages/extension/src/libs/keyring src/core/storage/
cp -r source-repos/enKrypt/packages/extension/src/libs/storage src/core/storage/

# Hardware wallet support
cp -r source-repos/enKrypt/packages/hw-wallets/src/ledger src/core/hardware/
cp -r source-repos/enKrypt/packages/hw-wallets/src/trezor src/core/hardware/

# Utilities
cp -r source-repos/enKrypt/packages/utils/src/* src/core/utils/
```

#### Extract Rainbow NFT Components

```bash
# NFT management
cp -r source-repos/browser-extension/src/core/resources/nfts/* src/core/nft/
cp -r source-repos/browser-extension/src/core/resources/assets src/core/nft/metadata/

# UI components
cp -r source-repos/browser-extension/src/entries/popup/pages/nfts src/popup/pages/nft-reference/

# Background services
cp -r source-repos/browser-extension/src/background/services/nfts src/background/services/nft-reference/
```

#### Extract DePay Payment Components

```bash
# Payment processing
cp -r source-repos/web3-wallets/src/wallets src/core/payments/cross-chain/
cp -r source-repos/web3-wallets/src/platforms src/core/payments/routing/
cp source-repos/web3-wallets/src/Transaction.js src/core/payments/
cp source-repos/web3-wallets/src/getWallets.js src/core/payments/
```

#### Reference Frame Privacy Patterns

Frame uses a desktop architecture, so we'll reference its patterns rather than direct extraction:

```bash
# Copy for architectural reference
cp -r source-repos/frame/main/provider src/core/privacy/rpc-reference/
cp -r source-repos/frame/main/accounts src/core/privacy/account-reference/
```

### 3. Development Setup

#### Start Development Mode

```bash
npm run dev
```

#### Build for Production

```bash
# Build for Chrome/Brave/Edge
npm run build:chrome

# Build for Firefox
npm run build:firefox

# Build for all browsers
npm run build:all
```

### 4. Testing

```bash
# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run end-to-end tests
npm run test:e2e

# Run all tests
npm test
```

## 🔧 Development Workflow

### Phase 1: Foundation Setup (Current)

1. ✅ Directory structure created
2. ✅ Source repositories cloned
3. ✅ Build system configured
4. 🔄 Extract and adapt Enkrypt core architecture
5. 🔄 Set up multi-chain providers
6. 🔄 Implement encrypted storage layer

### Phase 2: NFT Integration

1. Extract Rainbow NFT components
2. Implement NFT minting interface
3. Add marketplace listing functionality
4. Integrate IPFS for metadata storage

### Phase 3: Privacy Features

1. Implement Frame's privacy patterns
2. Add COTI V2 privacy integration
3. Create transaction metadata protection
4. Implement account isolation

### Phase 4: Payment Integration

1. Integrate DePay payment routing
2. Add cross-chain swap capabilities
3. Implement escrow functionality
4. Add payment tracking

## 📦 Browser Extension Loading

### Chrome/Brave/Edge

1. Build the extension: `npm run build:chrome`
2. Open Chrome Extensions page: `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select `dist/chrome/`

### Firefox

1. Build the extension: `npm run build:firefox`
2. Open Firefox Add-ons page: `about:debugging`
3. Click "This Firefox" → "Load Temporary Add-on"
4. Select any file in `dist/firefox/`

## 🔍 Code Organization

### Import Aliases

- `@/*` - src directory root
- `@/core/*` - Core wallet functionality
- `@/background/*` - Background services
- `@/content/*` - Content scripts
- `@/popup/*` - Popup UI components
- `@/omnibazaar/*` - OmniBazaar integrations
- `@/types/*` - TypeScript definitions
- `@/utils/*` - Core utilities

### Architecture Principles

1. **Modular Design**: Each component is self-contained
2. **Privacy First**: All user data encrypted locally
3. **Multi-chain Native**: Equal support for all chains
4. **OmniBazaar Optimized**: Deep marketplace integration
5. **Performance Focused**: Lazy loading and efficient state management

## 🔐 Security Considerations

- All private keys encrypted with user-provided password
- Hardware wallet support for high-value accounts
- Direct RPC connections without intermediaries
- Transaction metadata protection
- Regular security audits planned

## 📚 Documentation

- [WALLET_DEVELOPMENT_PLAN.md](./WALLET_DEVELOPMENT_PLAN.md) - Comprehensive development roadmap
- [API Documentation](./docs/api/) - Component API references
- [Integration Guide](./docs/integration/) - OmniBazaar integration details
- [Deployment Guide](./docs/deployment/) - Production deployment steps

## 🤝 Contributing

1. Follow the development phases outlined in the plan
2. Maintain TypeScript strict mode compliance
3. Write comprehensive tests for new features
4. Document all public APIs
5. Follow the established code organization patterns

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🆘 Troubleshooting

### Common Issues

1. **Build Errors**: Ensure all dependencies are installed with `npm install`
2. **Extension Not Loading**: Check manifest file syntax and permissions
3. **TypeScript Errors**: Verify path aliases in tsconfig.json
4. **Missing Components**: Complete the component extraction steps above

### Getting Help

- Review the development plan for detailed implementation guidance
- Check existing issue tracker for known problems
- Create detailed bug reports with reproduction steps

---

**Status**: Phase 1 - Foundation Setup in Progress

For detailed implementation guidance, see [WALLET_DEVELOPMENT_PLAN.md](./WALLET_DEVELOPMENT_PLAN.md).
