import { useState, useCallback } from 'react';
import { BrowserProvider, Contract, parseEther } from 'ethers';
import { WalletState } from '../types/wallet';
import { getProvider, getAvailableProviders } from '../config/providers';
import { getNetworkByChainId, getRpcUrl } from '../core/chains/evm/networks';

/**
 * React hook for managing wallet connection state and operations.
 * Provides connect/disconnect, network switching, and a list of
 * available wallet providers discovered in the environment.
 *
 * Note: This hook wraps an EIP‑1193 provider with `ethers.BrowserProvider`.
 */
export const useWallet = (): {
    /** Current connected wallet address */
    address: string | null;
    /** Current chain ID */
    chainId: number | null;
    /** Browser provider instance */
    provider: BrowserProvider | null;
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
    type WalletError = Error & { code?: number; data?: Record<string, unknown> };
    const [state, setState] = useState<WalletState>({
        address: null,
        chainId: null,
        provider: null,
        isConnected: false,
        isConnecting: false,
        error: null,
    });

    /**
     * Reset internal wallet state to its initial (disconnected) values.
     */
    const resetState = useCallback((): void => {
        setState({
            address: null,
            chainId: null,
            provider: null,
            isConnected: false,
            isConnecting: false,
            error: null
        });
    }, []);

    /**
     * Connect to a wallet provider by its configured ID.
     * Resolves after accounts are requested and the network is detected.
     *
     * @param providerId Identifier of the wallet provider to connect
     */
    const connect = useCallback(async (providerId: import('../config/providers').ProviderId): Promise<void> => {
        try {
            setState(prev => ({ ...prev, isConnecting: true, error: null }));

            const providerConfig = getProvider(providerId);
            if (!providerConfig) {
                throw new Error(`Provider ${providerId} not found`);
            }

            const injected = await providerConfig.getProvider();
            if (!injected) {
                throw new Error('Provider not available');
            }

            const ethersProvider = new BrowserProvider(injected as any);
            const accounts: string[] = await ethersProvider.send('eth_requestAccounts', []);
            const network = await ethersProvider.getNetwork();

            setState({
                address: accounts[0] ?? null,
                chainId: Number(network.chainId),
                provider: ethersProvider,
                isConnected: true,
                isConnecting: false,
                error: null
            });

            // Setup event listeners
            (injected as any).on?.('accountsChanged', (accounts: string[]) => {
                setState(prev => ({
                    ...prev,
                    address: accounts[0] || null
                }));
            });

            (injected as any).on?.('chainChanged', (chainId: string) => {
                setState(prev => ({
                    ...prev,
                    chainId: parseInt(chainId, 16)
                }));
            });

            (injected as any).on?.('disconnect', () => {
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

    /**
     * Disconnect from the current provider if supported and
     * clear local connection state.
     */
    const disconnect = useCallback((): void => {
        // EIP-1193 providers may support a disconnect method
        void (async () => {
            try {
                if (state.provider) {
                    const raw: any = (state.provider as any).provider ?? null;
                    if (raw?.disconnect) {
                        await raw.disconnect();
                    }
                }
            } catch {
                // swallow
            }
        })();
        resetState();
    }, [state.provider, resetState]);

    /**
     * Request the wallet to switch to a different EVM network.
     * If the chain is unknown to the wallet, it attempts to add it.
     *
     * @param chainId Target chain ID as a decimal number
     */
    const switchNetwork = useCallback(async (chainId: number): Promise<void> => {
        try {
            if (!state.provider) {
                throw new Error('No provider connected');
            }

            const provider = (state.provider as any).provider ?? state.provider;
            const network = getNetworkByChainId(chainId);

            if (!network) {
                throw new Error(`Network with chainId ${chainId} not supported`);
            }

            try {
                await (provider as any).request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: `0x${network.chainId.toString(16)}` }]
                });
            } catch (switchError: unknown) {
                if ((switchError as { code?: number }).code === 4902) {
                    await (provider as any).request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: `0x${network.chainId.toString(16)}`,
                            chainName: network.name,
                            nativeCurrency: { name: network.currency, symbol: network.currency, decimals: 18 },
                            rpcUrls: [getRpcUrl(network)],
                            blockExplorerUrls: network.explorer ? [network.explorer] : []
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

    /**
     * Return the list of available wallet providers for the UI.
     */
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
