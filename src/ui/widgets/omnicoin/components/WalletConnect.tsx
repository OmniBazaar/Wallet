import React, { useState } from 'react';
import styled from 'styled-components';
import { useWalletContext } from '../../../../../contexts/WalletContext';
import { OmniCoinLoading } from './OmniCoinLoading';
import { OmniCoinToast } from './OmniCoinToast';

const ConnectContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: ${props => props.theme.colors.background};
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const ProviderList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
`;

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

const ProviderIcon = styled.img`
  width: 24px;
  height: 24px;
`;

const StatusText = styled.p`
  margin: 0;
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.primary};
`;

const AddressText = styled.code`
  background: ${props => props.theme.colors.backgroundAlt};
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
`;

export const WalletConnect: React.FC = () => {
    const { address, chainId, isConnecting, error, connect, disconnect, getAvailableWallets } = useWalletContext();
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error' | 'info' | 'pending'>('info');

    const handleConnect = async (providerId: string): Promise<void> => {
        try {
            setToastType('pending');
            setToastMessage('Connecting to wallet...');
            setShowToast(true);

            await connect(providerId);

            setToastType('success');
            setToastMessage('Wallet connected successfully!');
        } catch (err) {
            setToastType('error');
            setToastMessage(err instanceof Error ? err.message : 'Failed to connect wallet');
        }
    };

    const handleDisconnect = (): void => {
        disconnect();
        setToastType('info');
        setToastMessage('Wallet disconnected');
        setShowToast(true);
    };

    const availableWallets = getAvailableWallets();

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
                        {availableWallets.map(provider => (
                            <ProviderButton
                                key={provider.id}
                                onClick={() => handleConnect(provider.id)}
                                disabled={!provider.isInstalled()}
                                aria-label={`Connect with ${provider.name}`}
                            >
                                <ProviderIcon src={provider.icon} alt={provider.name} />
                                {provider.name}
                            </ProviderButton>
                        ))}
                    </ProviderList>
                </>
            )}

            {error && (
                <OmniCoinToast type="error" message={error} />
            )}
        </ConnectContainer>
    );
}; 