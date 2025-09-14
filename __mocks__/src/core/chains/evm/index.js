/**
 * Mock for Multi-Chain EVM Provider
 */

const { createMockProvider } = require('../../../../../tests/setup');

class MultiChainEVMProvider {
  constructor(network) {
    this.network = network;
    const baseProvider = createMockProvider('ethereum');
    Object.assign(this, {
      ...baseProvider,
      getFormattedBalance: jest.fn().mockResolvedValue('1.0'),
      sendTransaction: jest.fn().mockResolvedValue({ hash: '0x' + '1'.repeat(64) }),
      estimateGas: jest.fn().mockResolvedValue(21000n),
      on: baseProvider.on,
      off: baseProvider.off,
      removeAllListeners: baseProvider.removeAllListeners
    });
  }
}

const ALL_NETWORKS = {
  ethereum: { chainId: 1, name: 'Ethereum', shortName: 'eth', currency: 'ETH', testnet: false, rpcUrl: 'https://mainnet.infura.io/v3/demo', explorer: 'https://etherscan.io' },
  polygon: { chainId: 137, name: 'Polygon', shortName: 'matic', currency: 'MATIC', testnet: false, rpcUrl: 'https://polygon-rpc.com', explorer: 'https://polygonscan.com' },
  arbitrum: { chainId: 42161, name: 'Arbitrum', shortName: 'arb', currency: 'ETH', testnet: false, rpcUrl: 'https://arb1.arbitrum.io/rpc', explorer: 'https://arbiscan.io' },
  optimism: { chainId: 10, name: 'Optimism', shortName: 'op', currency: 'ETH', testnet: false, rpcUrl: 'https://mainnet.optimism.io', explorer: 'https://optimistic.etherscan.io' },
  base: { chainId: 8453, name: 'Base', shortName: 'base', currency: 'ETH', testnet: false, rpcUrl: 'https://mainnet.base.org', explorer: 'https://basescan.org' },
  bsc: { chainId: 56, name: 'BNB Smart Chain', shortName: 'bsc', currency: 'BNB', testnet: false, rpcUrl: 'https://bsc-dataseed.binance.org/', explorer: 'https://bscscan.com' },
  avalanche: { chainId: 43114, name: 'Avalanche', shortName: 'avax', currency: 'AVAX', testnet: false, rpcUrl: 'https://api.avax.network/ext/bc/C/rpc', explorer: 'https://snowtrace.io' },
  fantom: { chainId: 250, name: 'Fantom', shortName: 'ftm', currency: 'FTM', testnet: false, rpcUrl: 'https://rpc.ftm.tools/', explorer: 'https://ftmscan.com' },
  celo: { chainId: 42220, name: 'Celo', shortName: 'celo', currency: 'CELO', testnet: false, rpcUrl: 'https://forno.celo.org', explorer: 'https://explorer.celo.org' },
  moonbeam: { chainId: 1284, name: 'Moonbeam', shortName: 'glmr', currency: 'GLMR', testnet: false, rpcUrl: 'https://rpc.api.moonbeam.network', explorer: 'https://moonscan.io' },
  aurora: { chainId: 1313161554, name: 'Aurora', shortName: 'aurora', currency: 'ETH', testnet: false, rpcUrl: 'https://mainnet.aurora.dev', explorer: 'https://aurorascan.dev' },
  cronos: { chainId: 25, name: 'Cronos', shortName: 'cro', currency: 'CRO', testnet: false, rpcUrl: 'https://evm.cronos.org', explorer: 'https://cronoscan.com' },
  gnosis: { chainId: 100, name: 'Gnosis', shortName: 'gno', currency: 'xDAI', testnet: false, rpcUrl: 'https://rpc.gnosischain.com', explorer: 'https://gnosisscan.io' },
  klaytn: { chainId: 8217, name: 'Klaytn', shortName: 'klay', currency: 'KLAY', testnet: false, rpcUrl: 'https://klaytn.rpc.com', explorer: 'https://scope.klaytn.com' },
  metis: { chainId: 1088, name: 'Metis', shortName: 'metis', currency: 'METIS', testnet: false, rpcUrl: 'https://andromeda.metis.io/?owner=1088', explorer: 'https://andromeda-explorer.metis.io' },
  moonriver: { chainId: 1285, name: 'Moonriver', shortName: 'movr', currency: 'MOVR', testnet: false, rpcUrl: 'https://rpc.api.moonriver.moonbeam.network', explorer: 'https://moonriver.moonscan.io' },
  boba: { chainId: 288, name: 'Boba Network', shortName: 'boba', currency: 'ETH', testnet: false, rpcUrl: 'https://mainnet.boba.network/', explorer: 'https://blockexplorer.boba.network' },
  harmony: { chainId: 1666600000, name: 'Harmony', shortName: 'one', currency: 'ONE', testnet: false, rpcUrl: 'https://api.harmony.one', explorer: 'https://explorer.harmony.one' },
  heco: { chainId: 128, name: 'Huobi ECO Chain', shortName: 'heco', currency: 'HT', testnet: false, rpcUrl: 'https://http-mainnet.hecochain.com', explorer: 'https://hecoinfo.com' },
  okex: { chainId: 66, name: 'OKExChain', shortName: 'okt', currency: 'OKT', testnet: false, rpcUrl: 'https://exchainrpc.okex.org', explorer: 'https://www.oklink.com/okexchain' }
};

module.exports = {
  MultiChainEVMProvider,
  ALL_NETWORKS
};