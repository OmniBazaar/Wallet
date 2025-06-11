import { BrowserProvider } from 'ethers';

export interface WalletState {
    address: string | null;
    chainId: number | null;
    provider: BrowserProvider | null;
    isConnected: boolean;
    isConnecting: boolean;
    error: string | null;
}

export interface TokenInfo {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
}

export interface Transaction {
    hash: string;
    from: string;
    to: string;
    value: string;
    timestamp: number;
    status: 'pending' | 'confirmed' | 'failed';
    token?: TokenInfo;
}

export interface WalletContextType {
    state: WalletState;
    connect: () => Promise<void>;
    disconnect: () => void;
    switchNetwork: (chainId: number) => Promise<void>;
    sendTransaction: (to: string, value: string, token?: TokenInfo) => Promise<string>;
    getBalance: (token?: TokenInfo) => Promise<string>;
    getTransactions: () => Promise<Transaction[]>;
} 