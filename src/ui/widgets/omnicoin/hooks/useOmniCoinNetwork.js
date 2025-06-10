import { useState, useCallback } from 'react';
import { useOmniCoin } from './useOmniCoin';

const SUPPORTED_NETWORKS = {
    ethereum: {
        chainId: '0x1',
        chainName: 'Ethereum Mainnet',
        nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18
        },
        rpcUrls: ['https://mainnet.infura.io/v3/'],
        blockExplorerUrls: ['https://etherscan.io']
    },
    polygon: {
        chainId: '0x89',
        chainName: 'Polygon Mainnet',
        nativeCurrency: {
            name: 'MATIC',
            symbol: 'MATIC',
            decimals: 18
        },
        rpcUrls: ['https://polygon-rpc.com'],
        blockExplorerUrls: ['https://polygonscan.com']
    },
    bsc: {
        chainId: '0x38',
        chainName: 'Binance Smart Chain',
        nativeCurrency: {
            name: 'BNB',
            symbol: 'BNB',
            decimals: 18
        },
        rpcUrls: ['https://bsc-dataseed.binance.org'],
        blockExplorerUrls: ['https://bscscan.com']
    },
    arbitrum: {
        chainId: '0xa4b1',
        chainName: 'Arbitrum One',
        nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18
        },
        rpcUrls: ['https://arb1.arbitrum.io/rpc'],
        blockExplorerUrls: ['https://arbiscan.io']
    },
    optimism: {
        chainId: '0xa',
        chainName: 'Optimism',
        nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18
        },
        rpcUrls: ['https://mainnet.optimism.io'],
        blockExplorerUrls: ['https://optimistic.etherscan.io']
    }
};

export const useOmniCoinNetwork = () => {
    const { provider } = useOmniCoin();
    const [currentNetwork, setCurrentNetwork] = useState('ethereum');
    const [isSwitching, setIsSwitching] = useState(false);
    const [error, setError] = useState(null);

    const switchNetwork = useCallback(async (networkName) => {
        if (!provider) {
            setError('No provider available');
            return;
        }

        if (!SUPPORTED_NETWORKS[networkName]) {
            setError('Unsupported network');
            return;
        }

        setIsSwitching(true);
        setError(null);

        try {
            const network = SUPPORTED_NETWORKS[networkName];

            // Try to switch the network
            await provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: network.chainId }],
            });

            setCurrentNetwork(networkName);
        } catch (switchError) {
            // This error code indicates that the chain has not been added to MetaMask
            if (switchError.code === 4902) {
                try {
                    const network = SUPPORTED_NETWORKS[networkName];
                    await provider.request({
                        method: 'wallet_addEthereumChain',
                        params: [network],
                    });
                    setCurrentNetwork(networkName);
                } catch (addError) {
                    setError('Failed to add network');
                }
            } else {
                setError('Failed to switch network');
            }
        } finally {
            setIsSwitching(false);
        }
    }, [provider]);

    const getNetworkInfo = useCallback((networkName) => {
        return SUPPORTED_NETWORKS[networkName] || null;
    }, []);

    return {
        currentNetwork,
        isSwitching,
        error,
        switchNetwork,
        getNetworkInfo,
        supportedNetworks: Object.keys(SUPPORTED_NETWORKS)
    };
}; 