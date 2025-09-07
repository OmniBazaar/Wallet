/* @jsxImportSource react */
import React, { useState } from 'react';
import styled from 'styled-components';
import { useNFTs } from '../../../../hooks/useNFTs';
import { useNFTTransfer } from '../../../../hooks/useNFTTransfer';
import { OmniCoinLoading } from './OmniCoinLoading';
import { OmniCoinToast } from './OmniCoinToast';
// @ts-ignore - JSX component without types
import { OmniCoinTooltip } from './OmniCoinTooltip';
import type { NFTItem } from '../../../../types/nft';

// Theme interface for styled-components
interface Theme {
  colors: {
    background: string;
    primary: string;
    disabled: string;
    border: string;
    text: {
      primary: string;
      secondary: string;
    };
  };
}

interface ThemeProps {
  theme?: Theme;
}

const GalleryContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  padding: 1rem;
`;

const NFTCard = styled.div`
  background: ${(props: ThemeProps) => props.theme?.colors?.background || '#ffffff'};
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease;

  &:hover {
    transform: translateY(-4px);
  }
`;

const NFTImage = styled.img`
  width: 100%;
  height: 200px;
  object-fit: cover;
`;

const NFTInfo = styled.div`
  padding: 1rem;
`;

const NFTName = styled.h3`
  margin: 0;
  font-size: 1rem;
  color: ${(props: ThemeProps) => props.theme?.colors?.text?.primary || '#000000'};
`;

const NFTDescription = styled.p`
  margin: 0.5rem 0;
  font-size: 0.875rem;
  color: ${(props: ThemeProps) => props.theme?.colors?.text?.secondary || '#666666'};
`;

const TransferButton = styled.button`
  width: 100%;
  padding: 0.5rem;
  background: ${(props: ThemeProps) => props.theme?.colors?.primary || '#007bff'};
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    background: ${(props: ThemeProps) => props.theme?.colors?.disabled || '#cccccc'};
    cursor: not-allowed;
  }
`;

const TransferDialog = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: ${(props: ThemeProps) => props.theme?.colors?.background || '#ffffff'};
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  z-index: 1000;
`;

const DialogOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
`;

const DialogInput = styled.input`
  width: 100%;
  padding: 0.5rem;
  margin: 0.5rem 0;
  border: 1px solid ${(props: ThemeProps) => props.theme?.colors?.border || '#e0e0e0'};
  border-radius: 4px;
`;

const DialogButton = styled.button`
  padding: 0.5rem 1rem;
  margin: 0.5rem;
  background: ${(props: ThemeProps) => props.theme?.colors?.primary || '#007bff'};
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    opacity: 0.9;
  }
`;

interface NFTGalleryProps {
  contractAddress?: string;
}

export const NFTGallery: React.FC<NFTGalleryProps> = ({ contractAddress }) => {
  const { nfts, isLoading, error, refetch } = useNFTs();
  const [selectedNFT, setSelectedNFT] = useState<NFTItem | null>(null);
  const [recipient, setRecipient] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info' | 'pending'>('info');

  const { transferNFT, isTransferring, error: _transferError } = useNFTTransfer();

  const handleTransfer = async (): Promise<void> => {
    if (!selectedNFT) return;

    try {
      setToastType('pending');
      setToastMessage('Processing NFT transfer...');
      setShowToast(true);

      await transferNFT();

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

  if (error) {
    return <OmniCoinToast type="error" message={error} />;
  }

  return (
    <>
      <GalleryContainer>
        {nfts.map((nft: NFTItem) => (
          <NFTCard key={`${nft.contractAddress}-${nft.tokenId}`}>
            <NFTImage src={nft.metadata?.image} alt={nft.metadata?.name || 'NFT'} />
            <NFTInfo>
              <NFTName>{nft.metadata?.name || 'Unnamed NFT'}</NFTName>
              <NFTDescription>{nft.metadata?.description || 'No description available'}</NFTDescription>
              <OmniCoinTooltip content="Transfer this NFT">
                <TransferButton
                  onClick={() => setSelectedNFT(nft)}
                  disabled={isTransferring}
                >
                  Transfer
                </TransferButton>
              </OmniCoinTooltip>
            </NFTInfo>
          </NFTCard>
        ))}
      </GalleryContainer>

      {selectedNFT && (
        <>
          <DialogOverlay onClick={() => setSelectedNFT(null)} />
          <TransferDialog>
            <h3>Transfer {selectedNFT.metadata?.name || 'NFT'}</h3>
            <DialogInput
              type="text"
              placeholder="Recipient Address"
              value={recipient}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecipient(e.target.value)}
            />
            <div>
              <DialogButton onClick={handleTransfer} disabled={isTransferring}>
                {isTransferring ? 'Transferring...' : 'Transfer'}
              </DialogButton>
              <DialogButton onClick={() => setSelectedNFT(null)}>
                Cancel
              </DialogButton>
            </div>
          </TransferDialog>
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
