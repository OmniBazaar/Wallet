import * as bitcoin from 'bitcoinjs-lib';
import { BitcoinNetworkConfig } from './provider';

export const BitcoinMainnet: BitcoinNetworkConfig = {
  chainId: 0, // Bitcoin doesn't use chainId like Ethereum
  name: 'Bitcoin',
  currency: 'BTC',
  rpcUrl: 'https://blockstream.info/api', // Using Blockstream API as default
  network: bitcoin.networks.bitcoin,
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
  network: bitcoin.networks.testnet,
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