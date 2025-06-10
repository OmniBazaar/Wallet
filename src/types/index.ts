export interface NetworkConfig {
    name: string;
    chainId: string;
    networkId: number;
    rpcUrls: {
        mainnet: string[];
        testnet: string[];
    } | string[];
    blockExplorerUrls: string[];
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
}

export interface WalletState {
    address: string | null;
    chainId: number | null;
    provider: any | null;
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
    data?: any;
}

export interface TransactionRequest {
    to: string;
    value?: string;
    data?: string;
    gasLimit?: string;
    gasPrice?: string;
    nonce?: number;
}

export interface TransactionResponse {
    hash: string;
    from: string;
    to: string;
    value: string;
    data: string;
    gasLimit: string;
    gasPrice: string;
    nonce: number;
    chainId: number;
    blockNumber?: number;
    blockHash?: string;
    timestamp?: number;
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