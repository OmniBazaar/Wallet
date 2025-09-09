/**
 * Current state of the wallet connection
 */
export interface WalletState {
    /** Current wallet address */
    address: string | null;
    /** Current chain ID */
    chainId: number | null;
    /** Browser provider instance */
    provider: { request: (params: unknown) => Promise<unknown> } | null;
    /** Whether wallet is connected */
    isConnected: boolean;
    /** Whether connection is in progress */
    isConnecting: boolean;
    /** Connection error message */
    error: string | null;
}

/**
 * Information about an ERC-20 token or native currency
 */
export interface TokenInfo {
    /** Token contract address on the blockchain */
    address: string;
    /** Token symbol (e.g., 'ETH', 'XOM') */
    symbol: string;
    /** Full token name */
    name: string;
    /** Number of decimal places for the token */
    decimals: number;
}

/**
 * Represents a blockchain transaction
 */
export interface Transaction {
    /** Transaction hash on the blockchain */
    hash: string;
    /** Address that sent the transaction */
    from: string;
    /** Address that received the transaction */
    to: string;
    /** Amount transferred in the transaction */
    value: string;
    /** Unix timestamp when transaction was created */
    timestamp: number;
    /** Current status of the transaction */
    status: 'pending' | 'confirmed' | 'failed';
    /** Token information for token transfers (optional for native currency) */
    token?: TokenInfo;
}

/**
 * Context type for wallet functionality in React components
 */
export interface WalletContextType {
    /** Current wallet state */
    state: WalletState;
    /** Connect to a wallet provider */
    connect: () => Promise<void>;
    /** Disconnect from the current wallet */
    disconnect: () => void;
    /** Switch to a different blockchain network */
    switchNetwork: (chainId: number) => Promise<void>;
    /** Send a transaction to the specified address */
    sendTransaction: (to: string, value: string, token?: TokenInfo) => Promise<string>;
    /** Get balance for native currency or specified token */
    getBalance: (token?: TokenInfo) => Promise<string>;
    /** Retrieve transaction history for the wallet */
    getTransactions: () => Promise<Transaction[]>;
}
