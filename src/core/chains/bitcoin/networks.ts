// import * as bitcoin from 'bitcoinjs-lib';
import { BitcoinNetworkConfig } from './provider';

export const BitcoinMainnet: BitcoinNetworkConfig = {
  chainId: 0, // Bitcoin doesn't use chainId like Ethereum
  name: 'Bitcoin',
  currency: 'BTC',
  rpcUrl: 'https://blockstream.info/api', // Using Blockstream API as default
  network: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'bc',
    bip32: { public: 0x0488b21e, private: 0x0488ade4 },
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    wif: 0x80
  },
  apiUrl: 'https://blockstream.info/api',
  explorer: 'https://blockstream.info',
  dust: 546, // Dust limit in satoshis
  feeRate: 10, // Default fee rate in sat/vB
};

export const BitcoinTestnet: BitcoinNetworkConfig = {
  chainId: 1, // Testnet identifier
  name: 'Bitcoin Testnet',
  currency: 'tBTC',
  rpcUrl: 'https://blockstream.info/testnet/api',
  network: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'tb',
    bip32: { public: 0x043587cf, private: 0x04358394 },
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef
  },
  apiUrl: 'https://blockstream.info/testnet/api',
  explorer: 'https://blockstream.info/testnet',
  dust: 546,
  feeRate: 10,
};

// Alternative API endpoints for redundancy
export const AlternativeAPIs = {
  mainnet: [
    'https://api.blockcypher.com/v1/btc/main',
    'https://blockchain.info',
    'https://btc.com/api',
  ],
  testnet: [
    'https://api.blockcypher.com/v1/btc/test3',
    'https://testnet.blockchain.info',
  ],
};

// Lightning Network configuration (for future implementation)
export const LightningConfig = {
  mainnet: {
    name: 'Lightning Network',
    currency: 'BTC',
    // Lightning-specific configuration
  },
  testnet: {
    name: 'Lightning Testnet',
    currency: 'tBTC',
    // Lightning testnet configuration
  },
};

export default {
  mainnet: BitcoinMainnet,
  testnet: BitcoinTestnet,
};