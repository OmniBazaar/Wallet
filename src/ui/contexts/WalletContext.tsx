/* @jsxImportSource react */
import React, { createContext, useContext, useReducer } from 'react';
import { BrowserProvider, Contract, formatEther, formatUnits, parseEther, parseUnits } from 'ethers';
import { WalletState, WalletContextType, TokenInfo, Transaction } from '../../types/wallet';

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
  | { type: 'CONNECT_SUCCESS'; payload: { address: string; chainId: number; provider: BrowserProvider } }
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
 * @param children - React child components
 * @returns JSX element with wallet context provider
 */
export function WalletProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [state, dispatch] = useReducer(reducer, initialState);

  /**
   * Connects to user's Web3 wallet (MetaMask, etc.)
   * @throws {Error} When no Web3 provider is found or connection fails
   */
  const connect = async (): Promise<void> => {
    try {
      dispatch({ type: 'CONNECT_START' });

      if ((window as any).ethereum == null) {
        throw new Error('Please install MetaMask or another Web3 wallet');
      }

      const provider = new BrowserProvider((window as any).ethereum);
      const accounts: string[] = await provider.send('eth_requestAccounts', []);
      const network = await provider.getNetwork();

      dispatch({
        type: 'CONNECT_SUCCESS',
        payload: {
          address: accounts[0],
          chainId: Number(network.chainId),
          provider,
        },
      });

      // Set up event listeners
      (window as any).ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length === 0) {
          dispatch({ type: 'DISCONNECT' });
        } else {
          dispatch({
            type: 'CONNECT_SUCCESS',
            payload: {
              address: accounts[0],
              chainId: state.chainId as number,
              provider: state.provider,
            },
          });
        }
      });

      (window as any).ethereum.on('chainChanged', (chainId: string) => {
        dispatch({ type: 'UPDATE_CHAIN_ID', payload: parseInt(chainId, 16) });
      });
    } catch (error) {
      dispatch({ type: 'CONNECT_ERROR', payload: (error as Error).message });
    }
  };

  /**
   * Disconnects from the current wallet
   */
  const disconnect = (): void => {
    dispatch({ type: 'DISCONNECT' });
  };

  /**
   * Switches to a different blockchain network
   * @param chainId - Target chain ID
   * @throws {Error} When network switch fails
   */
  const switchNetwork = async (chainId: number): Promise<void> => {
    try {
      await (window as any).ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
    } catch (error) {
      throw new Error('Failed to switch network');
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
    if (!state.provider || !state.address) {
      throw new Error('Wallet not connected');
    }

    try {
      const signer = await state.provider.getSigner();
      let tx: any;

      if (token) {
        // ERC20 token transfer
        const contract = new Contract(
          token.address,
          ['function transfer(address to, uint256 amount) returns (bool)'],
          signer
        );
        tx = await contract.transfer(to, parseUnits(value, token.decimals));
      } else {
        // Native token transfer
        tx = await signer.sendTransaction({
          to,
          value: parseEther(value),
        });
      }

      return tx.hash;
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
    if (!state.provider || !state.address) {
      throw new Error('Wallet not connected');
    }

    try {
      if (token) {
        const contract = new Contract(
          token.address,
          ['function balanceOf(address owner) view returns (uint256)'],
          state.provider
        );
        const balance = await contract.balanceOf(state.address);
        return formatUnits(balance, token.decimals);
      } else {
        const balance = await state.provider.getBalance(state.address);
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
  const getTransactions = async (): Promise<Transaction[]> => {
    // This is a placeholder. In a real implementation, you would:
    // 1. Query a blockchain explorer API
    // 2. Or maintain your own transaction history
    return [];
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
