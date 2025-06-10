import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import OmniCoinIntegratedWallet from './OmniCoinIntegratedWallet';

// Mock hooks
jest.mock('../hooks/useOmniCoin', () => ({
    useOmniCoin: () => ({
        account: '0x123',
        balance: '100.0',
        network: 'ethereum',
        switchNetwork: jest.fn(),
        isLoading: false,
    })
}));

jest.mock('../hooks/useOmniCoinToken', () => ({
    useOmniCoinToken: () => ({
        tokens: []
    })
}));

describe('OmniCoinIntegratedWallet', () => {
    it('renders with all required data-testid attributes', () => {
        render(<OmniCoinIntegratedWallet />);

        // Check for main container
        expect(screen.getByTestId('integrated-wallet')).toBeInTheDocument();

        // Check for network selector
        expect(screen.getByTestId('network-selector')).toBeInTheDocument();

        // Check for wallet address
        expect(screen.getByTestId('wallet-address')).toBeInTheDocument();

        // Check for token balance
        expect(screen.getByTestId('token-balance')).toBeInTheDocument();

        // Check for tabs
        expect(screen.getByTestId('tokens-tab')).toBeInTheDocument();
        expect(screen.getByTestId('history-tab')).toBeInTheDocument();
        expect(screen.getByTestId('settings-tab')).toBeInTheDocument();
    });

    it('shows loading state with correct data-testid', () => {
        jest.spyOn(require('../hooks/useOmniCoin'), 'useOmniCoin').mockReturnValue({
            account: '0x123',
            balance: '100.0',
            network: 'ethereum',
            switchNetwork: jest.fn(),
            isLoading: true,
        });

        render(<OmniCoinIntegratedWallet />);
        expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });
}); 