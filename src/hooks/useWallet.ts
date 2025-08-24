import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { WalletState, WalletError } from '../types';
import { getProvider, getAvailableProviders } from '../config/providers';
import { getNetworkByChainId } from '../config/networks';

/** Hook for managing wallet connection state and operations */
export const useWallet = (): {
    /** Current connected wallet address */
    address: string | null;
    /** Current chain ID */
    chainId: number | null;
    /** Browser provider instance */
    provider: ethers.BrowserProvider | null;
    /** Whether connection is in progress */
    isConnecting: boolean;
    /** Connection error message */
    error: string | null;
    /** Connect to a wallet provider */
    connect: (providerId: string) => Promise<void>;
    /** Disconnect from current wallet */
    disconnect: () => void;
    /** Switch to a different network */
    switchNetwork: (chainId: number) => Promise<void>;
    /** Get list of available wallet providers */
    getAvailableWallets: () => Array<{
        /** Wallet provider ID */
        id: string;
        /** Human-readable wallet name */
        name: string;
        /** Wallet icon URL or identifier */
        icon: string;
        /** Whether wallet is installed in browser */
        isInstalled: boolean;
    }>;
} => {
    const [state, setState] = useState<WalletState>({
        address: null,
        chainId: null,
        provider: null,
        isConnecting: false,
        error: null
    });

    const resetState = useCallback(() => {
        setState({
            address: null,
            chainId: null,
            provider: null,
            isConnecting: false,
            error: null
        });
    }, []);

    const connect = useCallback(async (providerId: string) => {
        try {
            setState(prev => ({ ...prev, isConnecting: true, error: null }));

            const providerConfig = getProvider(providerId);
            if (!providerConfig) {
                throw new Error(`Provider ${providerId} not found`);
            }

            const provider = await providerConfig.getProvider();
            if (!provider) {
                throw new Error('Provider not available');
            }

            const ethersProvider = new ethers.BrowserProvider(provider);
            const accounts = await ethersProvider.send('eth_requestAccounts', []);
            const network = await ethersProvider.getNetwork();

            setState({
                address: accounts[0],
                chainId: network.chainId,
                provider: ethersProvider,
                isConnecting: false,
                error: null
            });

            // Setup event listeners
            provider.on('accountsChanged', (accounts: string[]) => {
                setState(prev => ({
                    ...prev,
                    address: accounts[0] || null
                }));
            });

            provider.on('chainChanged', (chainId: string) => {
                setState(prev => ({
                    ...prev,
                    chainId: parseInt(chainId, 16)
                }));
            });

            provider.on('disconnect', () => {
                resetState();
            });

        } catch (error) {
            const walletError = error as WalletError;
            setState(prev => ({
                ...prev,
                isConnecting: false,
                error: walletError.message || 'Failed to connect wallet'
            }));
        }
    }, [resetState]);

    const disconnect = useCallback(() => {
        if (state.provider) {
            const provider = state.provider.provider;
            if (provider.disconnect) {
                provider.disconnect();
            }
        }
        resetState();
    }, [state.provider, resetState]);

    const switchNetwork = useCallback(async (chainId: number) => {
        try {
            if (!state.provider) {
                throw new Error('No provider connected');
            }

            const provider = state.provider.provider;
            const network = getNetworkByChainId(`0x${chainId.toString(16)}`);

            if (!network) {
                throw new Error(`Network with chainId ${chainId} not supported`);
            }

            try {
                await provider.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: network.chainId }]
                });
            } catch (switchError: unknown) {
                if ((switchError as { /**
                                       *
                                       */
                    code?: number
                }).code === 4902) {
                    await provider.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: network.chainId,
                            chainName: network.name,
                            nativeCurrency: network.nativeCurrency,
                            rpcUrls: Array.isArray(network.rpcUrls)
                                ? network.rpcUrls
                                : network.rpcUrls.mainnet,
                            blockExplorerUrls: network.blockExplorerUrls
                        }]
                    });
                } else {
                    throw switchError;
                }
            }

            setState(prev => ({
                ...prev,
                chainId
            }));

        } catch (error) {
            const walletError = error as WalletError;
            setState(prev => ({
                ...prev,
                error: walletError.message || 'Failed to switch network'
            }));
        }
    }, [state.provider]);

    const getAvailableWallets = useCallback(() => {
        return getAvailableProviders();
    }, []);

    return {
        ...state,
        connect,
        disconnect,
        switchNetwork,
        getAvailableWallets
    };
};
