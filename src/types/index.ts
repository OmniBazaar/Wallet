/**
 * Configuration for blockchain networks
 */
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

/**
 * Current state of wallet connection and provider
 */
export interface WalletState {
    address: string | null;
    chainId: number | null;
    provider: { request: (params: unknown) => Promise<unknown> } | null;
    isConnecting: boolean;
    error: string | null;
}

/**
 * Extended wallet context with action methods
 */
export interface WalletContextType extends WalletState {
    connect: () => Promise<void>;
    disconnect: () => void;
    switchNetwork: (chainId: number) => Promise<void>;
    addNetwork: (networkConfig: NetworkConfig) => Promise<void>;
}

/**
 * Props for the WalletProvider React component
 */
export interface WalletProviderProps {
    children: React.ReactNode;
    defaultNetwork?: string;
    supportedNetworks?: string[];
}

/**
 * Extended error interface with additional wallet context
 */
export interface WalletError extends Error {
    code?: string;
    data?: Record<string, unknown>;
}

/**
 * Parameters for initiating a blockchain transaction
 */
export interface TransactionRequest {
    from?: string;
    to: string;
    value?: string;
    data?: string;
    gasLimit?: string;
    gasPrice?: string;
    nonce?: number;
}

/**
 * Complete transaction data including confirmation status
 */
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

/**
 * Transaction response with additional wait method
 */
export interface TransactionResponse extends Transaction {
    wait?: () => Promise<Transaction>;
}

/**
 * Basic information about an ERC-20 token or native currency
 */
export interface TokenInfo {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logoURI?: string;
}

/**
 * Token balance information with formatted display
 */
export interface TokenBalance {
    token: TokenInfo;
    balance: string;
    formattedBalance: string;
}

/**
 * Event callbacks for wallet state changes
 */
export interface WalletEvents {
    onConnect?: (address: string) => void;
    onDisconnect?: () => void;
    onNetworkChange?: (chainId: number) => void;
    onAccountChange?: (address: string) => void;
    onError?: (error: WalletError) => void;
} 