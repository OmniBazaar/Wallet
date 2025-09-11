import { createContext, useContext, useReducer, useRef, ReactNode, JSX } from 'react';
import { BrowserProvider, Contract, formatEther, formatUnits, parseEther, parseUnits } from 'ethers';
import { WalletState, WalletContextType, TokenInfo, Transaction } from '../../types/wallet';

// Re-declare EthereumProvider to match globals.d.ts
interface EthereumProvider {
  isMetaMask?: boolean;
  isOmniBazaar?: boolean;
  chainId?: string;
  networkVersion?: string;
  selectedAddress?: string | null;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, callback: (data: unknown) => void) => void;
  removeListener?: (event: string, callback: (data: unknown) => void) => void;
  isConnected?: () => boolean;
  enable?: () => Promise<string[]>;
  send?: (method: string, params: unknown[]) => Promise<unknown>;
  sendAsync?: (request: unknown, callback: (error: Error | null, result?: unknown) => void) => void;
}

/**
 * Type guard for checking if ethereum provider has event listener support
 * @param provider - Ethereum provider to check
 * @returns True if provider has on method
 */
function hasEventSupport(provider: EthereumProvider): provider is EthereumProvider & { on: NonNullable<EthereumProvider['on']> } {
  return typeof provider.on === 'function';
}

// Window.ethereum is already typed in globals.d.ts

/**
 * Initial state for the wallet context
 */
const initialState: WalletState = {
  address: null,
  chainId: null,
  provider: null,
  isConnected: false,
  isConnecting: false,
  error: null,
};

/**
 * Action types for wallet state management
 */
type Action =
  | { type: 'CONNECT_START' }
  | { type: 'CONNECT_SUCCESS'; payload: { address: string; chainId: number; provider: { request: (params: unknown) => Promise<unknown> } } }
  | { type: 'CONNECT_ERROR'; payload: string }
  | { type: 'DISCONNECT' }
  | { type: 'UPDATE_CHAIN_ID'; payload: number };

/**
 * Reducer function for wallet state management
 * @param state - Current wallet state
 * @param action - Action to process
 * @returns Updated wallet state
 */
function reducer(state: WalletState, action: Action): WalletState {
  switch (action.type) {
    case 'CONNECT_START':
      return { ...state, isConnecting: true, error: null };
    case 'CONNECT_SUCCESS':
      return {
        ...state,
        isConnecting: false,
        isConnected: true,
        address: action.payload.address,
        chainId: action.payload.chainId,
        provider: action.payload.provider,
        error: null,
      };
    case 'CONNECT_ERROR':
      return {
        ...state,
        isConnecting: false,
        isConnected: false,
        error: action.payload,
      };
    case 'DISCONNECT':
      return initialState;
    case 'UPDATE_CHAIN_ID':
      return { ...state, chainId: action.payload };
    default:
      return state;
  }
}

/**
 * React context for wallet functionality
 */
const WalletContext = createContext<WalletContextType | undefined>(undefined);

/**
 * Provides wallet functionality to child components
 * @param props - Component props
 * @param props.children - React child components
 * @returns JSX element with wallet context provider
 */
export function WalletProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, dispatch] = useReducer(reducer, initialState);
  
  // Store the actual BrowserProvider separately for internal use
  const ethersProviderRef = useRef<BrowserProvider | undefined>(undefined);

  /**
   * Connects to user's Web3 wallet (MetaMask, etc.)
   * @throws {Error} When no Web3 provider is found or connection fails
   */
  const connect = async (): Promise<void> => {
    try {
      dispatch({ type: 'CONNECT_START' });

      // Type assertion is safe here because we check for undefined immediately
      const ethereumProvider = window.ethereum as EthereumProvider | undefined;
      if (ethereumProvider === undefined) {
        throw new Error('Please install MetaMask or another Web3 wallet');
      }

      const provider = new BrowserProvider(ethereumProvider);
      ethersProviderRef.current = provider;
      const accountsResponse: unknown = await provider.send('eth_requestAccounts', []);
      if (!Array.isArray(accountsResponse)) {
        throw new Error('Invalid response from wallet provider');
      }
      const accounts = accountsResponse as string[];
      const network = await provider.getNetwork();

      if (accounts.length === 0 || typeof accounts[0] !== 'string') {
        throw new Error('No accounts available');
      }

      dispatch({
        type: 'CONNECT_SUCCESS',
        payload: {
          address: accounts[0],
          chainId: Number(network.chainId),
          provider: { 
            request: async (params: unknown): Promise<unknown> => {
              const result: unknown = await provider.send('eth_call', [params]);
              return result;
            }
          },
        },
      });

      // Set up event listeners
      if (hasEventSupport(ethereumProvider)) {
        ethereumProvider.on('accountsChanged', (accounts: unknown) => {
          const accountsArray = accounts as string[];
          if (accountsArray.length === 0) {
            dispatch({ type: 'DISCONNECT' });
            ethersProviderRef.current = undefined;
          } else if (typeof accountsArray[0] === 'string' && state.provider !== null) {
            dispatch({
              type: 'CONNECT_SUCCESS',
              payload: {
                address: accountsArray[0],
                chainId: state.chainId ?? 1,
                provider: state.provider,
              },
            });
          }
        });

        ethereumProvider.on('chainChanged', (chainId: unknown) => {
          const chainIdStr = chainId as string;
          dispatch({ type: 'UPDATE_CHAIN_ID', payload: parseInt(chainIdStr, 16) });
        });
      }
    } catch (error) {
      dispatch({ type: 'CONNECT_ERROR', payload: (error as Error).message });
    }
  };

  /**
   * Disconnects from the current wallet
   */
  const disconnect = (): void => {
    ethersProviderRef.current = undefined;
    dispatch({ type: 'DISCONNECT' });
  };

  /**
   * Switches to a different blockchain network
   * @param chainId - Target chain ID
   * @throws {Error} When network switch fails
   */
  const switchNetwork = async (chainId: number): Promise<void> => {
    // Type assertion is safe here because we check for undefined immediately
    const ethereumProvider = window.ethereum as EthereumProvider | undefined;
    if (ethereumProvider === undefined) {
      throw new Error('No wallet provider available');
    }
    
    try {
      const switchResult: unknown = await ethereumProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
      // Acknowledge the result
      void switchResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to switch network';
      throw new Error(`Failed to switch network: ${errorMessage}`);
    }
  };

  /**
   * Sends a transaction (native token or ERC-20 token)
   * @param to - Recipient address
   * @param value - Amount to send
   * @param token - Optional token info for ERC-20 transfers
   * @returns Transaction hash
   * @throws {Error} When wallet not connected or transaction fails
   */
  const sendTransaction = async (to: string, value: string, token?: TokenInfo): Promise<string> => {
    if (ethersProviderRef.current === undefined || state.address === null) {
      throw new Error('Wallet not connected');
    }

    try {
      const signer = await ethersProviderRef.current.getSigner();
      
      if (typeof token !== 'undefined') {
        // ERC20 token transfer
        const contract = new Contract(
          token.address,
          ['function transfer(address to, uint256 amount) returns (bool)'],
          signer
        );
        const transferMethod = contract.getFunction('transfer');
        const tx = await transferMethod(to, parseUnits(value, token.decimals)) as { hash: string };
        return tx.hash;
      } else {
        // Native token transfer
        const tx = await signer.sendTransaction({
          to,
          value: parseEther(value),
        });
        return tx.hash;
      }
    } catch (error) {
      throw new Error('Transaction failed');
    }
  };

  /**
   * Gets the balance of native currency or ERC-20 token
   * @param token - Optional token info for ERC-20 balance
   * @returns Formatted balance as string
   * @throws {Error} When wallet not connected or balance query fails
   */
  const getBalance = async (token?: TokenInfo): Promise<string> => {
    if (ethersProviderRef.current === undefined || state.address === null) {
      throw new Error('Wallet not connected');
    }

    try {
      if (typeof token !== 'undefined') {
        const contract = new Contract(
          token.address,
          ['function balanceOf(address owner) view returns (uint256)'],
          ethersProviderRef.current
        );
        const balanceOfMethod = contract.getFunction('balanceOf');
        const balance = await balanceOfMethod(state.address) as bigint;
        return formatUnits(balance, token.decimals);
      } else {
        const balance = await ethersProviderRef.current.getBalance(state.address);
        return formatEther(balance);
      }
    } catch (error) {
      throw new Error('Failed to get balance');
    }
  };

  /**
   * Gets transaction history for the connected wallet
   * @returns Array of transaction records
   * @todo Implement blockchain explorer integration
   */
  const getTransactions = (): Promise<Transaction[]> => {
    // This is a placeholder. In a real implementation, you would:
    // 1. Query a blockchain explorer API
    // 2. Or maintain your own transaction history
    return Promise.resolve([]);
  };

  return (
    <WalletContext.Provider
      value={{
        state,
        connect,
        disconnect,
        switchNetwork,
        sendTransaction,
        getBalance,
        getTransactions,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

/**
 * Hook to access wallet functionality in React components
 * @returns Wallet context with state and methods
 * @throws {Error} When used outside of WalletProvider
 * @example
 * ```tsx
 * const { state, connect, sendTransaction } = useWallet();
 * ```
 */
export function useWallet(): WalletContextType {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}