import React from 'react';
import { useWallet } from '../contexts/WalletContext';

export function WalletConnect() {
  const { state, connect, disconnect } = useWallet();

  return (
    <div className="wallet-connect">
      {!state.isConnected ? (
        <button
          onClick={connect}
          disabled={state.isConnecting}
          className="connect-button"
        >
          {state.isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      ) : (
        <div className="wallet-info">
          <span className="address">
            {state.address?.slice(0, 6)}...{state.address?.slice(-4)}
          </span>
          <button onClick={disconnect} className="disconnect-button">
            Disconnect
          </button>
        </div>
      )}
      {state.error && <div className="error">{state.error}</div>}
    </div>
  );
} 