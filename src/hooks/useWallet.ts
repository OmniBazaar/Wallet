import { useState, useCallback } from 'react';
import { BrowserProvider } from 'ethers';
import { WalletState } from '../types/wallet';
import { getProvider, getAvailableProviders, type ProviderId } from '../config/providers';
import { getNetworkByChainId, getRpcUrl } from '../core/chains/evm/networks';

/**
 * React hook for managing wallet connection state and operations.
 * Provides connect/disconnect, network switching, and a list of
 * available wallet providers discovered in the environment.
 *
 * Note: This hook wraps an EIP‑1193 provider with `ethers.BrowserProvider`.
 * @returns Wallet hook interface with connection state and methods
 */
export const useWallet = (): {
    /** Current connected wallet address */
    address: string | null;
    /** Current chain ID */
    chainId: number | null;
    /** Browser provider instance */
    provider: { request: (params: unknown) => Promise<unknown> } | null;
    /** Whether connection is in progress */
    isConnecting: boolean;
    /** Connection error message */
    error: string | null;
    /** Connect to a wallet provider */
    connect: (providerId: ProviderId) => Promise<void>;
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
            if (providerConfig === null || providerConfig === undefined) {
                throw new Error(`Provider ${providerId} not found`);
            }

            const injected = await providerConfig.getProvider();
            if (injected === null) {
                throw new Error('Provider not available');
            }

            const ethersProvider = new BrowserProvider(injected as unknown as import('ethers').Eip1193Provider);
            const accounts = await ethersProvider.send('eth_requestAccounts', []) as string[];
            const network = await ethersProvider.getNetwork();

            setState({
                address: (Array.isArray(accounts) && accounts.length > 0) ? accounts[0] ?? null : null,
                chainId: Number(network.chainId),
                provider: { request: (params: unknown) => ethersProvider.send((params as { method: string }).method, (params as { params?: unknown[] }).params ?? []) },
                isConnected: true,
                isConnecting: false,
                error: null
            });

            // Setup event listeners
            const providerWithEvents = injected as unknown as {
                on?: (event: string, callback: (...args: unknown[]) => void) => void;
            };
            providerWithEvents.on?.('accountsChanged', (accounts: unknown) => {
                if (Array.isArray(accounts) && accounts.every(acc => typeof acc === 'string')) {
                    setState(prev => ({
                        ...prev,
                        address: accounts[0] ?? null
                    }));
                }
            });

            providerWithEvents.on?.('chainChanged', (chainId: unknown) => {
                if (typeof chainId === 'string') {
                    setState(prev => ({
                        ...prev,
                        chainId: parseInt(chainId, 16)
                    }));
                }
            });

            providerWithEvents.on?.('disconnect', () => {
                resetState();
            });

        } catch (error) {
            const walletError = error as WalletError;
            setState(prev => ({
                ...prev,
                isConnecting: false,
                error: walletError.message ?? 'Failed to connect wallet'
            }));
        }
    }, [resetState]);

    /**
     * Disconnect from the current provider if supported and
     * clear local connection state.
     */
    const disconnect = useCallback((): void => {
        // EIP-1193 providers may support a disconnect method
        void (async (): Promise<void> => {
            try {
                if (state.provider !== null) {
                    const providerAny = state.provider as unknown as {
                        provider?: { disconnect?: () => Promise<void> };
                        disconnect?: () => Promise<void>;
                    };
                    const raw = providerAny.provider ?? providerAny;
                    if (raw?.disconnect !== undefined) {
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
            if (state.provider === null) {
                throw new Error('No provider connected');
            }

            const providerAny = state.provider as unknown as {
                provider?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
                request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
            };
            const provider = providerAny.provider ?? providerAny;
            const network = getNetworkByChainId(chainId);

            if (network === null || network === undefined) {
                throw new Error(`Network with chainId ${chainId} not supported`);
            }

            try {
                await provider.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: `0x${network.chainId.toString(16)}` }]
                });
            } catch (switchError: unknown) {
                const errorWithCode = switchError as { code?: number };
                if (errorWithCode.code === 4902) {
                    await provider.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: `0x${network.chainId.toString(16)}`,
                            chainName: network.name,
                            nativeCurrency: { name: network.currency, symbol: network.currency, decimals: 18 },
                            rpcUrls: [getRpcUrl(network)],
                            ...(network.explorer !== undefined && { blockExplorerUrls: [network.explorer] })
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
                error: walletError.message ?? 'Failed to switch network'
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
