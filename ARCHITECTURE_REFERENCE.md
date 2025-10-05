# Architecture Reference

**Last Updated:** 2025-10-05 10:28 UTC
**Purpose:** Wallet module architecture overview

---

## Overview

OmniBazaar Wallet combines best features from Enkrypt, Rainbow, Frame, and DePay wallets into a unified multi-chain browser extension.

---

## Embedded Wallet Architecture

### Core Design

**Hybrid Approach:**
- Browser extension (primary)
- Can be embedded in WebApp
- Reusable core wallet logic
- Shared across web3 extension and mobile app

### Component Layers

```text
┌─────────────────────────────────────┐
│    UI Layer (Browser Extension)     │
├─────────────────────────────────────┤
│  Services Layer                     │
│  - WalletService                    │
│  - NFTService, DEXService, etc.     │
├─────────────────────────────────────┤
│  Core Wallet Engine                 │
│  - KeyringService (BIP39)           │
│  - ProviderManager (multi-chain)    │
│  - TransactionManager               │
├─────────────────────────────────────┤
│  Storage Layer                      │
│  - IndexedDB (encrypted)            │
│  - WalletDatabase                   │
└─────────────────────────────────────┘
```

### Multi-Chain Support

**70+ Blockchains:**

**EVM Chains (20+):**
- Ethereum, Arbitrum, Optimism, Base, Polygon
- Avalanche, BSC, Fantom, Gnosis, Moonbeam
- zkSync, Linea, Scroll, Metis, World Chain
- Aurora, Celo, Harmony, Cronos

**Bitcoin:**
- Mainnet, Testnet
- BIP84 Native SegWit
- UTXO management

**Solana:**
- Mainnet, Devnet, Testnet
- SPL tokens
- Solana Pay integration

**Substrate/Polkadot (15+):**
- Polkadot, Kusama, Acala, Karura
- Astar, Shiden, Bifrost, Edgeware
- Moonbeam, Unique, Pendulum, Vara

**OmniCoin:**
- Avalanche-based
- Native integration

---

## Avalanche Integration

### OmniCoin on Avalanche

**Network:** Avalanche C-Chain
**Consensus:** Snowman (via validators)
**Integration:** Native support in wallet

**Features:**
- XOM token support
- pXOM (privacy token)
- Staking integration
- Validator communication

### Cross-Chain Bridges

- Avalanche ↔ Ethereum
- Avalanche ↔ Polygon
- Using Avalanche Warp Messaging (AWM)

---

## Security Architecture

### Encryption

**Seed Phrase:** AES-256-GCM with PBKDF2 (100,000 iterations)
**Vault Storage:** Encrypted with unique IV per encryption
**Memory Management:** Secure wipe after use

### Key Derivation

**Standards:**
- BIP39 (mnemonic generation)
- BIP32 (HD wallets)
- BIP44 (multi-coin)
- BIP84 (Bitcoin SegWit)

**Paths:**
- Ethereum: `m/44'/60'/0'/0/n`
- Bitcoin: `m/84'/0'/0'/0/n`
- Solana: `m/44'/501'/0'/0'`
- Substrate: `//polkadot//n`

### Hardware Wallet Support

**Supported:**
- Ledger (Bitcoin, Ethereum, Substrate)
- Trezor (Bitcoin, Ethereum)

**Framework:** Modular design for additional hardware wallets

---

## Data Flow

### Transaction Flow

```text
User Action → WalletService → KeyringService
                    ↓
           Sign with Private Key
                    ↓
           ProviderManager → Blockchain
                    ↓
           TransactionDatabase (record)
                    ↓
           Update UI (WebSocket)
```

### Balance Updates

```text
Provider → Token balances
    ↓
WalletService → Aggregate
    ↓
WalletDatabase → Persist
    ↓
UI Components → Display
```

---

## Browser Extension

### Manifest v3 Structure

```text
manifest.json
├── background.js       # Service worker
├── content-scripts/    # Web page injection
├── popup.html         # Extension popup
└── options.html       # Settings page
```

### Communication

- Content script ↔ Background (chrome.runtime.sendMessage)
- Background ↔ Popup (chrome.runtime.connect)
- Web page ↔ Content script (window.postMessage)

### Provider Injection

```typescript
// Injected into web pages
window.ethereum = {
  request: async (args) => { /* ... */ },
  isOmniBazaar: true,
  // Standard EIP-1193 interface
};
```

---

## Database Schema

**WalletDatabase (IndexedDB):**
- `accounts` - HD wallet accounts
- `transactions` - Transaction history
- `tokens` - Token balances
- `nfts` - NFT metadata
- `config` - Wallet settings

**Encryption:** All sensitive data encrypted at rest

---

**See Also:**
- USERNAME_ADDRESSING_SYSTEM.md - Username resolution
- SECURITY_REFERENCE.md - Security details
- INTEGRATION_REFERENCE.md - Validator integration
