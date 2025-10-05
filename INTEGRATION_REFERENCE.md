# Integration Reference

**Last Updated:** 2025-10-05 10:30 UTC
**Purpose:** Validator and OmniCoin integration guide

---

## Validator Integration

### Communication Architecture

**Wallet → Validator Communication:**
- REST API for queries
- WebSocket for real-time updates
- Direct validator connection (validators as RPC providers)

**Services Used:**
- OmniWalletService - Validator-side wallet operations
- PriceOracleService - Price feeds
- ENS Oracle - Username resolution
- Storage Service - IPFS for NFT metadata

### API Endpoints

```typescript
// Balance queries
GET /api/v1/wallet/balance/:address

// Transaction submission
POST /api/v1/wallet/transaction

// ENS resolution
GET /api/v1/ens/resolve/:username

// NFT metadata
GET /api/v1/nft/metadata/:tokenId
```

### WebSocket Events

```typescript
// Balance updates
subscribe:balance

// Transaction confirmations
subscribe:transaction

// Price updates
subscribe:prices
```

---

## OmniCoin Integration

### Smart Contract Interaction

**Contracts:**
- OmniCoin (XOM token)
- OmniCore (core logic)
- OmniBridge (cross-chain)
- OmniNameRegistry (ENS-like usernames)

**Operations:**
- Token transfers
- Staking
- Bridge operations
- Username registration

### Provider Configuration

```typescript
// OmniCoin provider via validators
const provider = new ethers.JsonRpcProvider('http://validator:3001/rpc');

// Contract interaction
const omniCoin = new ethers.Contract(
  OMNICOIN_ADDRESS,
  OMNICOIN_ABI,
  signer
);
```

---

## Multi-Chain Integration

### Chain Configuration

**File:** `src/core/chains/*/networks.ts`

Each chain type has:
- Network parameters
- RPC endpoints
- Explorer URLs
- Native token info
- Contract addresses

### Provider Management

**File:** `src/core/providers/ProviderManager.ts`

**Features:**
- Multi-RPC fallback
- Automatic retry
- Health monitoring
- Latency-based selection

---

## Database Integration

### WalletDatabase (IndexedDB)

**Tables:**
- accounts - HD wallet accounts
- transactions - Transaction history
- tokens - Token metadata and balances
- nfts - NFT data
- config - Settings

**Sync with Validator:**
- Transaction history from validator
- NFT metadata from IPFS
- Price data from oracles

---

## IPFS Integration

**For NFT Metadata:**
- Upload images/metadata to IPFS via validator
- Pin content across validator network
- Retrieve via IPFS gateway

**Services:**
- Validator Storage Service
- IPFS HTTP client

---

## Browser Extension Integration

### Manifest Structure

```json
{
  "manifest_version": 3,
  "name": "OmniBazaar Wallet",
  "permissions": ["storage", "activeTab"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content-script.js"]
  }]
}
```

### Provider Injection

```typescript
// Inject into web pages
window.ethereum = omniWalletProvider;
window.isOmniBazaar = true;

// EIP-1193 compatible
window.ethereum.request({ method, params });
```

---

## Security Integration

### Encryption Services

- EncryptionService (AES-256-GCM)
- BiometricService (WebAuthn)
- SecureIndexedDB (encrypted storage)

### Transaction Security

- Input validation
- Address verification
- Amount validation
- Gas limit checks
- Anti-phishing

---

## Testing Integration

**Integration Tests:**
- Service coordination
- Database operations
- Validator communication
- Browser extension APIs

**See:** tests/integration/*, tests/e2e/*

---

**See Also:**
- VALIDATOR_INTEGRATION.md - Detailed validator integration
- OMNICOIN_INTEGRATION.md - OmniCoin specifics
- ARCHITECTURE_REFERENCE.md - Overall architecture
