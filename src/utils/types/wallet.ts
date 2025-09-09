/**
 * Represents the current state of the wallet connection and provider information
 */
export interface WalletState {
  /**
   * The connected wallet address or null if not connected
   */
  address: string | null;
  /**
   * The current blockchain network chain ID or null if not connected
   */
  chainId: number | null;
  /**
   * The web3 provider instance for making blockchain requests
   */
  provider: {
    /**
     * Makes RPC requests to the blockchain provider
     */
    request: (args: {
      /**
       * The RPC method name to call
       */
      method: string;
      /**
       * Optional parameters for the RPC method
       */
      params?: unknown[];
    }) => Promise<unknown>;
  } | null;
  /**
   * Whether the wallet is currently connected to a provider
   */
  isConnected: boolean;
  /**
   * Whether the wallet is in the process of connecting
   */
  isConnecting: boolean;
  /**
   * Any error that occurred during wallet operations
   */
  error: string | null;
}

/**
 * Represents information about an ERC-20 token or native blockchain token
 */
export interface TokenInfo {
  /**
   * The contract address of the token (or native token identifier)
   */
  address: string;
  /**
   * The token symbol (e.g., 'ETH', 'USDC', 'XOM')
   */
  symbol: string;
  /**
   * The full human-readable name of the token
   */
  name: string;
  /**
   * Number of decimal places the token uses (typically 18 for ERC-20)
   */
  decimals: number;
  /**
   * Optional URL to the token's logo image
   */
  logoURI?: string;
  /**
   * The blockchain network chain ID where this token exists
   */
  chainId: number;
}

/**
 * Represents a blockchain transaction with metadata
 */
export interface Transaction {
  /**
   * The unique transaction hash on the blockchain
   */
  hash: string;
  /**
   * The address that sent the transaction
   */
  from: string;
  /**
   * The address that received the transaction
   */
  to: string;
  /**
   * The amount transferred in the transaction (in base units)
   */
  value: string;
  /**
   * Optional token information if this was a token transfer
   */
  token?: TokenInfo;
  /**
   * Unix timestamp when the transaction was created
   */
  timestamp: number;
  /**
   * Current status of the transaction
   */
  status: 'pending' | 'confirmed' | 'failed';
}

/**
 * React context type for wallet state management and operations
 */
export interface WalletContextType {
  /**
   * Current wallet state including connection status and provider info
   */
  state: WalletState;
  /**
   * Connects to a wallet provider
   */
  connect: () => Promise<void>;
  /**
   * Disconnects from the current wallet provider
   */
  disconnect: () => void;
  /**
   * Switches to a different blockchain network
   */
  switchNetwork: (chainId: number) => Promise<void>;
  /**
   * Sends a transaction to the specified address with optional token
   */
  sendTransaction: (to: string, value: string, token?: TokenInfo) => Promise<string>;
  /**
   * Gets the balance of native currency or specified token
   */
  getBalance: (token?: TokenInfo) => Promise<string>;
  /**
   * Retrieves the transaction history for the connected wallet
   */
  getTransactions: () => Promise<Transaction[]>;
} 