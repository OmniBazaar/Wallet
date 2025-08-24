import { BrowserProvider } from 'ethers';

/**
 * Current state of the wallet connection
 */
export interface WalletState {
    /** Current wallet address */
    address: string | null;
    /** Current chain ID */
    chainId: number | null;
    /** Browser provider instance */
    provider: BrowserProvider | null;
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
    /** Token contract address */
    address: string;
    /** Token symbol (e.g., 'ETH', 'XOM') */
    symbol: string;
    /** Full token name */
    name: string;
    /**
     *
     */
    decimals: number;
}

/**
 * Represents a blockchain transaction
 */
export interface Transaction {
    /**
     *
     */
    hash: string;
    /**
     *
     */
    from: string;
    /**
     *
     */
    to: string;
    /**
     *
     */
    value: string;
    /**
     *
     */
    timestamp: number;
    /**
     *
     */
    status: 'pending' | 'confirmed' | 'failed';
    /**
     *
     */
    token?: TokenInfo;
}

/**
 * Context type for wallet functionality in React components
 */
export interface WalletContextType {
    /**
     *
     */
    state: WalletState;
    /**
     *
     */
    connect: () => Promise<void>;
    /**
     *
     */
    disconnect: () => void;
    /**
     *
     */
    switchNetwork: (chainId: number) => Promise<void>;
    /**
     *
     */
    sendTransaction: (to: string, value: string, token?: TokenInfo) => Promise<string>;
    /**
     *
     */
    getBalance: (token?: TokenInfo) => Promise<string>;
    /**
     *
     */
    getTransactions: () => Promise<Transaction[]>;
}
