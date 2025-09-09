/* @jsxImportSource react */
import React, { useState } from 'react';
import { useNFTs } from '../../../../hooks/useNFTs';
import { useNFTTransfer } from '../../../../hooks/useNFTTransfer';
import { OmniCoinLoading } from './OmniCoinLoading';
import { OmniCoinToast } from './OmniCoinToast';

/**
 * Simple tooltip component interface to replace missing OmniCoinTooltip
 */
interface TooltipProps {
  /** Tooltip text to display */
  text: string;
  /** Child elements to wrap with tooltip */
  children: React.ReactNode;
}

/**
 * Basic tooltip component replacement
 * @param props - Component props
 * @param props.text - Tooltip text to display
 * @param props.children - Child elements to wrap with tooltip
 * @returns React component with tooltip functionality
 */
const SimpleTooltip: React.FC<TooltipProps> = ({ text, children }) => (
  <div title={text}>
    {children}
  </div>
);

/**
 * NFT item interface for gallery display
 */
interface NFTItem {
  /** Contract address where NFT is minted */
  contractAddress: string;
  /** Unique token identifier */
  tokenId: string;
  /** Owner address */
  owner: string;
  /** NFT metadata */
  metadata?: {
    /** NFT name */
    name?: string;
    /** NFT description */
    description?: string;
    /** Image URL or IPFS hash */
    image?: string;
    /** External URL for more info */
    external_url?: string;
  };
}

// Inline styles to avoid styled-components typing issues
const galleryContainerStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gap: '1rem',
  padding: '1rem'
};

const nftCardStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: '8px',
  overflow: 'hidden',
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  transition: 'transform 0.2s ease'
};

const nftImageStyle: React.CSSProperties = {
  width: '100%',
  height: '200px',
  objectFit: 'cover'
};

const nftInfoStyle: React.CSSProperties = {
  padding: '1rem'
};

const nftNameStyle: React.CSSProperties = {
  margin: '0',
  fontSize: '1rem',
  color: '#1f2937'
};

const nftDescriptionStyle: React.CSSProperties = {
  margin: '0.5rem 0',
  fontSize: '0.875rem',
  color: '#6b7280'
};

const transferButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem',
  background: '#3b82f6',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  transition: 'opacity 0.2s ease'
};

const transferButtonDisabledStyle: React.CSSProperties = {
  ...transferButtonStyle,
  background: '#9ca3af',
  cursor: 'not-allowed'
};

const transferDialogStyle: React.CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  background: '#ffffff',
  padding: '2rem',
  borderRadius: '8px',
  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
  zIndex: 1000
};

const dialogOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.5)',
  zIndex: 999
};

const dialogInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem',
  margin: '0.5rem 0',
  border: '1px solid #e5e7eb',
  borderRadius: '4px'
};

const dialogButtonStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  margin: '0.5rem',
  background: '#3b82f6',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer'
};

interface NFTGalleryProps {
  /** Optional contract address to filter NFTs */
  _contractAddress?: string;
}

/**
 * NFT Gallery component for displaying and managing NFT collections
 * @param props - Component props
 * @param props._contractAddress - Optional contract address filter (currently unused)
 * @returns React component for NFT gallery
 */
export const NFTGallery: React.FC<NFTGalleryProps> = ({ _contractAddress }) => {
  const { nfts, isLoading, error, refetch } = useNFTs();
  const [selectedNFT, setSelectedNFT] = useState<NFTItem | null>(null);
  const [recipient, setRecipient] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info' | 'pending'>('info');

  const { transferNFT, isTransferring, error: _transferError } = useNFTTransfer();

  const handleTransfer = async (): Promise<void> => {
    if (selectedNFT === null) return;

    try {
      setToastType('pending');
      setToastMessage('Processing NFT transfer...');
      setShowToast(true);

      await transferNFT(recipient, selectedNFT.tokenId);

      setToastType('success');
      setToastMessage('NFT transferred successfully!');
      setSelectedNFT(null);
      setRecipient('');
      await refetch();
    } catch (err) {
      setToastType('error');
      setToastMessage(err instanceof Error ? err.message : 'Transfer failed');
    }
  };

  if (isLoading) {
    return <OmniCoinLoading text="Loading NFTs..." />;
  }

  if (typeof error === 'string' && error.length > 0) {
    return <OmniCoinToast type="error" message={error} />;
  }

  return (
    <>
      <div style={galleryContainerStyle}>
        {nfts.map((nft: NFTItem) => (
          <div key={`${nft.contractAddress}-${nft.tokenId}`} style={nftCardStyle}>
            <img 
              src={nft.metadata?.image ?? ''} 
              alt={nft.metadata?.name ?? 'NFT'} 
              style={nftImageStyle}
            />
            <div style={nftInfoStyle}>
              <h3 style={nftNameStyle}>{nft.metadata?.name ?? 'Unnamed NFT'}</h3>
              <p style={nftDescriptionStyle}>{nft.metadata?.description ?? 'No description available'}</p>
              <SimpleTooltip text="Transfer this NFT">
                <button
                  onClick={() => setSelectedNFT(nft)}
                  disabled={isTransferring}
                  style={isTransferring ? transferButtonDisabledStyle : transferButtonStyle}
                >
                  Transfer
                </button>
              </SimpleTooltip>
            </div>
          </div>
        ))}
      </div>

      {selectedNFT !== null && (
        <>
          <div style={dialogOverlayStyle} onClick={() => setSelectedNFT(null)} />
          <div style={transferDialogStyle}>
            <h3>Transfer {selectedNFT.metadata?.name ?? 'NFT'}</h3>
            <input
              type="text"
              placeholder="Recipient Address"
              value={recipient}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecipient(e.target.value)}
              style={dialogInputStyle}
            />
            <div>
              <button onClick={() => { void handleTransfer(); }} disabled={isTransferring} style={dialogButtonStyle}>
                {isTransferring ? 'Transferring...' : 'Transfer'}
              </button>
              <button onClick={() => setSelectedNFT(null)} style={dialogButtonStyle}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {showToast && (
        <OmniCoinToast
          type={toastType}
          message={toastMessage}
          onClose={() => setShowToast(false)}
        />
      )}
    </>
  );
};