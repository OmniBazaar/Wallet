import { useState, CSSProperties, FC } from 'react';
import { flushSync } from 'react-dom';
import { OmniCoinLoading } from './OmniCoinLoading';
import { OmniCoinToast } from './OmniCoinToast';

/**
 * State interface for wallet connection status
 */
export interface WalletState {
  /** Currently connected wallet address */
  address?: string;
  /** Current blockchain chain ID */
  chainId?: number;
  /** Whether wallet connection is in progress */
  isConnecting: boolean;
  /** Error message if connection failed */
  error?: string;
}

/**
 * Wallet hook interface for dependency injection during testing
 */
export interface WalletHook {
  /** Current wallet state */
  state: WalletState;
  /** Function to connect to wallet */
  connect: () => Promise<void>;
  /** Function to disconnect wallet */
  disconnect: () => void;
}

/**
 * Default wallet hook implementation for fallback scenarios
 * @returns Default wallet hook with unimplemented methods
 */
const defaultUseWallet = (): WalletHook => ({
  state: {
    isConnecting: false
  } as WalletState,
  connect: () => {
    throw new Error('Wallet connection not implemented');
  },
  disconnect: (): void => {
    // Default implementation - no operation
  }
});

// Allow hook injection for testing
let walletHookProvider: () => WalletHook = defaultUseWallet;

/**
 * Sets the wallet hook provider for dependency injection
 * @param provider - Function that returns a wallet hook implementation
 * @returns void
 */
export const setWalletHookProvider = (provider: () => WalletHook): void => {
  walletHookProvider = provider;
};

/**
 * Resets the wallet hook provider to the default implementation
 * @returns void
 */
export const resetWalletHookProvider = (): void => {
  walletHookProvider = defaultUseWallet;
};

const connectContainerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  padding: '1rem',
  background: '#ffffff',
  borderRadius: '8px',
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
};

const providerListStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '1rem'
};

const getProviderButtonStyle = (isConnected = false): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1rem',
  background: isConnected ? '#10b981' : '#3b82f6',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  transition: 'all 0.2s ease'
});

const statusTextStyle: CSSProperties = {
  margin: '0',
  fontSize: '0.875rem',
  color: '#1f2937'
};

const addressTextStyle: CSSProperties = {
  background: '#f3f4f6',
  padding: '0.25rem 0.5rem',
  borderRadius: '4px',
  fontSize: '0.875rem',
  fontFamily: 'monospace'
};

/**
 * Props interface for WalletConnect component
 */
export interface WalletConnectProps {
  /** No props currently needed */
}

/**
 * Wallet connection component for OmniBazaar
 * Allows users to connect/disconnect various wallet providers
 * @returns JSX element for wallet connection interface
 */
const WalletConnect: FC<WalletConnectProps> = () => {
    const { state, connect, disconnect } = walletHookProvider();
    const { address, chainId, isConnecting, error } = state;
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error' | 'info' | 'pending'>('info');

    /**
     * Handles wallet connection
     */
    const handleConnect = async (): Promise<void> => {
        try {
            // Batch initial state updates with flushSync for test compatibility
            flushSync(() => {
                setToastType('pending');
                setToastMessage('Connecting to wallet...');
                setShowToast(true);
            });

            await connect();

            // Batch success state updates with flushSync for test compatibility
            flushSync(() => {
                setToastType('success');
                setToastMessage('Wallet connected successfully!');
            });
        } catch (err) {
            // Batch error state updates with flushSync for test compatibility
            flushSync(() => {
                setToastType('error');
                setToastMessage(err instanceof Error ? err.message : 'Failed to connect wallet');
            });
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
        <div style={connectContainerStyle}>
            {showToast && (
                <OmniCoinToast
                    message={toastMessage}
                    type={toastType}
                    onClose={() => setShowToast(false)}
                />
            )}

            {typeof address === 'string' && address.length > 0 ? (
                <>
                    <p style={statusTextStyle}>Connected to:</p>
                    <code style={addressTextStyle}>{address}</code>
                    <p style={statusTextStyle}>Network: {chainId}</p>
                    <button type="button" 
                        onClick={handleDisconnect} 
                        aria-label="Disconnect Wallet"
                        style={getProviderButtonStyle(true)}
                    >
                        Disconnect Wallet
                    </button>
                </>
            ) : (
                <>
                    <p style={statusTextStyle}>Connect your wallet:</p>
                    <div style={providerListStyle}>
                        <button
                          type="button"
                          onClick={() => void handleConnect()}
                          aria-label="Connect Wallet"
                          style={getProviderButtonStyle(false)}
                        >
                          Connect Wallet
                        </button>
                    </div>
                </>
            )}

            {typeof error === 'string' && error.length > 0 && (
                <OmniCoinToast type="error" message={error} />
            )}
        </div>
    );
};

export default WalletConnect;