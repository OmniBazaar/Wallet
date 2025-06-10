# OmniBazaar Wallet

This module provides a wallet interface for managing OmniCoin and other assets.

## Features

- **OmniCoin Integration:**  
  OmniCoin is the default asset. The wallet supports basic operations (send/receive) and advanced features (staking, privacy, governance).

- **Advanced Features:**  
  - Staking/unstaking OmniCoin
  - Privacy account management
  - Governance proposals and voting

- **EVM Compatibility:**  
  The wallet is compatible with EVM-based wallets (e.g., MetaMask).

## Setup

1. **Install Dependencies:**  
   ```bash
   npm install
   ```

2. **Update OmniCoin Contract Address:**  
   In `src/core/blockchain/OmniCoin.ts`, update the `contractAddress` in `OmniCoinMetadata` with the actual deployed contract address.

3. **Run Development Server:**  
   ```bash
   npm run dev
   ```

## Documentation

- **Core Wallet Logic:**  
  Located in `src/core/wallet/Wallet.ts`.

- **OmniCoin Integration:**  
  Located in `src/core/blockchain/OmniCoin.ts`.

- **Advanced Features:**  
  Advanced features (staking, privacy, governance) are currently placeholders and will be implemented as the contracts and APIs are finalized.

## TODO

- Implement advanced OmniCoin features (staking, privacy, governance).
- Update UI to expose advanced features.
- Add tests for OmniCoin wallet operations.

## License

MIT

# OmniCoin Integration

## Overview
This module integrates OmniCoin functionality into the wallet application. It includes components for token management, transaction history, and token transfers.

## Components
- **OmniCoinTokenManagement**: Manages token approvals and displays token balances and allowances.
- **OmniCoinTokenTransfer**: Allows users to transfer tokens to another address.
- **OmniCoinTransactionHistory**: Displays a history of transactions.

## Hooks
- **useOmniCoinToken**: Provides functions for token operations such as approval, transfer, balance, and allowance checks.

## Usage
Import the components and hooks from `src/ui/widgets/omnicoin` to use them in your application.

## Development
- Ensure you have the necessary dependencies installed.
- Run the development server using `npm start` or `yarn start`.

## OmniCoin Wallet Integration

This module provides a fully integrated Web3 wallet for OmniBazaar, supporting MetaMask, WalletConnect, and Coinbase Wallet. It allows users to connect, view balances, approve, and transfer tokens on multiple EVM-compatible networks.

### Features
- Connect to MetaMask, WalletConnect, or Coinbase Wallet
- View ERC-20 token balances
- Approve and transfer tokens
- Responsive and accessible UI
- Toast notifications for transaction feedback
- Error boundaries and loading states

### Usage

Wrap your app or widget in the `WalletProvider`:

```jsx
import { WalletProvider } from './contexts/WalletContext';

<WalletProvider>
  <YourApp />
</WalletProvider>
```

Use the main widget:

```jsx
import { OmniCoinWidget } from './ui/widgets/omnicoin/OmniCoinWidget';

<OmniCoinWidget />
```

### Accessibility
- All forms and buttons have ARIA labels for screen readers.
- Responsive design for mobile and desktop.

### Testing
- Unit and E2E test stubs are provided. Run `npm test` and `npx cypress open` to execute tests.

---
