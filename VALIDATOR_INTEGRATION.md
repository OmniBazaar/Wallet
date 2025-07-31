# Wallet Validator Integration - Hybrid L2.5 Architecture

This document outlines the integration between the Wallet module and the OmniBazaar Validator services within the new Hybrid L2.5 Architecture.

## Architecture Overview

The Wallet module operates within a dual-layer architecture:
- **Layer 1 (COTI V2)**: OmniCoin token transactions with MPC privacy
- **Layer 2.5 (OmniBazaar Validators)**: Wallet business logic with Proof of Participation consensus

### OmniCoin Integration
OmniCoin is deployed as a token ON COTI V2 (not a fork), leveraging:
- COTI's MPC (Multi-Party Computation) for transaction privacy
- Garbled circuits for confidential wallet operations
- Fast, scalable transaction processing
- Enterprise-grade privacy protection

## Dual Consensus Integration

The Wallet module integrates with both consensus layers:

### COTI V2 Layer Integration
- **Transaction Processing**: Token transfers through COTI V2
- **Privacy Features**: Encrypted balances and transaction amounts
- **Token Operations**: OmniCoin transfers, staking operations
- **Smart Contracts**: Core wallet functionality on COTI

### OmniBazaar Validator Layer Integration
- **Wallet Logic**: Account management, portfolio tracking
- **Business Rules**: Fee distribution, reward calculations
- **Data Storage**: IPFS coordination for wallet backups
- **Multi-Chain**: Cross-chain bridge coordination
- **Username Services**: ENS-like username resolution

## Overview

The Wallet module provides a comprehensive multi-chain wallet solution that integrates with both layers to provide:
- Secure transaction processing through COTI V2 and Validator services
- Balance queries with privacy-preserving features
- Cross-chain coordination and bridging
- Username services and ENS resolution
- Secure wallet data storage on IPFS through validators
- Privacy-enabled staking operations

## Architecture

```
Wallet Module (Vue.js)
├── src/
│   ├── services/
│   │   ├── ValidatorWallet.ts        # Main wallet service integration
│   │   ├── ValidatorTransaction.ts   # Transaction processing service
│   │   ├── ValidatorBalance.ts       # Balance tracking service
│   │   └── index.ts                  # Service exports and helpers
│   ├── hooks/
│   │   └── useValidatorWallet.ts     # Vue composables for wallet operations
│   └── types/
│       └── wallet.ts                 # TypeScript type definitions
└── tests/
    └── validator-wallet.test.ts      # Integration tests
```

## Services

### ValidatorWalletService

The main wallet service that handles account management and transaction signing:

```typescript
import { ValidatorWalletService } from './services/ValidatorWallet';

const walletService = new ValidatorWalletService({
  validatorEndpoint: 'https://validator.omnibazaar.network',
  networkId: 'omnibazaar-mainnet',
  userId: 'user-123',
  enableSecureStorage: true,
  autoBackup: true
});

await walletService.initialize();
```

#### Key Features:

- **Account Management**: Create, import, and manage multiple wallet accounts
- **Transaction Signing**: Sign transactions and messages with private keys
- **ENS Resolution**: Resolve ENS names to addresses
- **Backup/Restore**: Secure wallet backup and restoration
- **Cross-Chain Support**: Support for multiple blockchain networks

#### Usage Examples:

```typescript
// Create new account
const account = await walletService.createAccount(
  'My Wallet',
  'mnemonic',
  'ethereum'
);

// Import existing account
const imported = await walletService.importAccount(
  'Imported Wallet',
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  'ethereum'
);

// Send transaction
const result = await walletService.sendTransaction({
  from: account.address,
  to: '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09',
  value: '0.1',
  chainId: 'ethereum'
});

// Resolve ENS name
const resolution = await walletService.resolveENS('vitalik.eth');
```

### ValidatorTransactionService

Handles transaction processing, gas estimation, and transaction history:

```typescript
import { ValidatorTransactionService } from './services/ValidatorTransaction';

const transactionService = new ValidatorTransactionService({
  validatorEndpoint: 'https://validator.omnibazaar.network',
  networkId: 'omnibazaar-mainnet',
  userId: 'user-123',
  enableFeeDistribution: true,
  maxRetries: 60
});

await transactionService.initialize();
```

#### Key Features:

- **Transaction Processing**: Send individual and batch transactions
- **Gas Estimation**: Estimate gas costs for transactions
- **Transaction Monitoring**: Watch for transaction confirmations
- **Fee Distribution**: Distribute transaction fees to validators
- **History Tracking**: Maintain transaction history and export data

#### Usage Examples:

```typescript
// Send transaction
const tx = await transactionService.sendTransaction(
  '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09', // from
  '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09', // to
  '0.1', // value
  '0x', // data
  { gasLimit: '21000' } // options
);

// Estimate gas
const estimate = await transactionService.estimateGas(
  '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09',
  '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09',
  '0.1'
);

// Send batch transactions
const batch = await transactionService.sendBatchTransactions([
  { from: account1, to: recipient1, value: '0.1' },
  { from: account2, to: recipient2, value: '0.2' }
]);

// Get transaction history
const history = transactionService.getTransactionHistory({
  address: '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09',
  limit: 50
});
```

### ValidatorBalanceService

Manages balance queries, token tracking, and price information:

```typescript
import { ValidatorBalanceService } from './services/ValidatorBalance';

const balanceService = new ValidatorBalanceService({
  validatorEndpoint: 'https://validator.omnibazaar.network',
  networkId: 'omnibazaar-mainnet',
  userId: 'user-123',
  enableCaching: true,
  cacheTimeout: 30000,
  enableHistoryTracking: true
});

await balanceService.initialize();
```

#### Key Features:

- **Balance Tracking**: Real-time balance updates for native and token assets
- **Multi-Token Support**: Support for ERC-20 and other token standards
- **Price Integration**: Token price data and USD value calculations
- **History Tracking**: Balance change history and analytics
- **Portfolio Management**: Aggregated portfolio views and statistics

#### Usage Examples:

```typescript
// Get account balance
const balance = await balanceService.getBalance(
  '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09'
);

// Get multiple balances
const balances = await balanceService.getMultipleBalances([
  '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09',
  '0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09'
]);

// Start automatic balance updates
balanceService.startBalanceUpdates(
  ['0x742d35Cc6634C0532925a3b8D1c9e5e5c0b85D09'],
  30000 // 30 seconds
);

// Get portfolio summary
const summary = balanceService.getPortfolioSummary();
```

## Vue Composables

### useValidatorWallet

Main composable for wallet operations:

```typescript
import { useValidatorWallet } from './hooks/useValidatorWallet';

export default {
  setup() {
    const {
      isConnected,
      accounts,
      activeAccount,
      initializeWallet,
      createAccount,
      setActiveAccount
    } = useValidatorWallet();
    
    onMounted(() => {
      initializeWallet('user-123');
    });
    
    return {
      isConnected,
      accounts,
      activeAccount,
      createAccount,
      setActiveAccount
    };
  }
};
```

### useValidatorTransaction

Composable for transaction operations:

```typescript
import { useValidatorTransaction } from './hooks/useValidatorWallet';

export default {
  setup() {
    const {
      isProcessing,
      pendingTransactions,
      sendTransaction,
      estimateGas
    } = useValidatorTransaction();
    
    const handleSendTransaction = async () => {
      const result = await sendTransaction({
        from: activeAccount.value.address,
        to: recipient.value,
        value: amount.value,
        chainId: 'ethereum'
      });
      
      if (result.success) {
        console.log('Transaction sent:', result.txHash);
      }
    };
    
    return {
      isProcessing,
      pendingTransactions,
      handleSendTransaction,
      estimateGas
    };
  }
};
```

### useValidatorBalance

Composable for balance operations:

```typescript
import { useValidatorBalance } from './hooks/useValidatorWallet';

export default {
  setup() {
    const {
      isLoading,
      balances,
      portfolioSummary,
      getBalance,
      startBalanceUpdates
    } = useValidatorBalance();
    
    const watchedAddresses = computed(() => 
      accounts.value.map(acc => acc.address)
    );
    
    watch(watchedAddresses, (addresses) => {
      startBalanceUpdates(addresses, 30000);
    });
    
    return {
      isLoading,
      balances,
      portfolioSummary,
      getBalance
    };
  }
};
```

## Integration Examples

### Complete Wallet Setup

```typescript
// main.ts
import { createApp } from 'vue';
import App from './App.vue';
import { initializeValidatorServices } from './services';

const app = createApp(App);

// Initialize validator services
app.config.globalProperties.$initWallet = async (userId: string) => {
  await initializeValidatorServices(userId);
};

app.mount('#app');
```

### Wallet Component

```vue
<template>
  <div class="wallet-container">
    <div v-if="!isConnected" class="connection-status">
      <button @click="connectWallet">Connect Wallet</button>
    </div>
    
    <div v-else class="wallet-connected">
      <div class="account-selector">
        <select v-model="selectedAccountId" @change="handleAccountChange">
          <option v-for="account in accounts" :key="account.id" :value="account.id">
            {{ account.name }} ({{ account.address.slice(0, 6) }}...)
          </option>
        </select>
      </div>
      
      <div class="balance-display">
        <h3>Balance</h3>
        <p v-if="activeAccount">
          {{ balances[activeAccount.address]?.nativeBalanceFormatted || '0' }} ETH
        </p>
        <p v-if="activeAccount">
          ${{ balances[activeAccount.address]?.totalValueUSD || '0' }} USD
        </p>
      </div>
      
      <div class="token-list">
        <h4>Tokens</h4>
        <div 
          v-for="token in activeAccountTokens" 
          :key="token.address"
          class="token-item"
        >
          <span>{{ token.symbol }}</span>
          <span>{{ token.balanceFormatted }}</span>
          <span>${{ token.valueUSD }}</span>
        </div>
      </div>
      
      <div class="transaction-form">
        <h4>Send Transaction</h4>
        <form @submit.prevent="sendTransaction">
          <input v-model="recipient" placeholder="Recipient address" />
          <input v-model="amount" placeholder="Amount" type="number" step="0.01" />
          <button type="submit" :disabled="isProcessing">
            {{ isProcessing ? 'Processing...' : 'Send' }}
          </button>
        </form>
      </div>
      
      <div class="transaction-history">
        <h4>Recent Transactions</h4>
        <div 
          v-for="tx in recentTransactions" 
          :key="tx.id"
          class="transaction-item"
        >
          <span>{{ tx.to.slice(0, 6) }}...</span>
          <span>{{ tx.value }} ETH</span>
          <span :class="`status-${tx.status}`">{{ tx.status }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { 
  useValidatorWallet, 
  useValidatorTransaction, 
  useValidatorBalance 
} from '../hooks/useValidatorWallet';

const {
  isConnected,
  accounts,
  activeAccount,
  initializeWallet,
  createAccount,
  setActiveAccount
} = useValidatorWallet();

const {
  isProcessing,
  pendingTransactions,
  transactionHistory,
  sendTransaction: submitTransaction,
  estimateGas
} = useValidatorTransaction();

const {
  balances,
  portfolioSummary,
  getBalance
} = useValidatorBalance();

const selectedAccountId = ref('');
const recipient = ref('');
const amount = ref('');

const activeAccountTokens = computed(() => {
  if (!activeAccount.value) return [];
  return balances.value[activeAccount.value.address]?.tokens || [];
});

const recentTransactions = computed(() => {
  return [...pendingTransactions.value, ...transactionHistory.value]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10);
});

const connectWallet = async () => {
  await initializeWallet('user-123');
  
  if (accounts.value.length === 0) {
    await createAccount('My Wallet', 'mnemonic', 'ethereum');
  }
  
  if (accounts.value.length > 0) {
    setActiveAccount(accounts.value[0].id);
    selectedAccountId.value = accounts.value[0].id;
  }
};

const handleAccountChange = () => {
  setActiveAccount(selectedAccountId.value);
};

const sendTransaction = async () => {
  if (!activeAccount.value) return;
  
  try {
    const result = await submitTransaction({
      from: activeAccount.value.address,
      to: recipient.value,
      value: amount.value,
      chainId: 'ethereum'
    });
    
    if (result.success) {
      recipient.value = '';
      amount.value = '';
      alert('Transaction sent successfully!');
    } else {
      alert('Transaction failed: ' + result.error);
    }
  } catch (error) {
    alert('Transaction error: ' + error.message);
  }
};

onMounted(() => {
  // Auto-connect if user was previously connected
  const savedUserId = localStorage.getItem('omnibazaar_user_id');
  if (savedUserId) {
    connectWallet();
  }
});
</script>

<style scoped>
.wallet-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.balance-display {
  background: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
  margin: 20px 0;
}

.token-list {
  margin: 20px 0;
}

.token-item {
  display: flex;
  justify-content: space-between;
  padding: 10px;
  border-bottom: 1px solid #eee;
}

.transaction-form {
  background: #f9f9f9;
  padding: 20px;
  border-radius: 8px;
  margin: 20px 0;
}

.transaction-form input {
  width: 100%;
  padding: 10px;
  margin: 10px 0;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.transaction-form button {
  background: #007bff;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.transaction-form button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.transaction-history {
  margin: 20px 0;
}

.transaction-item {
  display: flex;
  justify-content: space-between;
  padding: 10px;
  border-bottom: 1px solid #eee;
}

.status-pending {
  color: #ffc107;
}

.status-confirmed {
  color: #28a745;
}

.status-failed {
  color: #dc3545;
}
</style>
```

## Configuration

### Environment Variables

```bash
# Validator Configuration
VITE_VALIDATOR_ENDPOINT=https://validator.omnibazaar.network
VITE_NETWORK_ID=omnibazaar-mainnet

# Wallet Configuration
VITE_WALLET_STORAGE_ENABLED=true
VITE_WALLET_AUTO_BACKUP=true
VITE_WALLET_CACHE_TIMEOUT=30000

# Transaction Configuration
VITE_TX_FEE_DISTRIBUTION=true
VITE_TX_MAX_RETRIES=60

# Balance Configuration
VITE_BALANCE_CACHE_ENABLED=true
VITE_BALANCE_HISTORY_ENABLED=true
```

### Vite Configuration

Update vite.config.ts to handle the new services:

```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@validator': resolve(__dirname, '../Validator/src'),
      '@services': resolve(__dirname, 'src/services'),
      '@hooks': resolve(__dirname, 'src/hooks')
    }
  },
  define: {
    // Define environment variables
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false
  }
});
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run validator integration tests
npm run test:validator

# Run tests with coverage
npm run test:coverage

# Run unit tests
npm run test:unit

# Run e2e tests
npm run test:e2e
```

### Test Structure

```
tests/
├── validator-wallet.test.ts     # Main integration tests
├── unit/
│   ├── wallet.test.ts          # Unit tests for wallet service
│   ├── transaction.test.ts     # Unit tests for transaction service
│   └── balance.test.ts         # Unit tests for balance service
├── integration/
│   ├── cross-chain.test.ts     # Cross-chain integration tests
│   └── end-to-end.test.ts      # End-to-end workflow tests
└── e2e/
    └── wallet-flows.test.ts    # Browser-based e2e tests
```

## Security Considerations

### Private Key Management

- Private keys are encrypted before storage
- Secure key derivation using PBKDF2
- Hardware wallet integration support
- Automatic key rotation capabilities

### Transaction Security

- All transactions are signed locally
- Gas estimation prevents overpayment
- Transaction replay protection
- Multi-signature wallet support

### Storage Security

- Encrypted storage on IPFS
- Secure backup and recovery
- Data integrity verification
- Access control and permissions

## Performance Optimization

### Caching Strategy

- Balance caching with configurable TTL
- Transaction history caching
- Token price caching
- Account metadata caching

### Lazy Loading

- Dynamic service imports
- Progressive data loading
- On-demand balance updates
- Efficient memory management

### Batch Operations

- Batch balance queries
- Batch transaction processing
- Bulk account operations
 - Optimized network requests

## Monitoring and Analytics

### Key Metrics

- Transaction success rates
- Balance update frequency
- Service response times
- Error rates and types

### Health Checks

- Service availability monitoring
- Network connectivity checks
- Balance synchronization status
- Transaction processing health

## Deployment

### Build Process

```bash
# Build for production
npm run build

# Build for Chrome extension
npm run build:chrome

# Build for Firefox extension
npm run build:firefox

# Build all targets
npm run build:all
```

### Environment Setup

```bash
# Development
export NODE_ENV=development
export VITE_VALIDATOR_ENDPOINT=http://localhost:3000
export VITE_NETWORK_ID=omnibazaar-testnet

# Production
export NODE_ENV=production
export VITE_VALIDATOR_ENDPOINT=https://validator.omnibazaar.network
export VITE_NETWORK_ID=omnibazaar-mainnet
```

## Migration Guide

### From Legacy Wallet

1. **Account Migration**: Import existing accounts and private keys
2. **Transaction History**: Migrate transaction history from old format
3. **Settings Migration**: Transfer user preferences and settings
4. **Testing**: Validate migration with comprehensive tests

### Integration Checklist

- [ ] Validator services initialized
- [ ] Account management working
- [ ] Transaction processing functional
- [ ] Balance tracking operational
- [ ] ENS resolution working
- [ ] Backup/restore tested
- [ ] Security measures implemented
- [ ] Tests passing
- [ ] Documentation updated
- [ ] Performance optimized

## Troubleshooting

### Common Issues

1. **Connection Errors**: Check validator endpoint and network connectivity
2. **Transaction Failures**: Verify gas prices and account balances
3. **Balance Sync Issues**: Check cache settings and update intervals
4. **Account Access**: Verify private key storage and encryption

### Debug Mode

```typescript
// Enable debug logging
const walletService = new ValidatorWalletService({
  ...config,
  debugMode: true
});
```

## Support

For issues or questions:
- Check the [integration tests](tests/validator-wallet.test.ts) for examples
- Review the [service documentation](src/services/)
- Submit issues to the [GitHub repository](https://github.com/omnibazaar/wallet)

## License

This integration is licensed under the MIT License. See [LICENSE](LICENSE) for details.