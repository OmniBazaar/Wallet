# OmniCoin Wallet

The OmniCoin Wallet is designed to work in two modes:

1. **Standalone Web3 Wallet**
   - Functions as a complete web3 wallet similar to MetaMask
   - Provides full wallet functionality in a self-contained interface
   - Can be used independently of the OmniBazaar platform

2. **Integrated OmniBazaar Tab**
   - Seamlessly integrates with the OmniBazaar UI
   - Maintains consistent styling with the main application
   - Provides the same functionality as the standalone version

## Features

### Core Functionality
- Account management
- Network switching (Ethereum, Polygon, BSC, Arbitrum, Optimism)
- Token management
- Transaction history
- Settings and preferences

### Network Support
- Ethereum Mainnet
- Polygon
- Binance Smart Chain (BSC)
- Arbitrum
- Optimism

### Components

#### Standalone Mode
- `OmniCoinStandaloneWallet`: Complete wallet interface for standalone use
- Styled to match popular web3 wallets
- Includes all core functionality

#### Integrated Mode
- `OmniCoinIntegratedWallet`: Wallet interface for OmniBazaar integration
- Matches OmniBazaar UI styling
- Provides the same functionality as standalone mode

### Hooks
- `useOmniCoin`: Core wallet functionality
- `useOmniCoinNetwork`: Network management
- `useOmniCoinToken`: Token management
- `useOmniCoinTransaction`: Transaction handling

## Usage

### Standalone Mode
```jsx
import { OmniCoinStandaloneWallet } from '@omnicoin/wallet';

function App() {
  return (
    <OmniCoinProvider>
      <OmniCoinStandaloneWallet />
    </OmniCoinProvider>
  );
}
```

### Integrated Mode
```jsx
import { OmniCoinIntegratedWallet } from '@omnicoin/wallet';

function OmniBazaarWalletTab() {
  return (
    <OmniCoinProvider>
      <OmniCoinIntegratedWallet />
    </OmniCoinProvider>
  );
}
```

## Development

### Prerequisites
- Node.js >= 16
- npm >= 8
- React >= 17
- TypeScript >= 4.5

### Setup
1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

### Building
```bash
npm run build
```

## Contributing
Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 