# ENS Integration Implementation

This directory contains the implementation for enabling `username.omnicoin` addresses to work in external wallets like MetaMask through a stateless resolution system.

## Architecture Overview

```
[User Types "alice.omnicoin" in MetaMask]
           ↓
[ENS Resolution] → [Stateless Resolver Contract]
           ↓
[Oracle Query] → [OmniBazaar Node Network]
           ↓
[COTI Chain Query] → [OmniNameRegistry Contract]
           ↓
[Returns Address] → [Transaction Proceeds]
```

## Key Components

### 1. Smart Contracts

- **`OmniNameRegistry.sol`** - Deployed on COTI V2, stores username → address mappings
- **`OmniStatelessResolver.sol`** - Deployed on Ethereum, queries oracles for resolution
- **`OmniOracle.sol`** - Bridge service between COTI and Ethereum

### 2. Node Services

- **`OracleNodeService.ts`** - Monitors COTI chain and updates Ethereum oracles
- Runs on OmniBazaar nodes, earns XOM rewards for oracle duty

### 3. Testing Suite

- **`ENSIntegration.test.js`** - Comprehensive test suite
- **`test-integration.js`** - CLI tool for manual testing

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Environment Variables

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Compile Contracts

```bash
npm run contracts:compile
```

### 4. Run Tests

```bash
npm run contracts:test
```

### 5. Deploy to Testnets

```bash
# Deploy to COTI testnet
npm run contracts:deploy:coti

# Deploy to Ethereum testnet
npm run contracts:deploy:ethereum
```

### 6. Test Integration

```bash
# Run comprehensive tests
node scripts/test-integration.js
```

## Configuration

### Network Configuration

Edit `hardhat.config.js` to configure network settings:

```javascript
networks: {
  "coti-testnet": {
    url: "https://testnet.coti.io/rpc",
    chainId: 7082400,
    accounts: [PRIVATE_KEY]
  },
  sepolia: {
    url: `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
    chainId: 11155111,
    accounts: [PRIVATE_KEY]
  }
}
```

### Oracle Node Configuration

Configure oracle nodes in your environment:

```bash
COTI_TESTNET_RPC=https://testnet.coti.io/rpc
ETHEREUM_RPC=https://sepolia.infura.io/v3/YOUR_KEY
PRIVATE_KEY=0x...
REGISTRY_ADDRESS=0x...
ORACLE_ADDRESS=0x...
RESOLVER_ADDRESS=0x...
```

## Usage Examples

### Register a Name

```javascript
// On COTI chain
const registry = new ethers.Contract(REGISTRY_ADDRESS, registryABI, signer);
await registry.registerFor("alice", "0x742d35Cc6634C0532925a3b844Bc9e7595f2bd7e");
```

### Update Oracle

```javascript
// On Ethereum
const oracle = new ethers.Contract(ORACLE_ADDRESS, oracleABI, signer);
await oracle.updateName("alice", "0x742d35Cc6634C0532925a3b844Bc9e7595f2bd7e");
```

### Resolve Name

```javascript
// Through resolver
const resolver = new ethers.Contract(RESOLVER_ADDRESS, resolverABI, provider);
const address = await resolver.resolve("alice");
```

## Node Operator Setup

### 1. Start Oracle Service

```javascript
import { OracleNodeService } from './src/services/OracleNodeService';

const config = {
  cotiRpcUrl: 'https://testnet.coti.io/rpc',
  ethereumRpcUrl: 'https://sepolia.infura.io/v3/YOUR_KEY',
  privateKey: process.env.PRIVATE_KEY,
  oracleAddress: process.env.ORACLE_ADDRESS,
  registryAddress: process.env.REGISTRY_ADDRESS,
  updateInterval: 300,
  rewardAmount: 10
};

const oracleService = new OracleNodeService(config);
await oracleService.start();
```

### 2. Monitor Performance

```javascript
// Check service status
const status = oracleService.getStatus();
console.log('Running:', status.isRunning);
console.log('Queue size:', status.queueSize);
console.log('Earned rewards:', status.metrics.earnedRewards);
```

## Cost Structure

### One-Time Costs
- ENS domain registration: $5-640/year
- Resolver deployment: ~$200 in gas
- Oracle deployment: ~$200 in gas

### Per-User Costs
- **$0** - All costs absorbed by OmniBazaar
- Users register for free on COTI chain
- Nodes earn XOM rewards for oracle updates

### Node Operator Economics
- **Revenue**: 10 XOM per name update
- **Costs**: Ethereum gas fees (~$5-20 per update)
- **Net profit**: +$30-45 per update (at future XOM price)

## Testing

### Unit Tests

```bash
npm run contracts:test
```

### Integration Tests

```bash
node scripts/test-integration.js
```

### Manual Testing

```bash
# Test network connections
npm run network:check

# Test specific networks
npm run network:coti
npm run network:ethereum

# Deploy and test
npm run contracts:deploy:all
```

## Troubleshooting

### Common Issues

1. **"Connection refused"**
   - Check RPC URLs in configuration
   - Ensure network is accessible

2. **"Insufficient funds"**
   - Add testnet ETH to your wallet
   - Get testnet COTI tokens

3. **"Oracle not authorized"**
   - Ensure your address is added as authorized updater
   - Check oracle permissions

4. **"Name already taken"**
   - Use different test names
   - Check name availability first

### Debug Commands

```bash
# Check contract verification
npm run contracts:verify:coti
npm run contracts:verify:ethereum

# Check network status
npm run network:check

# View deployment info
cat deployments/coti-testnet.json
cat deployments/ethereum-testnet.json
```

## Next Steps

1. **Deploy to Mainnet**
   - Update network configuration
   - Deploy contracts to production networks
   - Configure production oracle nodes

2. **ENS Integration**
   - Register ENS domain (xom.eth, omni.eth, etc.)
   - Configure ENS resolver
   - Test with MetaMask

3. **Node Network**
   - Deploy oracle services to production nodes
   - Configure reward distribution
   - Monitor performance and health

4. **Wallet Integration**
   - Update KeyringManager to use real resolution
   - Add name validation
   - Implement user-friendly interfaces

## Support

For issues and questions:
- Check the troubleshooting section
- Review test outputs
- Check network connectivity
- Verify contract addresses and configuration