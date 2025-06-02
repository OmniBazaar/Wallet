# OmniWallet

A modern, feature-rich cryptocurrency wallet built for the OmniBazaar ecosystem, powered by OmniCoin.

## Features

### Secure Wallet Management

- Multi-chain support
- Hardware wallet integration
- Secure key management
- Transaction signing

### OmniCoin Integration

- Native OmniCoin support
- Privacy features
- Staking capabilities
- Account abstraction

### Payment Processing

- Smart payment routing
- Cross-chain transactions
- Privacy-enhanced payments
- Staking rewards

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Git

### Installation

1. Clone the repository:

```bash
git clone https://github.com/omnibazaar/omniwallet.git
cd omniwallet
```

1. Install dependencies:

```bash
npm install
```

1. Set up environment variables:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

- `OMNICOIN_ADDRESS`: Your OmniCoin contract address
- `RPC_URL`: Your Ethereum node RPC URL
- Other configuration variables as needed

1. Start the development server:

```bash
npm run dev
```

## Project Structure

```text
omniwallet/
├── src/
│   ├── components/     # React components
│   ├── contexts/       # React contexts
│   ├── lib/           # Core library code
│   │   ├── payments/  # Payment processing
│   │   └── wallet/    # Wallet functionality
│   ├── pages/         # Next.js pages
│   └── ui/            # UI components and styles
├── contracts/         # Smart contracts
└── server/           # Backend services
    ├── api/          # API server
    └── explorer/     # Blockchain explorer
```

## Smart Contracts

The project includes several smart contracts:

- `OmniCoinPayment.sol`: Handles payment processing
- `OmniCoinAccount.sol`: Account abstraction implementation
- `OmniCoinPrivacy.sol`: Privacy features
- `OmniCoinStaking.sol`: Staking functionality

## API Endpoints

The wallet interacts with two main API services:

- `api.omnibazaar.com`: Payment routing and transaction processing
- `scan.omnibazaar.com`: Blockchain explorer and transaction tracking

## Development

### Running Tests

```bash
npm test
```

### Building for Production

```bash
npm run build
```

### Code Style

We use ESLint and Prettier for code formatting. Run:

```bash
npm run lint
npm run format
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security

- All smart contracts are audited
- Security best practices are followed
- Regular security updates
- Bug bounty program available

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- Documentation: [docs.omnibazaar.com](https://docs.omnibazaar.com)
- Support: [support.omnibazaar.com](https://support.omnibazaar.com)
- Discord: [discord.omnibazaar.com](https://discord.omnibazaar.com)

## Acknowledgments

- Built on the foundation of DePay's payment routing system
- Enhanced with OmniCoin's privacy and staking features
- Powered by the OmniBazaar ecosystem
