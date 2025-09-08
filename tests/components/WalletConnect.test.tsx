/**
 * WalletConnect React Component Tests
 * Tests TypeScript strict compliance, wallet connection states, and user interactions
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';
import WalletConnect, { 
  setWalletHookProvider, 
  resetWalletHookProvider,
  WalletState,
  WalletHook 
} from '../../src/ui/widgets/omnicoin/components/WalletConnect';

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

// Create mock wallet hook
const createMockWalletHook = (state: Partial<WalletState> = {}): WalletHook => ({
  state: {
    isConnecting: false,
    ...state
  },
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn()
});

describe('WalletConnect Component', () => {
  let mockWalletHook: WalletHook;

  beforeEach(() => {
    mockWalletHook = createMockWalletHook();
    setWalletHookProvider(() => mockWalletHook);
  });

  afterEach(() => {
    resetWalletHookProvider();
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render connect state by default', () => {
      render(<WalletConnect />);
      
      expect(screen.getByText('Connect your wallet:')).toBeInTheDocument();
      expect(screen.getByLabelText('Connect Wallet')).toBeInTheDocument();
    });

    it('should apply correct container styles', () => {
      const { container } = render(<WalletConnect />);
      const containerDiv = container.firstChild as HTMLElement;
      
      expect(containerDiv).toHaveStyle({
        display: 'flex',
        flexDirection: 'column'
      });
    });

    it('should render connect button with correct styles', () => {
      render(<WalletConnect />);
      const connectButton = screen.getByLabelText('Connect Wallet');
      
      expect(connectButton).toHaveStyle({
        background: 'rgb(59, 130, 246)',
        color: 'rgb(255, 255, 255)'
      });
    });
  });

  describe('Connection Loading State', () => {
    it('should show loading component when connecting', () => {
      mockWalletHook.state.isConnecting = true;
      setWalletHookProvider(() => mockWalletHook);
      
      render(<WalletConnect />);
      
      expect(screen.getByTestId('loading-component')).toBeInTheDocument();
      expect(screen.getByText('Connecting to wallet...')).toBeInTheDocument();
    });

    it('should not render main interface when connecting', () => {
      mockWalletHook.state.isConnecting = true;
      setWalletHookProvider(() => mockWalletHook);
      
      render(<WalletConnect />);
      
      expect(screen.queryByText('Connect your wallet:')).not.toBeInTheDocument();
    });
  });

  describe('Connected State', () => {
    it('should render connected state when wallet is connected', () => {
      mockWalletHook.state.address = '0x1234567890abcdef1234567890abcdef12345678';
      mockWalletHook.state.chainId = 1;
      setWalletHookProvider(() => mockWalletHook);
      
      render(<WalletConnect />);
      
      expect(screen.getByText('Connected to:')).toBeInTheDocument();
      expect(screen.getByText('0x1234567890abcdef1234567890abcdef12345678')).toBeInTheDocument();
      expect(screen.getByText('Network: 1')).toBeInTheDocument();
    });

    it('should render address in monospace code element', () => {
      mockWalletHook.state.address = '0x1234567890abcdef1234567890abcdef12345678';
      setWalletHookProvider(() => mockWalletHook);
      
      render(<WalletConnect />);
      
      const addressElement = screen.getByText('0x1234567890abcdef1234567890abcdef12345678');
      expect(addressElement.tagName).toBe('CODE');
    });

    it('should render disconnect button with connected styles', () => {
      mockWalletHook.state.address = '0x1234567890abcdef1234567890abcdef12345678';
      setWalletHookProvider(() => mockWalletHook);
      
      render(<WalletConnect />);
      
      const disconnectButton = screen.getByLabelText('Disconnect Wallet');
      expect(disconnectButton).toHaveStyle({ background: '#10b981' });
    });

    it('should handle missing chainId gracefully', () => {
      mockWalletHook.state.address = '0x1234567890abcdef1234567890abcdef12345678';
      setWalletHookProvider(() => mockWalletHook);
      
      render(<WalletConnect />);
      
      expect(screen.getByText('Network:')).toBeInTheDocument();
    });
  });

  describe('Connection Flow', () => {
    it('should call connect function when connect button is clicked', async () => {
      const user = userEvent.setup();
      render(<WalletConnect />);
      
      const connectButton = screen.getByLabelText('Connect Wallet');
      await user.click(connectButton);
      
      expect(mockWalletHook.connect).toHaveBeenCalled();
    });

    it('should show pending toast when connection starts', async () => {
      // Make connect function return a Promise that doesn't resolve immediately
      let resolveConnect: () => void;
      const connectPromise = new Promise<void>((resolve) => {
        resolveConnect = resolve;
      });
      mockWalletHook.connect = jest.fn().mockReturnValue(connectPromise);
      setWalletHookProvider(() => mockWalletHook);

      const user = userEvent.setup();
      render(<WalletConnect />);
      
      const connectButton = screen.getByLabelText('Connect Wallet');
      await user.click(connectButton);
      
      // Should show pending toast immediately
      expect(screen.getByTestId('toast-component')).toBeInTheDocument();
      expect(screen.getByText('Connecting to wallet...')).toBeInTheDocument();
      
      // Resolve the promise to clean up
      resolveConnect!();
      await connectPromise;
    });

    it('should show success toast after successful connection', async () => {
      const user = userEvent.setup();
      render(<WalletConnect />);
      
      const connectButton = screen.getByLabelText('Connect Wallet');
      await user.click(connectButton);
      
      await waitFor(() => {
        expect(screen.getByText('Wallet connected successfully!')).toBeInTheDocument();
      });
    });

    it('should show error toast when connection fails', async () => {
      mockWalletHook.connect = jest.fn().mockRejectedValue(new Error('Connection failed'));
      setWalletHookProvider(() => mockWalletHook);
      
      const user = userEvent.setup();
      render(<WalletConnect />);
      
      const connectButton = screen.getByLabelText('Connect Wallet');
      await user.click(connectButton);
      
      await waitFor(() => {
        expect(screen.getByText('Connection failed')).toBeInTheDocument();
      });
    });

    it('should handle unknown error types gracefully', async () => {
      mockWalletHook.connect = jest.fn().mockRejectedValue('Unknown error');
      setWalletHookProvider(() => mockWalletHook);
      
      const user = userEvent.setup();
      render(<WalletConnect />);
      
      const connectButton = screen.getByLabelText('Connect Wallet');
      await user.click(connectButton);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to connect wallet')).toBeInTheDocument();
      });
    });
  });

  describe('Disconnection Flow', () => {
    it('should call disconnect function when disconnect button is clicked', async () => {
      mockWalletHook.state.address = '0x1234567890abcdef1234567890abcdef12345678';
      setWalletHookProvider(() => mockWalletHook);
      
      const user = userEvent.setup();
      render(<WalletConnect />);
      
      const disconnectButton = screen.getByLabelText('Disconnect Wallet');
      await user.click(disconnectButton);
      
      expect(mockWalletHook.disconnect).toHaveBeenCalled();
    });

    it('should show info toast after disconnection', async () => {
      mockWalletHook.state.address = '0x1234567890abcdef1234567890abcdef12345678';
      setWalletHookProvider(() => mockWalletHook);
      
      const user = userEvent.setup();
      render(<WalletConnect />);
      
      const disconnectButton = screen.getByLabelText('Disconnect Wallet');
      await user.click(disconnectButton);
      
      expect(screen.getByText('Wallet disconnected')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for buttons', () => {
      render(<WalletConnect />);
      
      const connectButton = screen.getByLabelText('Connect Wallet');
      expect(connectButton).toHaveAttribute('aria-label', 'Connect Wallet');
    });

    it('should have proper ARIA labels in connected state', () => {
      mockWalletHook.state.address = '0x1234567890abcdef1234567890abcdef12345678';
      setWalletHookProvider(() => mockWalletHook);
      
      render(<WalletConnect />);
      
      const disconnectButton = screen.getByLabelText('Disconnect Wallet');
      expect(disconnectButton).toHaveAttribute('aria-label', 'Disconnect Wallet');
    });
  });

  describe('TypeScript Strict Mode Compliance', () => {
    it('should handle optional props correctly', () => {
      expect(() => render(<WalletConnect />)).not.toThrow();
    });

    it('should properly type wallet state interface', () => {
      const testState: WalletState = {
        address: undefined,
        chainId: undefined,
        isConnecting: false,
        error: undefined
      };
      
      expect(testState.isConnecting).toBe(false);
    });
  });
});