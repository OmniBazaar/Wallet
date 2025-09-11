import { JSX } from 'react';
import { WalletProvider } from '../ui/contexts/WalletContext';
import WalletConnect from '../ui/widgets/omnicoin/components/WalletConnect';

/**
 * Home page component for the OmniWallet application
 * 
 * @returns JSX element containing the main wallet interface
 */
export default function Home(): JSX.Element {
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
