import React, { createContext, useContext, useReducer } from 'react';
import { ethers } from 'ethers';
import { WalletState, WalletContextType, TokenInfo, Transaction } from '../types/wallet';

const initialState: WalletState = {
  address: null,
  chainId: null,
  provider: null,
  isConnected: false,
  isConnecting: false,
  error: null,
};

type Action =
  | { type: 'CONNECT_START' }
  | { type: 'CONNECT_SUCCESS'; payload: { address: string; chainId: number; provider: ethers.providers.Web3Provider } }
  | { type: 'CONNECT_ERROR'; payload: string }
  | { type: 'DISCONNECT' }
  | { type: 'UPDATE_CHAIN_ID'; payload: number };

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

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [state, dispatch] = useReducer(reducer, initialState);

  const connect = async (): Promise<void> => {
    try {
      dispatch({ type: 'CONNECT_START' });

      if (!window.ethereum) {
        throw new Error('Please install MetaMask or another Web3 wallet');
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      const network = await provider.getNetwork();

      dispatch({
        type: 'CONNECT_SUCCESS',
        payload: {
          address: accounts[0],
          chainId: network.chainId,
          provider,
        },
      });

      // Set up event listeners
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
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

      window.ethereum.on('chainChanged', (chainId: string) => {
        dispatch({ type: 'UPDATE_CHAIN_ID', payload: parseInt(chainId, 16) });
      });
    } catch (error) {
      dispatch({ type: 'CONNECT_ERROR', payload: (error as Error).message });
    }
  };

  const disconnect = (): void => {
    dispatch({ type: 'DISCONNECT' });
  };

  const switchNetwork = async (chainId: number): Promise<void> => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
    } catch (error) {
      throw new Error('Failed to switch network');
    }
  };

  const sendTransaction = async (to: string, value: string, token?: TokenInfo): Promise<string> => {
    if (!state.provider || !state.address) {
      throw new Error('Wallet not connected');
    }

    try {
      const signer = state.provider.getSigner();
      let tx;

      if (token) {
        // ERC20 token transfer
        const contract = new ethers.Contract(
          token.address,
          ['function transfer(address to, uint256 amount) returns (bool)'],
          signer
        );
        tx = await contract.transfer(to, ethers.utils.parseUnits(value, token.decimals));
      } else {
        // Native token transfer
        tx = await signer.sendTransaction({
          to,
          value: ethers.utils.parseEther(value),
        });
      }

      return tx.hash;
    } catch (error) {
      throw new Error('Transaction failed');
    }
  };

  const getBalance = async (token?: TokenInfo): Promise<string> => {
    if (!state.provider || !state.address) {
      throw new Error('Wallet not connected');
    }

    try {
      if (token) {
        const contract = new ethers.Contract(
          token.address,
          ['function balanceOf(address owner) view returns (uint256)'],
          state.provider
        );
        const balance = await contract.balanceOf(state.address);
        return ethers.utils.formatUnits(balance, token.decimals);
      } else {
        const balance = await state.provider.getBalance(state.address);
        return ethers.utils.formatEther(balance);
      }
    } catch (error) {
      throw new Error('Failed to get balance');
    }
  };

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

export function useWallet(): WalletContextType {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
} 