# Wallet Module Avalanche Validator Integration

This document describes the integration between the OmniBazaar Wallet module and the Avalanche validator services.

## Overview

The Wallet module provides comprehensive wallet functionality integrated with the Avalanche validator's GraphQL API, including:
- Multi-chain wallet management
- ENS and OmniBazaar username resolution
- Transaction processing and history
- Secure key management
- Automated backups via IPFS

## Architecture

```
Wallet Module
    ├── ValidatorWallet (Core Wallet Operations)
    │   └── AvalancheValidatorClient
    │       ├── Account Management
    │       ├── Transaction Processing
    │       ├── Balance Queries
    │       └── ENS Resolution
    │
    └── ENS Oracle Service (omnibazaar.eth)
        ├── ENSOracleService (Bridge Layer)
        │   ├── Ethereum Oracle Contract
        │   ├── COTI Registry Contract
        │   └── Name Update Queue
        │
        └── ValidatorENSOracle (Coordination)
            ├── Oracle Network Management
            ├── Update Distribution
            └── Reward Tracking
```

## Integration Services

### 1. ValidatorWallet Service

Manages wallet operations through the validator network.

```typescript
import { validatorWallet } from './services/ValidatorWallet';

// Initialize wallet
await validatorWallet.initialize();

// Create new wallet
const account = await validatorWallet.createAccount(
  'My Wallet',
  'mnemonic',
  '1' // Chain ID
);

// Import existing wallet
const imported = await validatorWallet.importAccount(
  'Imported Wallet',
  'private key or mnemonic',
  '1'
);

// Send transaction
const result = await validatorWallet.sendTransaction({
  from: account.address,
  to: '0x...',
  value: '1.0', // ETH
  chainId: '1'
});
```

**Features:**
- Multi-account support (mnemonic, private key)
- Hardware wallet support (planned)
- Secure key storage via validator IPFS
- Automatic balance updates
- Transaction history tracking

### 2. ENS Resolution

Supports both standard ENS and OmniBazaar usernames.

```typescript
// Resolve OmniBazaar username
const resolution = await validatorWallet.resolveENS('alice.omnibazaar');
// or just
const resolution = await validatorWallet.resolveENS('alice');

// Returns
{
  address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bd7e',
  name: 'alice',
  avatar: 'ipfs://...',
  description: 'Alice\'s wallet',
  social: {
    twitter: '@alice',
    website: 'alice.com'
  },
  verified: true
}
```

### 3. ENS Oracle Service

Bridges between Ethereum ENS and COTI chain for the omnibazaar.eth domain.

```typescript
import { createValidatorENSOracle } from './services/ens/ValidatorENSOracle';

// Create ENS oracle
const ensOracle = createValidatorENSOracle({
  validatorClient,
  ethereumRpcUrl: 'https://mainnet.infura.io/v3/...',
  cotiRpcUrl: 'https://mainnet.coti.io/rpc',
  oracleContractAddress: '0x...',
  resolverContractAddress: '0x...',
  registryContractAddress: '0x...',
  nodeId: 'validator-001',
  privateKey: process.env.ORACLE_PRIVATE_KEY
});

// Initialize oracle
await ensOracle.initialize();

// Get network status
const status = await ensOracle.getNetworkStatus();
console.log(`Active oracles: ${status.activeNodes}/${status.totalNodes}`);
```

**Oracle Features:**
- Automatic name synchronization
- Batch updates for efficiency
- Oracle coordination to prevent duplicates
- XOM rewards for oracle operators
- Health monitoring and failover

## Configuration

### Environment Variables

```bash
# Wallet Configuration
VITE_VALIDATOR_ENDPOINT=http://localhost:4000
VITE_VALIDATOR_WS_ENDPOINT=ws://localhost:4000/graphql
VITE_VALIDATOR_API_KEY=your-api-key
VITE_NETWORK_ID=omnibazaar-mainnet

# ENS Oracle Configuration
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY
COTI_RPC_URL=https://mainnet.coti.io/rpc
ORACLE_PRIVATE_KEY=0x...
ORACLE_CONTRACT_ADDRESS=0x...
RESOLVER_CONTRACT_ADDRESS=0x...
REGISTRY_CONTRACT_ADDRESS=0x...
```

## ENS Integration Flow

### User Experience

1. User enters "alice.omnibazaar" in MetaMask
2. MetaMask resolves to "alice.omnibazaar.eth"
3. ENS resolver queries our oracle contract
4. Oracle returns address from COTI chain
5. Transaction proceeds to correct address

### Technical Flow

```
MetaMask/Wallet
    ↓
ENS Resolution (alice.omnibazaar.eth)
    ↓
Stateless Resolver Contract (Ethereum)
    ↓
Oracle Contract (Ethereum)
    ↓
Oracle Network (Validators)
    ↓
Registry Contract (COTI Chain)
    ↓
Returns 0x... address
```

## Wallet Features

### Account Management

- **Multi-Account Support**: Create multiple accounts with different derivation paths
- **Import/Export**: Import via private key or mnemonic, export with password protection
- **Hardware Wallet**: Ledger and Trezor support (planned)
- **Account Metadata**: Custom names, tags, and notes

### Transaction Management

- **Multi-Chain Support**: OmniCoin, Ethereum, and other EVM chains
- **Gas Estimation**: Automatic gas price and limit calculation
- **Transaction History**: Full history with filtering and search
- **Pending Transactions**: Real-time status updates via WebSocket

### Security Features

- **Encrypted Storage**: Keys encrypted and stored via validator IPFS
- **Password Protection**: Local password for key access
- **Automatic Backups**: Periodic encrypted backups to IPFS
- **Recovery Options**: Restore from backup or mnemonic

### Integration Features

- **Marketplace Integration**: Direct purchases from wallet
- **DEX Integration**: Trade directly from wallet interface
- **Staking Support**: Stake XOM for validator rewards
- **Bridge Support**: Cross-chain asset transfers

## Oracle Economics

### Reward Structure

- **Per Update**: 10 XOM per successful name update
- **Batch Bonus**: 15 XOM per name in batch updates (>5 names)
- **Uptime Bonus**: Additional 100 XOM/day for 99%+ uptime

### Cost Analysis

- **Ethereum Gas**: ~$5-20 per update (varies with gas price)
- **XOM Reward Value**: $50 per update (at target price)
- **Net Profit**: $30-45 per update

### Oracle Requirements

- **Minimum Stake**: 10,000 XOM
- **Uptime Target**: 95%+
- **Response Time**: <5 seconds
- **Hardware**: 2 CPU, 4GB RAM, 100GB storage

## Testing

### Unit Tests

```bash
cd Wallet
npm test -- test/validator-wallet.test.ts
npm test -- test/ens-oracle.test.ts
```

### Integration Tests

```bash
# Test wallet operations
npm test -- test/integration/wallet-integration.test.ts

# Test ENS resolution
npm test -- test/integration/ens-integration.test.ts
```

### Manual Testing

1. **Wallet Creation**
   ```bash
   npm run dev
   # Create new wallet via UI
   # Verify account appears in list
   # Check balance updates
   ```

2. **ENS Resolution**
   ```bash
   # In browser console
   await validatorWallet.resolveENS('test.omnibazaar')
   # Verify correct address returned
   ```

3. **Oracle Testing**
   ```bash
   # Start oracle service
   npm run oracle:start
   # Monitor logs for updates
   # Verify rewards accumulation
   ```

## Monitoring

### Wallet Metrics

- Account creation rate
- Transaction success rate
- Average transaction time
- Balance query performance
- Storage usage

### Oracle Metrics

- Updates processed per hour
- Success/failure rate
- Average gas cost
- Reward accumulation
- Network participation

### Health Checks

```typescript
// Check wallet health
const walletHealth = await validatorWallet.getHealth();

// Check oracle health
const oracleStatus = ensOracle.getStatus();
```

## Error Handling

### Common Errors

1. **"Validator service not healthy"**
   - Check validator connection
   - Verify GraphQL endpoint
   - Ensure validator is running

2. **"Private key not available"**
   - Verify secure storage is enabled
   - Check IPFS connectivity
   - Ensure key was saved properly

3. **"Oracle not authorized"**
   - Verify oracle address is whitelisted
   - Check oracle contract permissions
   - Ensure sufficient stake

4. **"Username already taken"**
   - Check name availability first
   - Try alternative username
   - Wait for expiration if temporary

## Security Considerations

### Key Management

- Private keys never leave the client
- Encrypted before storage
- Password-protected export
- Secure key derivation

### Transaction Security

- Transaction simulation before sending
- Malicious contract detection
- Phishing protection
- Address verification

### Oracle Security

- Signed oracle updates
- Consensus requirement for critical operations
- Rate limiting per oracle
- Slashing for malicious behavior

## Future Enhancements

### Planned Features

1. **Hardware Wallet Support**
   - Ledger integration
   - Trezor integration
   - Mobile wallet pairing

2. **Advanced ENS Features**
   - Subdomain support (alice.store.omnibazaar)
   - Multi-signature names
   - Name auctions

3. **DeFi Integration**
   - Yield farming dashboard
   - Liquidity provision
   - Automated strategies

4. **Mobile Sync**
   - QR code wallet sync
   - Cloud backup option
   - Cross-device history

## Support

For wallet integration issues:
- Check validator health status
- Verify network connectivity
- Review transaction logs
- Contact support with wallet address

For ENS oracle issues:
- Check oracle network status
- Verify name registration on COTI
- Review oracle logs
- Contact support with username