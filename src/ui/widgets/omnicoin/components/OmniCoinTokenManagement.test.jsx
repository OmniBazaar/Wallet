import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OmniCoinTokenManagement } from './OmniCoinTokenManagement';

// Mock hooks
jest.mock('../hooks/useOmniCoinToken', () => ({
    useOmniCoinToken: () => ({
        tokens: [
            {
                address: '0x123',
                symbol: 'OMN',
                balance: '100.0',
                decimals: 18
            }
        ],
        approveToken: jest.fn(),
        transferToken: jest.fn()
    })
}));

describe('OmniCoinTokenManagement', () => {
    it('renders with all required data-testid attributes', () => {
        render(<OmniCoinTokenManagement />);

        // Check for token list
        expect(screen.getByTestId('token-list')).toBeInTheDocument();

        // Check for token items
        expect(screen.getByTestId('token-item')).toBeInTheDocument();

        // Check for token balance
        expect(screen.getByTestId('token-balance')).toBeInTheDocument();

        // Check for approve button
        expect(screen.getByTestId('approve-token')).toBeInTheDocument();

        // Check for send button
        expect(screen.getByTestId('send-token')).toBeInTheDocument();
    });

    it('displays token information correctly', () => {
        render(<OmniCoinTokenManagement />);

        // Check token symbol
        expect(screen.getByText('OMN')).toBeInTheDocument();

        // Check token balance
        expect(screen.getByText('100.0')).toBeInTheDocument();
    });

    it('handles token approval', () => {
        const { useOmniCoinToken } = require('../hooks/useOmniCoinToken');
        const mockApproveToken = jest.fn();
        useOmniCoinToken.mockReturnValue({
            tokens: [
                {
                    address: '0x123',
                    symbol: 'OMN',
                    balance: '100.0',
                    decimals: 18
                }
            ],
            approveToken: mockApproveToken,
            transferToken: jest.fn()
        });

        render(<OmniCoinTokenManagement />);

        // Click approve button
        screen.getByTestId('approve-token').click();

        // Verify approveToken was called
        expect(mockApproveToken).toHaveBeenCalled();
    });
}); 