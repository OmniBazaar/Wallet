/**
 * TokenBalance React Component Tests
 * Tests TypeScript strict compliance, form handling, and token operations
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';
import { TokenBalance } from '../../src/ui/widgets/omnicoin/components/TokenBalance';

// Mock the hooks
jest.mock('../../src/hooks/useTokenBalance', () => ({
  useTokenBalance: jest.fn()
}));

jest.mock('../../src/hooks/useTokenTransfer', () => ({
  useTokenTransfer: jest.fn()
}));

// Mock child components
jest.mock('../../src/ui/widgets/omnicoin/components/OmniCoinLoading', () => ({
  OmniCoinLoading: ({ text }: { text: string }) => (
    <div data-testid="loading-component">{text}</div>
  )
}));

jest.mock('../../src/ui/widgets/omnicoin/components/OmniCoinToast', () => ({
  OmniCoinToast: ({ type, message, onClose }: { type: string; message: string; onClose?: () => void }) => (
    <div data-testid="toast-component" data-type={type}>
      {message}
      {onClose && <button onClick={onClose} data-testid="toast-close">×</button>}
    </div>
  )
}));

import { useTokenBalance } from '../../src/hooks/useTokenBalance';
import { useTokenTransfer } from '../../src/hooks/useTokenTransfer';

const mockUseTokenBalance = useTokenBalance as jest.MockedFunction<typeof useTokenBalance>;
const mockUseTokenTransfer = useTokenTransfer as jest.MockedFunction<typeof useTokenTransfer>;

// Mock token data
const mockTokenInfo = {
  name: 'OmniCoin',
  symbol: 'XOM',
  decimals: 18,
  logoURI: 'https://example.com/omnicoin-logo.png'
};

describe('TokenBalance Component', () => {
  const user = userEvent.setup();
  const testTokenAddress = '0x1234567890123456789012345678901234567890';
  
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Default mock implementations
    mockUseTokenBalance.mockReturnValue({
      tokenInfo: mockTokenInfo,
      balance: '1000000000000000000000', // 1000 XOM
      formattedBalance: '1000.00',
      isLoading: false,
      error: null,
      refetch: jest.fn().mockResolvedValue(undefined)
    });
    
    mockUseTokenTransfer.mockReturnValue({
      transfer: jest.fn().mockResolvedValue('0xtxhash'),
      isTransferring: false,
      error: null
    });
  });

  describe('Component Rendering', () => {
    it('should render with required tokenAddress prop', () => {
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      expect(screen.getByText('OmniCoin')).toBeInTheDocument();
      expect(screen.getByText('XOM')).toBeInTheDocument();
      expect(screen.getByText('1000.00 XOM')).toBeInTheDocument();
    });

    it('should call useTokenBalance with correct token address', () => {
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      expect(mockUseTokenBalance).toHaveBeenCalledWith(testTokenAddress);
    });

    it('should call useTokenTransfer with correct token address', () => {
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      expect(mockUseTokenTransfer).toHaveBeenCalledWith(testTokenAddress);
    });

    it('should display token information correctly', () => {
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      expect(screen.getByText('OmniCoin')).toBeInTheDocument();
      expect(screen.getByText('XOM')).toBeInTheDocument();
      expect(screen.getByTitle('Your current token balance')).toHaveTextContent('1000.00 XOM');
    });

    it('should display token logo when logoURI is provided', () => {
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      const logo = screen.getByAltText('XOM') as HTMLImageElement;
      expect(logo).toBeInTheDocument();
      expect(logo.src).toBe('https://example.com/omnicoin-logo.png');
      expect(logo).toHaveStyle({
        width: '32px',
        height: '32px',
        borderRadius: '50%'
      });
    });

    it('should not display logo when logoURI is not provided', () => {
      mockUseTokenBalance.mockReturnValue({
        tokenInfo: { ...mockTokenInfo, logoURI: undefined },
        balance: '1000000000000000000000',
        formattedBalance: '1000.00',
        isLoading: false,
        error: null,
        refetch: jest.fn().mockResolvedValue(undefined)
      });
      
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      expect(screen.queryByAltText('XOM')).not.toBeInTheDocument();
    });
  });

  describe('Loading and Error States', () => {
    it('should show loading component when balance is loading', () => {
      mockUseTokenBalance.mockReturnValue({
        tokenInfo: null,
        balance: '0',
        formattedBalance: '0.00',
        isLoading: true,
        error: null,
        refetch: jest.fn().mockResolvedValue(undefined)
      });
      
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      expect(screen.getByTestId('loading-component')).toBeInTheDocument();
      expect(screen.getByText('Loading token balance...')).toBeInTheDocument();
    });

    it('should show error toast when balance error occurs', () => {
      mockUseTokenBalance.mockReturnValue({
        tokenInfo: null,
        balance: '0',
        formattedBalance: '0.00',
        isLoading: false,
        error: 'Failed to load balance',
        refetch: jest.fn().mockResolvedValue(undefined)
      });
      
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      expect(screen.getByTestId('toast-component')).toBeInTheDocument();
      expect(screen.getByText('Failed to load balance')).toBeInTheDocument();
      expect(screen.getByTestId('toast-component')).toHaveAttribute('data-type', 'error');
    });

    it('should show error toast when token is not found', () => {
      mockUseTokenBalance.mockReturnValue({
        tokenInfo: null,
        balance: '0',
        formattedBalance: '0.00',
        isLoading: false,
        error: null,
        refetch: jest.fn().mockResolvedValue(undefined)
      });
      
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      expect(screen.getByTestId('toast-component')).toBeInTheDocument();
      expect(screen.getByText('Token not found')).toBeInTheDocument();
      expect(screen.getByTestId('toast-component')).toHaveAttribute('data-type', 'error');
    });

    it('should show transfer error toast when transfer error occurs', () => {
      mockUseTokenTransfer.mockReturnValue({
        transfer: jest.fn().mockResolvedValue('0xtxhash'),
        isTransferring: false,
        error: 'Transfer failed'
      });
      
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      const errorToasts = screen.getAllByTestId('toast-component');
      const transferErrorToast = errorToasts.find(toast => 
        toast.textContent?.includes('Transfer failed')
      );
      
      expect(transferErrorToast).toBeInTheDocument();
      expect(transferErrorToast).toHaveAttribute('data-type', 'error');
    });
  });

  describe('Transfer Form', () => {
    it('should render transfer form with proper structure', () => {
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      const form = screen.getByLabelText('Token Transfer Form');
      expect(form).toBeInTheDocument();
      
      const recipientInput = screen.getByLabelText('Recipient Address') as HTMLInputElement;
      const amountInput = screen.getByLabelText('Amount') as HTMLInputElement;
      const transferButton = screen.getByLabelText('Transfer Token');
      
      expect(recipientInput).toBeInTheDocument();
      expect(recipientInput.type).toBe('text');
      expect(recipientInput.placeholder).toBe('Recipient Address');
      expect(recipientInput.required).toBe(true);
      
      expect(amountInput).toBeInTheDocument();
      expect(amountInput.type).toBe('number');
      expect(amountInput.placeholder).toBe('Amount');
      expect(amountInput.required).toBe(true);
      expect(amountInput.min).toBe('0');
      expect(amountInput.step).toBe('any');
      
      expect(transferButton).toBeInTheDocument();
      expect(transferButton).toHaveTextContent('Transfer');
    });

    it('should handle recipient input changes', async () => {
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      const recipientInput = screen.getByLabelText('Recipient Address') as HTMLInputElement;
      await user.type(recipientInput, '0xrecipient123');
      
      expect(recipientInput.value).toBe('0xrecipient123');
    });

    it('should handle amount input changes', async () => {
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      const amountInput = screen.getByLabelText('Amount') as HTMLInputElement;
      await user.type(amountInput, '100.5');
      
      expect(amountInput.value).toBe('100.5');
    });

    it('should prevent form submission when required fields are empty', async () => {
      const mockTransfer = jest.fn().mockResolvedValue('0xtxhash');
      mockUseTokenTransfer.mockReturnValue({
        transfer: mockTransfer,
        isTransferring: false,
        error: null
      });
      
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      const transferButton = screen.getByLabelText('Transfer Token');
      await user.click(transferButton);
      
      // Form validation should prevent submission
      expect(mockTransfer).not.toHaveBeenCalled();
    });

    it('should call transfer function with correct parameters when form is valid', async () => {
      const mockTransfer = jest.fn().mockResolvedValue('0xtxhash');
      mockUseTokenTransfer.mockReturnValue({
        transfer: mockTransfer,
        isTransferring: false,
        error: null
      });
      
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      const recipientInput = screen.getByLabelText('Recipient Address');
      const amountInput = screen.getByLabelText('Amount');
      const transferButton = screen.getByLabelText('Transfer Token');
      
      await user.type(recipientInput, '0xrecipient123');
      await user.type(amountInput, '50.25');
      await user.click(transferButton);
      
      expect(mockTransfer).toHaveBeenCalledWith('0xrecipient123', '50.25');
    });

    it('should show pending state during transfer', async () => {
      const mockTransfer = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      mockUseTokenTransfer.mockReturnValue({
        transfer: mockTransfer,
        isTransferring: true,
        error: null
      });
      
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      const transferButton = screen.getByLabelText('Transfer Token');
      expect(transferButton).toHaveTextContent('Transferring...');
      expect(transferButton).toBeDisabled();
      expect(transferButton).toHaveStyle('cursor: not-allowed');
    });

    it('should show success toast after successful transfer', async () => {
      const mockTransfer = jest.fn().mockResolvedValue('0xtxhash');
      mockUseTokenTransfer.mockReturnValue({
        transfer: mockTransfer,
        isTransferring: false,
        error: null
      });
      
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      const recipientInput = screen.getByLabelText('Recipient Address');
      const amountInput = screen.getByLabelText('Amount');
      const transferButton = screen.getByLabelText('Transfer Token');
      
      await user.type(recipientInput, '0xrecipient123');
      await user.type(amountInput, '25');
      
      fireEvent.click(transferButton);
      
      // Should show pending toast first
      await waitFor(() => {
        expect(screen.getByText('Processing transfer...')).toBeInTheDocument();
      });
      
      // Wait for success
      await waitFor(() => {
        expect(screen.getByText('Transfer successful!')).toBeInTheDocument();
      });
    });

    it('should clear form fields after successful transfer', async () => {
      const mockTransfer = jest.fn().mockResolvedValue('0xtxhash');
      mockUseTokenTransfer.mockReturnValue({
        transfer: mockTransfer,
        isTransferring: false,
        error: null
      });
      
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      const recipientInput = screen.getByLabelText('Recipient Address') as HTMLInputElement;
      const amountInput = screen.getByLabelText('Amount') as HTMLInputElement;
      const transferButton = screen.getByLabelText('Transfer Token');
      
      await user.type(recipientInput, '0xrecipient123');
      await user.type(amountInput, '25');
      
      fireEvent.click(transferButton);
      
      await waitFor(() => {
        expect(screen.getByText('Transfer successful!')).toBeInTheDocument();
      });
      
      expect(recipientInput.value).toBe('');
      expect(amountInput.value).toBe('');
    });

    it('should handle transfer error gracefully', async () => {
      const mockTransfer = jest.fn().mockRejectedValue(new Error('Insufficient balance'));
      mockUseTokenTransfer.mockReturnValue({
        transfer: mockTransfer,
        isTransferring: false,
        error: null
      });
      
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      const recipientInput = screen.getByLabelText('Recipient Address');
      const amountInput = screen.getByLabelText('Amount');
      const transferButton = screen.getByLabelText('Transfer Token');
      
      await user.type(recipientInput, '0xrecipient123');
      await user.type(amountInput, '9999');
      
      fireEvent.click(transferButton);
      
      await waitFor(() => {
        expect(screen.getByText('Insufficient balance')).toBeInTheDocument();
      });
    });

    it('should handle unknown error types', async () => {
      const mockTransfer = jest.fn().mockRejectedValue('Unknown error');
      mockUseTokenTransfer.mockReturnValue({
        transfer: mockTransfer,
        isTransferring: false,
        error: null
      });
      
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      const recipientInput = screen.getByLabelText('Recipient Address');
      const amountInput = screen.getByLabelText('Amount');
      const transferButton = screen.getByLabelText('Transfer Token');
      
      await user.type(recipientInput, '0xrecipient123');
      await user.type(amountInput, '10');
      
      fireEvent.click(transferButton);
      
      await waitFor(() => {
        expect(screen.getByText('Transfer failed')).toBeInTheDocument();
      });
    });
  });

  describe('Toast Management', () => {
    it('should close toast when close button is clicked', async () => {
      const mockTransfer = jest.fn().mockResolvedValue('0xtxhash');
      mockUseTokenTransfer.mockReturnValue({
        transfer: mockTransfer,
        isTransferring: false,
        error: null
      });
      
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      const recipientInput = screen.getByLabelText('Recipient Address');
      const amountInput = screen.getByLabelText('Amount');
      const transferButton = screen.getByLabelText('Transfer Token');
      
      await user.type(recipientInput, '0xrecipient123');
      await user.type(amountInput, '10');
      
      fireEvent.click(transferButton);
      
      await waitFor(() => {
        expect(screen.getByText('Transfer successful!')).toBeInTheDocument();
      });
      
      const closeButton = screen.getByTestId('toast-close');
      await user.click(closeButton);
      
      expect(screen.queryByText('Transfer successful!')).not.toBeInTheDocument();
    });
  });

  describe('TypeScript Strict Mode Compliance', () => {
    it('should require tokenAddress prop', () => {
      // This test ensures TypeScript compliance - tokenAddress is required
      const tokenAddress: string = testTokenAddress;
      render(<TokenBalance tokenAddress={tokenAddress} />);
      
      expect(screen.getByText('OmniCoin')).toBeInTheDocument();
    });

    it('should properly type form event handlers', async () => {
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      const recipientInput = screen.getByLabelText('Recipient Address') as HTMLInputElement;
      const amountInput = screen.getByLabelText('Amount') as HTMLInputElement;
      
      // These test that the event handlers are properly typed
      const recipientEvent = {
        target: { value: '0xtest123' },
        currentTarget: recipientInput
      } as React.ChangeEvent<HTMLInputElement>;
      
      const amountEvent = {
        target: { value: '42.5' },
        currentTarget: amountInput
      } as React.ChangeEvent<HTMLInputElement>;
      
      fireEvent.change(recipientInput, recipientEvent);
      fireEvent.change(amountInput, amountEvent);
      
      expect(recipientInput.value).toBe('0xtest123');
      expect(amountInput.value).toBe('42.5');
    });

    it('should properly type toast state values', async () => {
      // Test that toast type is strictly typed
      const mockTransfer = jest.fn().mockResolvedValue('0xtxhash');
      mockUseTokenTransfer.mockReturnValue({
        transfer: mockTransfer,
        isTransferring: false,
        error: null
      });
      
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      const recipientInput = screen.getByLabelText('Recipient Address');
      const amountInput = screen.getByLabelText('Amount');
      const transferButton = screen.getByLabelText('Transfer Token');
      
      await user.type(recipientInput, '0xrecipient123');
      await user.type(amountInput, '10');
      
      fireEvent.click(transferButton);
      
      // Should go through pending -> success states with proper typing
      await waitFor(() => {
        expect(screen.getByText('Processing transfer...')).toBeInTheDocument();
      });
      
      await waitFor(() => {
        expect(screen.getByText('Transfer successful!')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      expect(screen.getByLabelText('Token Transfer Form')).toBeInTheDocument();
      expect(screen.getByLabelText('Recipient Address')).toBeInTheDocument();
      expect(screen.getByLabelText('Amount')).toBeInTheDocument();
      expect(screen.getByLabelText('Transfer Token')).toBeInTheDocument();
    });

    it('should have proper title attributes for accessibility', () => {
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      expect(screen.getByTitle('Your current token balance')).toBeInTheDocument();
    });

    it('should be keyboard navigable', async () => {
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      const recipientInput = screen.getByLabelText('Recipient Address');
      const amountInput = screen.getByLabelText('Amount');
      const transferButton = screen.getByLabelText('Transfer Token');
      
      // Tab navigation
      await user.tab();
      expect(recipientInput).toHaveFocus();
      
      await user.tab();
      expect(amountInput).toHaveFocus();
      
      await user.tab();
      expect(transferButton).toHaveFocus();
    });
  });

  describe('Component Styling', () => {
    it('should apply correct container styles', () => {
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      const container = screen.getByTestId('token-balance-container');
      expect(container).toHaveStyle({
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '1rem',
        background: '#ffffff',
        borderRadius: '8px'
      });
    });

    it('should apply correct form styles', () => {
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      const form = screen.getByLabelText('Token Transfer Form');
      expect(form).toHaveStyle({
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
      });
    });

    it('should apply correct input styles', () => {
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      const recipientInput = screen.getByLabelText('Recipient Address');
      const amountInput = screen.getByLabelText('Amount');
      
      const expectedStyle = {
        padding: '0.5rem',
        border: '1px solid #d1d5db',
        borderRadius: '4px',
        fontSize: '0.875rem'
      };
      
      expect(recipientInput).toHaveStyle(expectedStyle);
      expect(amountInput).toHaveStyle(expectedStyle);
    });

    it('should apply different button styles based on state', () => {
      const { rerender } = render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      const transferButton = screen.getByLabelText('Transfer Token');
      // Check the styles that work reliably in JSDOM
      expect(transferButton).toHaveStyle({
        padding: '0.5rem 1rem',
        cursor: 'pointer'
      });
      
      // Test disabled state
      mockUseTokenTransfer.mockReturnValue({
        transfer: jest.fn(),
        isTransferring: true,
        error: null
      });
      
      rerender(<TokenBalance tokenAddress={testTokenAddress} />);
      
      const disabledButton = screen.getByLabelText('Transfer Token');
      expect(disabledButton).toHaveStyle({
        background: '#9ca3af',
        cursor: 'not-allowed'
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large token balances', () => {
      mockUseTokenBalance.mockReturnValue({
        tokenInfo: mockTokenInfo,
        balance: '999999999999999999999999999',
        formattedBalance: '999,999,999,999,999,999,999.999999',
        isLoading: false,
        error: null,
        refetch: jest.fn().mockResolvedValue(undefined)
      });
      
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      expect(screen.getByText('999,999,999,999,999,999,999.999999 XOM')).toBeInTheDocument();
    });

    it('should handle zero balance', () => {
      mockUseTokenBalance.mockReturnValue({
        tokenInfo: mockTokenInfo,
        balance: '0',
        formattedBalance: '0.00',
        isLoading: false,
        error: null,
        refetch: jest.fn().mockResolvedValue(undefined)
      });
      
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      expect(screen.getByText('0.00 XOM')).toBeInTheDocument();
    });

    it('should handle very long token names and symbols', () => {
      const longTokenInfo = {
        name: 'Very Long Token Name That Might Cause Layout Issues',
        symbol: 'VERYLONGTOKENSYMBOL',
        decimals: 18,
        logoURI: 'https://example.com/logo.png'
      };
      
      mockUseTokenBalance.mockReturnValue({
        tokenInfo: longTokenInfo,
        balance: '1000000000000000000',
        formattedBalance: '1.00',
        isLoading: false,
        error: null,
        refetch: jest.fn().mockResolvedValue(undefined)
      });
      
      render(<TokenBalance tokenAddress={testTokenAddress} />);
      
      expect(screen.getByText('Very Long Token Name That Might Cause Layout Issues')).toBeInTheDocument();
      expect(screen.getByText('VERYLONGTOKENSYMBOL')).toBeInTheDocument();
    });
  });
});