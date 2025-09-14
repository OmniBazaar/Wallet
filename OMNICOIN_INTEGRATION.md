# OmniCoin Wallet Integration

## Overview

The OmniWallet module is designed to be the primary wallet for OmniCoin (XOM) tokens, integrating directly with the smart contracts deployed from the Coin module.

## Architecture

### Contract Integration

The Wallet connects to OmniCoin contracts through:

1. **Configuration File**: `src/config/omnicoin-integration.ts`
   - Contains contract addresses for each network
   - Provides helper functions to get correct addresses
   - Manages contract ABIs

2. **Core Module**: `src/core/blockchain/OmniCoin.ts`
   - Implements balance checking
   - Provides contract instances
   - Handles network detection

### Network Support

- **Local Development**: Hardhat (chainId: 31337)
  - OmniCoin: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`
  - OmniCore: `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9`
  - OmniGovernance: `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9`

- **COTI Testnet**: (chainId: 7082400)
  - Contracts to be deployed

- **COTI Mainnet**: (Future)
  - Contracts to be deployed

## Setup Instructions

### Local Development

1. **Start Hardhat Node** (in Coin module):
   ```bash
   cd ../Coin
   npx hardhat node
   ```

2. **Deploy Contracts** (in Coin module):
   ```bash
   npx hardhat run scripts/deploy.js --network localhost
   ```

3. **Configure Wallet** (in Wallet module):
   - Contract addresses are automatically detected based on chainId
   - For custom deployments, set `OMNICOIN_CONTRACT_ADDRESS` env var

### Testing

```bash
# Run wallet tests with local contracts
npm test

# Run integration tests
npm run test:integration
```

## Key Features

### OmniCoin-Specific Functions

- **Balance Checking**: Native support for XOM token balances
- **Batch Transfers**: Support for OmniCoin's batch transfer feature
- **Privacy Features**: Integration with PrivateOmniCoin for privacy transactions
- **Staking**: Direct integration with validator staking contracts
- **Governance**: Voting through OmniGovernance contract

### Standard ERC20 Functions

- Transfer
- Approve/Allowance
- Balance queries
- Transaction history

## Integration Points

### With Validator Module
- Validators act as RPC providers
- Direct connection to validator nodes for transactions

### With Bazaar Module
- Wallet provides payment functionality
- Handles XOM transfers for marketplace purchases

### With DEX Module
- Wallet manages token approvals for DEX
- Provides liquidity pool interactions

## Development Notes

### Adding New Networks

1. Update `OMNICOIN_ADDRESSES` in `omnicoin-integration.ts`
2. Add network configuration in `hardhat.config.js`
3. Update network detection logic

### Contract Updates

When OmniCoin contracts are updated:

1. Update contract addresses in integration config
2. Update ABIs if interfaces change
3. Run integration tests to verify

## Troubleshooting

### Common Issues

1. **"Contract not deployed on chain X"**
   - Ensure contracts are deployed on the target network
   - Check chainId matches expected value
   - Verify `OMNICOIN_CONTRACT_ADDRESS` env var if using custom deployment

2. **"Cannot read balance"**
   - Verify provider connection
   - Check contract address is correct
   - Ensure account has XOM tokens

3. **Transaction Failures**
   - Check gas settings
   - Verify account has sufficient ETH/COTI for gas
   - Ensure contract is not paused

## Future Enhancements

1. **Dynamic Contract Discovery**
   - Implement contract registry pattern
   - Auto-discover deployed contracts

2. **Multi-Network Management**
   - Support for cross-chain bridges
   - Unified balance views across networks

3. **Enhanced Privacy**
   - Full integration with COTI V2 privacy features
   - Private balance management

## Resources

- [OmniCoin Contracts](../Coin/contracts/)
- [Deployment Scripts](../Coin/scripts/)
- [Integration Tests](./tests/integration/)