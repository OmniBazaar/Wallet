import { NetworkConfig } from '../types';

export const SUPPORTED_NETWORKS: { [key: string]: NetworkConfig } = {
    ethereum: {
        name: 'Ethereum',
        chainId: '0x1',
        networkId: 1,
        rpcUrls: {
            mainnet: [
                'https://mainnet.infura.io/v3/YOUR-PROJECT-ID',
                'https://eth-mainnet.alchemyapi.io/v2/YOUR-API-KEY',
                'https://rpc.ankr.com/eth'
            ],
            testnet: [
                'https://goerli.infura.io/v3/YOUR-PROJECT-ID',
                'https://eth-goerli.alchemyapi.io/v2/YOUR-API-KEY'
            ]
        },
        blockExplorerUrls: ['https://etherscan.io'],
        nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18
        }
    },
    polygon: {
        name: 'Polygon',
        chainId: '0x89',
        networkId: 137,
        rpcUrls: {
            mainnet: [
                'https://polygon-rpc.com',
                'https://rpc-mainnet.matic.network',
                'https://rpc-mainnet.maticvigil.com'
            ],
            testnet: [
                'https://rpc-mumbai.maticvigil.com',
                'https://rpc-mumbai.matic.today'
            ]
        },
        blockExplorerUrls: ['https://polygonscan.com'],
        nativeCurrency: {
            name: 'MATIC',
            symbol: 'MATIC',
            decimals: 18
        }
    },
    bsc: {
        name: 'Binance Smart Chain',
        chainId: '0x38',
        networkId: 56,
        rpcUrls: {
            mainnet: [
                'https://bsc-dataseed.binance.org',
                'https://bsc-dataseed1.defibit.io',
                'https://bsc-dataseed1.ninicoin.io'
            ],
            testnet: [
                'https://data-seed-prebsc-1-s1.binance.org:8545',
                'https://data-seed-prebsc-2-s1.binance.org:8545'
            ]
        },
        blockExplorerUrls: ['https://bscscan.com'],
        nativeCurrency: {
            name: 'BNB',
            symbol: 'BNB',
            decimals: 18
        }
    },
    arbitrum: {
        name: 'Arbitrum One',
        chainId: '0xa4b1',
        networkId: 42161,
        rpcUrls: {
            mainnet: [
                'https://arb1.arbitrum.io/rpc',
                'https://arbitrum-mainnet.infura.io/v3/YOUR-PROJECT-ID'
            ],
            testnet: [
                'https://rinkeby.arbitrum.io/rpc',
                'https://arbitrum-rinkeby.infura.io/v3/YOUR-PROJECT-ID'
            ]
        },
        blockExplorerUrls: ['https://arbiscan.io'],
        nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18
        }
    },
    optimism: {
        name: 'Optimism',
        chainId: '0xa',
        networkId: 10,
        rpcUrls: {
            mainnet: [
                'https://mainnet.optimism.io',
                'https://optimism-mainnet.infura.io/v3/YOUR-PROJECT-ID'
            ],
            testnet: [
                'https://kovan.optimism.io',
                'https://optimism-kovan.infura.io/v3/YOUR-PROJECT-ID'
            ]
        },
        blockExplorerUrls: ['https://optimistic.etherscan.io'],
        nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18
        }
    }
};

export const ENVIRONMENT = process.env.NODE_ENV === 'production' ? 'mainnet' : 'testnet';

export const getNetworkConfig = (networkName: string): NetworkConfig | undefined => {
    return SUPPORTED_NETWORKS[networkName.toLowerCase()];
};

export const getNetworkByChainId = (chainId: string): NetworkConfig | undefined => {
    return Object.values(SUPPORTED_NETWORKS).find(
        network => network.chainId.toLowerCase() === chainId.toLowerCase()
    );
};

export const DEFAULT_NETWORK = 'ethereum'; 