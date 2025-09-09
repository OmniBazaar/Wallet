/**
 * Configuration for blockchain networks
 */
export interface NetworkConfig {
    /** Network display name */
    name: string;
    /** Chain identifier (numeric or hex string) */
    chainId: number | string;
    /** Native currency symbol */
    currency: string;
    /** Primary RPC endpoint URL */
    rpcUrl: string;
    /** WebSocket URL for real-time connection (optional) */
    wsUrl?: string;
    /** Legacy network ID (optional) */
    networkId?: number;
    /** RPC endpoint URLs by network type */
    rpcUrls?: {
        mainnet: string[];
        testnet: string[];
    } | string[];
    /** Block explorer URLs */
    blockExplorerUrls?: string[];
    /** Native currency metadata */
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
    /** Currently connected wallet address */
    address: string | null;
    /** Current blockchain network chain ID */
    chainId: number | null;
    /** Wallet provider instance with request method */
    provider: { request: (params: unknown) => Promise<unknown> } | null;
    /** Whether wallet connection is in progress */
    isConnecting: boolean;
    /** Current error message, if any */
    error: string | null;
}

/**
 * Extended wallet context with action methods
 */
export interface WalletContextType extends WalletState {
    /** Initiate connection to wallet */
    connect: () => Promise<void>;
    /** Disconnect from current wallet */
    disconnect: () => void;
    /** Switch to a different blockchain network */
    switchNetwork: (chainId: number) => Promise<void>;
    /** Add a new network configuration to wallet */
    addNetwork: (networkConfig: NetworkConfig) => Promise<void>;
}

/**
 * Props for the WalletProvider React component
 */
export interface WalletProviderProps {
    /** React children to render within provider */
    children: React.ReactNode;
    /** Default network to connect to */
    defaultNetwork?: string;
    /** List of supported network names */
    supportedNetworks?: string[];
}

/**
 * Extended error interface with additional wallet context
 */
export interface WalletError extends Error {
    /** Error code identifier */
    code?: string;
    /** Additional error context data */
    data?: Record<string, unknown>;
}

/**
 * Parameters for initiating a blockchain transaction
 */
export interface TransactionRequest {
    /** Sender address (optional, defaults to current account) */
    from?: string;
    /** Recipient address */
    to: string;
    /** Amount to send in wei (optional) */
    value?: string;
    /** Transaction data payload (optional) */
    data?: string;
    /** Maximum gas units to consume (optional) */
    gasLimit?: string;
    /** Gas price in wei (optional) */
    gasPrice?: string;
    /** Transaction nonce (optional) */
    nonce?: number;
}

/**
 * Complete transaction data including confirmation status
 */
export interface Transaction {
    /** Transaction hash identifier */
    hash: string;
    /** Sender address */
    from: string;
    /** Recipient address */
    to: string;
    /** Transaction value in wei */
    value: string;
    /** Total transaction fee paid */
    fee?: string;
    /** Transaction data payload */
    data?: string;
    /** Gas limit for the transaction */
    gasLimit?: string;
    /** Gas price used for the transaction */
    gasPrice?: string;
    /** Transaction nonce */
    nonce?: number;
    /** Chain ID where transaction was executed */
    chainId?: number;
    /** Block number containing this transaction */
    blockNumber?: number;
    /** Hash of the block containing this transaction */
    blockHash?: string;
    /** Block timestamp */
    timestamp?: number;
    /** Current transaction status */
    status?: 'pending' | 'confirmed' | 'failed';
}

/**
 * Transaction response with additional wait method
 */
export interface TransactionResponse extends Transaction {
    /** Wait for transaction confirmation */
    wait?: () => Promise<Transaction>;
}

/**
 * Basic information about an ERC-20 token or native currency
 */
export interface TokenInfo {
    /** Token contract address */
    address: string;
    /** Token symbol (e.g., 'ETH', 'USDC') */
    symbol: string;
    /** Full token name */
    name: string;
    /** Number of decimal places for the token */
    decimals: number;
    /** URL to token logo image */
    logoURI?: string;
}

/**
 * Token balance information with formatted display
 */
export interface TokenBalance {
    /** Token information */
    token: TokenInfo;
    /** Raw balance amount */
    balance: string;
    /** Human-readable formatted balance */
    formattedBalance: string;
}

/**
 * Event callbacks for wallet state changes
 */
export interface WalletEvents {
    /** Callback when wallet connects successfully */
    onConnect?: (address: string) => void;
    /** Callback when wallet disconnects */
    onDisconnect?: () => void;
    /** Callback when network changes */
    onNetworkChange?: (chainId: number) => void;
    /** Callback when account changes */
    onAccountChange?: (address: string) => void;
    /** Callback when wallet error occurs */
    onError?: (error: WalletError) => void;
} 