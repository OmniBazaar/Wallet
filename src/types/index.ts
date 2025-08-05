export interface NetworkConfig {
    name: string;
    chainId: number | string;
    currency: string;
    rpcUrl: string;
    networkId?: number;
    rpcUrls?: {
        mainnet: string[];
        testnet: string[];
    } | string[];
    blockExplorerUrls?: string[];
    nativeCurrency?: {
        name: string;
        symbol: string;
        decimals: number;
    };
}

export interface WalletState {
    address: string | null;
    chainId: number | null;
    provider: { request: (params: unknown) => Promise<unknown> } | null;
    isConnecting: boolean;
    error: string | null;
}

export interface WalletContextType extends WalletState {
    connect: () => Promise<void>;
    disconnect: () => void;
    switchNetwork: (chainId: number) => Promise<void>;
    addNetwork: (networkConfig: NetworkConfig) => Promise<void>;
}

export interface WalletProviderProps {
    children: React.ReactNode;
    defaultNetwork?: string;
    supportedNetworks?: string[];
}

export interface WalletError extends Error {
    code?: string;
    data?: Record<string, unknown>;
}

export interface TransactionRequest {
    from?: string;
    to: string;
    value?: string;
    data?: string;
    gasLimit?: string;
    gasPrice?: string;
    nonce?: number;
}

export interface Transaction {
    hash: string;
    from: string;
    to: string;
    value: string;
    fee?: string;
    data?: string;
    gasLimit?: string;
    gasPrice?: string;
    nonce?: number;
    chainId?: number;
    blockNumber?: number;
    blockHash?: string;
    timestamp?: number;
    status?: 'pending' | 'confirmed' | 'failed';
}

export interface TransactionResponse extends Transaction {
    wait?: () => Promise<Transaction>;
}

export interface TokenInfo {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logoURI?: string;
}

export interface TokenBalance {
    token: TokenInfo;
    balance: string;
    formattedBalance: string;
}

export interface WalletEvents {
    onConnect?: (address: string) => void;
    onDisconnect?: () => void;
    onNetworkChange?: (chainId: number) => void;
    onAccountChange?: (address: string) => void;
    onError?: (error: WalletError) => void;
} 