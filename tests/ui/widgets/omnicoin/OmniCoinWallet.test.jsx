import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import OmniCoinStandaloneWallet from '../../../../src/ui/widgets/omnicoin/components/OmniCoinStandaloneWallet';
import OmniCoinIntegratedWallet from '../../../../src/ui/widgets/omnicoin/components/OmniCoinIntegratedWallet';
import OmniCoinErrorBoundary from '../../../../src/ui/widgets/omnicoin/components/OmniCoinErrorBoundary';
import OmniCoinLoading from '../../../../src/ui/widgets/omnicoin/components/OmniCoinLoading';

// Mock hooks
jest.mock('../../../../src/ui/widgets/omnicoin/hooks/useOmniCoin', () => ({
    useOmniCoin: () => ({
        account: '0x123',
        balance: '100.0',
        network: 'ethereum',
        switchNetwork: jest.fn(),
        isLoading: false,
    })
}));
jest.mock('../../../../src/ui/widgets/omnicoin/hooks/useOmniCoinToken', () => ({
    useOmniCoinToken: () => ({
        tokens: []
    })
}));


describe('OmniCoinStandaloneWallet', () => {
    it('renders without crashing', () => {
        render(<OmniCoinStandaloneWallet />);
        expect(screen.getByText(/OmniCoin Wallet/i)).toBeInTheDocument();
    });

    it('shows loading state', () => {
        jest.spyOn(require('../hooks/useOmniCoin'), 'useOmniCoin').mockReturnValue({
            account: '0x123',
            balance: '100.0',
            network: 'ethereum',
            switchNetwork: jest.fn(),
            isLoading: true,
        });
        render(<OmniCoinStandaloneWallet />);
        expect(screen.getByText(/Loading wallet data/i)).toBeInTheDocument();
    });
});

describe('OmniCoinIntegratedWallet', () => {
    it('renders without crashing', () => {
        render(<OmniCoinIntegratedWallet />);
        expect(screen.getByText(/Wallet/i)).toBeInTheDocument();
    });
});

describe('OmniCoinErrorBoundary', () => {
    it('catches errors and displays fallback UI', () => {
        const ProblemChild = () => { throw new Error('Test error'); };
        render(
            <OmniCoinErrorBoundary>
                <ProblemChild />
            </OmniCoinErrorBoundary>
        );
        expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
        expect(screen.getByText(/Test error/i)).toBeInTheDocument();
    });
});

describe('OmniCoinLoading', () => {
    it('renders loading spinner and text', () => {
        render(<OmniCoinLoading text="Loading test..." />);
        expect(screen.getByText(/Loading test/i)).toBeInTheDocument();
    });
}); 