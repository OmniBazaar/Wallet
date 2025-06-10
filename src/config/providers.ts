import { NetworkConfig } from '../types';
import { SUPPORTED_NETWORKS } from './networks';

export interface ProviderConfig {
    name: string;
    id: string;
    icon: string;
    isInstalled: () => boolean;
    getProvider: () => Promise<any>;
}

export const PROVIDERS: ProviderConfig[] = [
    {
        name: 'MetaMask',
        id: 'metamask',
        icon: '/icons/metamask.svg',
        isInstalled: () => {
            return typeof window !== 'undefined' && window.ethereum?.isMetaMask;
        },
        getProvider: async () => {
            if (typeof window === 'undefined') return null;
            return window.ethereum;
        }
    },
    {
        name: 'WalletConnect',
        id: 'walletconnect',
        icon: '/icons/walletconnect.svg',
        isInstalled: () => true,
        getProvider: async () => {
            const { WalletConnectProvider } = await import('@walletconnect/web3-provider');
            return new WalletConnectProvider({
                infuraId: process.env.NEXT_PUBLIC_INFURA_ID,
                rpc: Object.entries(SUPPORTED_NETWORKS).reduce((acc, [key, network]) => {
                    const rpcUrl = Array.isArray(network.rpcUrls)
                        ? network.rpcUrls[0]
                        : network.rpcUrls.mainnet[0];
                    acc[network.chainId] = rpcUrl;
                    return acc;
                }, {} as Record<string, string>)
            });
        }
    },
    {
        name: 'Coinbase Wallet',
        id: 'coinbase',
        icon: '/icons/coinbase.svg',
        isInstalled: () => {
            return typeof window !== 'undefined' && window.ethereum?.isCoinbaseWallet;
        },
        getProvider: async () => {
            if (typeof window === 'undefined') return null;
            return window.ethereum;
        }
    }
];

export const getProvider = (providerId: string): ProviderConfig | undefined => {
    return PROVIDERS.find(provider => provider.id === providerId);
};

export const getAvailableProviders = (): ProviderConfig[] => {
    return PROVIDERS.filter(provider => provider.isInstalled());
}; 