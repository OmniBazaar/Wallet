import React from 'react';
import { WalletProvider } from '../contexts/WalletContext';
import { WalletConnect } from '../components/WalletConnect';

export default function Home() {
  return (
    <WalletProvider>
      <div className="container">
        <header>
          <h1>OmniWallet</h1>
          <p className="subtitle">Powered by OmniCoin</p>
          <WalletConnect />
        </header>
        <main>
          {/* Add more wallet features here */}
        </main>
      </div>
    </WalletProvider>
  );
} 