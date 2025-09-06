/* @jsxImportSource react */
import React, { useState } from 'react';
import styled from 'styled-components';
import { useWallet } from '../../../contexts/WalletContext';
import { OmniCoinLoading } from './OmniCoinLoading';
import { OmniCoinToast } from './OmniCoinToast';

/**
 * Styled container for the wallet connection interface
 */
const ConnectContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: ${props => props.theme.colors.background};
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

/**
 * Grid layout for wallet provider buttons
 */
const ProviderList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
`;

/**
 * Styled button for wallet provider selection
 */
const ProviderButton = styled.button<{ isConnected?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: ${props => props.isConnected ? props.theme.colors.success : props.theme.colors.primary};
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    background: ${props => props.theme.colors.disabled};
    cursor: not-allowed;
  }
`;

/**
 * Styled icon for wallet providers
 */
const ProviderIcon = styled.img`
  width: 24px;
  height: 24px;
`;

/**
 * Styled text for status information
 */
const StatusText = styled.p`
  margin: 0;
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.primary};
`;

/**
 * Styled code block for displaying wallet addresses
 */
const AddressText = styled.code`
  background: ${props => props.theme.colors.backgroundAlt};
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
`;

/**
 * Wallet connection component for OmniBazaar
 * Allows users to connect/disconnect various wallet providers
 * 
 * @returns JSX element for wallet connection interface
 */
const WalletConnect: React.FC = () => {
    const { state, connect, disconnect } = useWallet();
    const { address, chainId, isConnecting, error } = state;
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error' | 'info' | 'pending'>('info');

    /**
     * Handles wallet connection for a specific provider
     * @param providerId - ID of the wallet provider to connect
     */
    const handleConnect = async (): Promise<void> => {
        try {
            setToastType('pending');
            setToastMessage('Connecting to wallet...');
            setShowToast(true);

            await connect();

            setToastType('success');
            setToastMessage('Wallet connected successfully!');
        } catch (err) {
            setToastType('error');
            setToastMessage(err instanceof Error ? err.message : 'Failed to connect wallet');
        }
    };

    /**
     * Handles wallet disconnection
     */
    const handleDisconnect = (): void => {
        disconnect();
        setToastType('info');
        setToastMessage('Wallet disconnected');
        setShowToast(true);
    };

    if (isConnecting) {
        return <OmniCoinLoading text="Connecting to wallet..." />;
    }

    return (
        <ConnectContainer>
            {showToast && (
                <OmniCoinToast
                    message={toastMessage}
                    type={toastType}
                    onClose={() => setShowToast(false)}
                />
            )}

            {address ? (
                <>
                    <StatusText>Connected to:</StatusText>
                    <AddressText>{address}</AddressText>
                    <StatusText>Network: {chainId}</StatusText>
                    <ProviderButton onClick={handleDisconnect} aria-label="Disconnect Wallet">
                        Disconnect Wallet
                    </ProviderButton>
                </>
            ) : (
                <>
                    <StatusText>Connect your wallet:</StatusText>
                    <ProviderList>
                        <ProviderButton
                          onClick={() => handleConnect()}
                          aria-label="Connect Wallet"
                        >
                          Connect Wallet
                        </ProviderButton>
                    </ProviderList>
                </>
            )}

            {error && (
                <OmniCoinToast type="error" message={error} />
            )}
        </ConnectContainer>
    );
};

export default WalletConnect;
