# ENS Integration Reference

**Last Updated:** 2025-10-05 10:25 UTC
**Status:** ✅ Complete
**Purpose:** Complete ENS integration guide for username.omnicoin addresses

---

## Overview

OmniBazaar enables `username.omnicoin` addresses to work in external wallets (MetaMask, etc.) through a stateless oracle-based resolution system.

**Key Feature:** Zero per-user gas cost on Ethereum - registration costs 1 XOM (~$0.01) on OmniCoin chain.

---

## Architecture

```text
[User Types "alice.omnicoin" in MetaMask]
         ↓
[ENS Resolution] → [Stateless Resolver Contract]
         ↓
[Oracle Query] → [OmniBazaar Validator Network]
         ↓
[OmniCoin Query] → [OmniNameRegistry Contract]
         ↓
[Returns Address] → [Transaction Proceeds]
```

---

## Smart Contracts

### 1. OmniNameRegistry (OmniCoin Chain)

**Purpose:** Store username → address mappings

```solidity
function register(string memory username) external payable
function resolve(string memory username) external view returns (address)
function reverseResolve(address addr) external view returns (string memory)
function isAvailable(string memory username) external view returns (bool)
```

**Cost:** 1 XOM per registration

### 2. OmniStatelessResolver (Ethereum)

**Purpose:** Resolve names without per-user storage on Ethereum

```solidity
function resolve(string memory username) external view returns (address)
function _queryOracles(string memory username) internal view returns (address)
```

**Gas Cost:** Zero (queries oracles, no storage)

### 3. OmniOracle (Ethereum)

**Purpose:** Bridge OmniCoin data to Ethereum

```solidity
function queryName(string memory username) external view returns (address)
function updateName(string memory username, address resolvedAddress) external
```

**Updates:** Validators earn XOM rewards for oracle updates

---

## Node Services

### OracleNodeService

**File:** `src/services/OracleNodeService.ts`

**Functions:**
- Monitor OmniCoin blockchain for name registrations
- Update Ethereum oracles with new registrations
- Earn XOM rewards for oracle duty
- Automatic batch processing for efficiency

---

## Zero-Cost Solution

**Registration:**
- 1 XOM (~$0.01) on OmniCoin chain
- Paid by OmniBazaar or user

**Resolution:**
- Stateless queries (no per-user Ethereum storage)
- Oracle updates earn XOM (not paid by users)
- No ETH gas fees for users

---

## Testing

**Test File:** `tests/ENSIntegration.test.js`
**CLI Tool:** `test-integration.js`

```bash
# Install dependencies
npm install

# Set environment
cp .env.example .env

# Run tests
npm test ENSIntegration
```

---

## Integration

### In Wallet

```typescript
// Resolve username
const address = await nameRegistry.resolve('alice.omnicoin');

// Register username
await nameRegistry.register('alice', { value: ethers.parseEther('1') });

// Check availability
const available = await nameRegistry.isAvailable('alice');
```

### In MetaMask

Users simply type `alice.omnicoin` in recipient field - automatic resolution via ENS.

---

## Deployment

1. Deploy OmniNameRegistry on OmniCoin chain
2. Deploy OmniOracle on Ethereum
3. Deploy OmniStatelessResolver on Ethereum
4. Configure oracle nodes in Validator network
5. Register ENS domain `omnicoin.eth`

---

**Status:** ✅ Complete and operational
**Files:** See VALIDATOR_INTEGRATION.md for oracle service details
