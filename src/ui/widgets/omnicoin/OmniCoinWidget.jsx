import React from 'react';
import { WalletProvider } from '../../../contexts/WalletContext';
import { WalletConnect } from './components/WalletConnect';
import { TokenBalance } from './components/TokenBalance';
import { NFTGallery } from './components/NFTGallery';
import { OmniCoinErrorBoundary } from './components/OmniCoinErrorBoundary';
import { OmniCoinLoading } from './components/OmniCoinLoading';

// Replace with your OmniCoin token address or any ERC20 for testing
const OMNICOIN_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';

// Replace with your NFT contract address
const NFT_CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000';

export const OmniCoinWidget = () => (
    <WalletProvider>
        <OmniCoinErrorBoundary>
            <React.Suspense fallback={<OmniCoinLoading text="Loading wallet..." />}>
                <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
                    <h2>OmniCoin Wallet</h2>
                    <WalletConnect />
                    <div style={{ marginTop: 32 }}>
                        <h3>Token Balances</h3>
                        <TokenBalance tokenAddress={OMNICOIN_TOKEN_ADDRESS} />
                    </div>
                    <div style={{ marginTop: 32 }}>
                        <h3>NFT Collection</h3>
                        <NFTGallery contractAddress={NFT_CONTRACT_ADDRESS} />
                    </div>
                </div>
            </React.Suspense>
        </OmniCoinErrorBoundary>
    </WalletProvider>
);

export default OmniCoinWidget; 