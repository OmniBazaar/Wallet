/**
 * OmniCoinToast React Component Tests
 * Tests TypeScript strict compliance, useEffect return paths, and toast behavior
 */

import React from 'react';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';
import { OmniCoinToast } from '../../src/ui/widgets/omnicoin/components/OmniCoinToast';

describe('OmniCoinToast Component', () => {
  const user = userEvent.setup();
  
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Basic Rendering', () => {
    it('should render with required props', () => {
      render(<OmniCoinToast message="Test message" />);
      
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    it('should render with all props', () => {
      const onClose = jest.fn();
      
      render(
        <OmniCoinToast 
          message="Complete message test"
          type="success"
          duration={5000}
          onClose={onClose}
        />
      );
      
      expect(screen.getByText('Complete message test')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Close toast' })).toBeInTheDocument();
    });

    it('should render without onClose button when onClose is not provided', () => {
      render(<OmniCoinToast message="No close button" />);
      
      expect(screen.getByText('No close button')).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('Toast Types and Styling', () => {
    it('should render success toast with correct styling attributes', () => {
      render(<OmniCoinToast message="Success!" type="success" />);
      
      const toastElement = screen.getByText('Success!').closest('div');
      expect(toastElement).toBeInTheDocument();
      expect(toastElement).toHaveStyle('background-color: #10b981');
    });

    it('should render error toast with correct styling attributes', () => {
      render(<OmniCoinToast message="Error!" type="error" />);
      
      const toastElement = screen.getByText('Error!').closest('div');
      expect(toastElement).toBeInTheDocument();
      expect(toastElement).toHaveStyle('background-color: #ef4444');
    });

    it('should render pending toast with correct styling attributes', () => {
      render(<OmniCoinToast message="Processing..." type="pending" />);
      
      const toastElement = screen.getByText('Processing...').closest('div');
      expect(toastElement).toBeInTheDocument();
      expect(toastElement).toHaveStyle('background-color: #f59e0b');
    });

    it('should render info toast with correct styling attributes (default)', () => {
      render(<OmniCoinToast message="Info" type="info" />);
      
      const toastElement = screen.getByText('Info').closest('div');
      expect(toastElement).toBeInTheDocument();
      expect(toastElement).toHaveStyle('background-color: #3b82f6');
    });

    it('should default to info type when no type is provided', () => {
      render(<OmniCoinToast message="Default type" />);
      
      const toastElement = screen.getByText('Default type').closest('div');
      expect(toastElement).toBeInTheDocument();
      expect(toastElement).toHaveStyle('background-color: #3b82f6');
    });
  });

  describe('Auto-dismiss Functionality', () => {
    it('should call onClose after default duration (3000ms)', async () => {
      const onClose = jest.fn();
      
      render(<OmniCoinToast message="Auto dismiss" onClose={onClose} />);
      
      expect(onClose).not.toHaveBeenCalled();
      
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose after custom duration', async () => {
      const onClose = jest.fn();
      
      render(<OmniCoinToast message="Custom duration" onClose={onClose} duration={1500} />);
      
      expect(onClose).not.toHaveBeenCalled();
      
      act(() => {
        jest.advanceTimersByTime(1500);
      });
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not auto-dismiss when duration is 0', async () => {
      const onClose = jest.fn();
      
      render(<OmniCoinToast message="No auto dismiss" onClose={onClose} duration={0} />);
      
      act(() => {
        jest.advanceTimersByTime(10000);
      });
      
      expect(onClose).not.toHaveBeenCalled();
    });

    it('should not auto-dismiss when duration is negative', async () => {
      const onClose = jest.fn();
      
      render(<OmniCoinToast message="Negative duration" onClose={onClose} duration={-1000} />);
      
      act(() => {
        jest.advanceTimersByTime(10000);
      });
      
      expect(onClose).not.toHaveBeenCalled();
    });

    it('should not call onClose when onClose is not provided', async () => {
      // This test ensures no runtime errors occur
      expect(() => {
        render(<OmniCoinToast message="No onClose" duration={1000} />);
        
        act(() => {
          jest.advanceTimersByTime(1000);
        });
      }).not.toThrow();
    });
  });

  describe('Manual Dismiss Functionality', () => {
    it('should call onClose when close button is clicked', () => {
      const onClose = jest.fn();
      
      render(<OmniCoinToast message="Manual close" onClose={onClose} />);
      
      const closeButton = screen.getByRole('button', { name: 'Close toast' });
      fireEvent.click(closeButton);
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should handle mouse hover effects on close button', () => {
      const onClose = jest.fn();
      
      render(<OmniCoinToast message="Hover test" onClose={onClose} />);
      
      const closeButton = screen.getByRole('button', { name: 'Close toast' });
      
      // Initial opacity should be 0.7
      expect(closeButton).toHaveStyle('opacity: 0.7');
      
      // Hover should change opacity to 1
      fireEvent.mouseEnter(closeButton);
      expect(closeButton).toHaveStyle('opacity: 1');
      
      // Unhover should change opacity back to 0.7
      fireEvent.mouseLeave(closeButton);
      expect(closeButton).toHaveStyle('opacity: 0.7');
    });
  });

  describe('useEffect Hook Behavior and Return Paths', () => {
    it('should properly cleanup timer on unmount', () => {
      const onClose = jest.fn();
      const { unmount } = render(<OmniCoinToast message="Cleanup test" onClose={onClose} duration={5000} />);
      
      // Should not call onClose before unmount
      expect(onClose).not.toHaveBeenCalled();
      
      unmount();
      
      // Advance time after unmount - should not call onClose
      act(() => {
        jest.advanceTimersByTime(5000);
      });
      
      expect(onClose).not.toHaveBeenCalled();
    });

    it('should reset timer when duration prop changes', () => {
      const onClose = jest.fn();
      const { rerender } = render(<OmniCoinToast message="Timer reset" onClose={onClose} duration={3000} />);
      
      // Advance time partially
      act(() => {
        jest.advanceTimersByTime(1500);
      });
      
      expect(onClose).not.toHaveBeenCalled();
      
      // Change duration prop
      rerender(<OmniCoinToast message="Timer reset" onClose={onClose} duration={1000} />);
      
      // Should call onClose after new duration from rerender
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should reset timer when onClose prop changes', () => {
      const onClose1 = jest.fn();
      const onClose2 = jest.fn();
      
      const { rerender } = render(<OmniCoinToast message="OnClose change" onClose={onClose1} duration={2000} />);
      
      // Advance time partially
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      expect(onClose1).not.toHaveBeenCalled();
      expect(onClose2).not.toHaveBeenCalled();
      
      // Change onClose prop
      rerender(<OmniCoinToast message="OnClose change" onClose={onClose2} duration={2000} />);
      
      // Complete the remaining time
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      
      expect(onClose1).not.toHaveBeenCalled();
      expect(onClose2).toHaveBeenCalledTimes(1);
    });

    it('should handle transition from duration > 0 to duration <= 0', () => {
      const onClose = jest.fn();
      const { rerender } = render(<OmniCoinToast message="Duration change" onClose={onClose} duration={2000} />);
      
      // Change to duration <= 0
      rerender(<OmniCoinToast message="Duration change" onClose={onClose} duration={0} />);
      
      // Advance time significantly
      act(() => {
        jest.advanceTimersByTime(10000);
      });
      
      expect(onClose).not.toHaveBeenCalled();
    });

    it('should handle transition from duration <= 0 to duration > 0', () => {
      const onClose = jest.fn();
      const { rerender } = render(<OmniCoinToast message="Duration enable" onClose={onClose} duration={0} />);
      
      // Change to duration > 0
      rerender(<OmniCoinToast message="Duration enable" onClose={onClose} duration={1500} />);
      
      // Should now auto-dismiss after new duration
      act(() => {
        jest.advanceTimersByTime(1500);
      });
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('TypeScript Strict Mode Compliance', () => {
    it('should handle optional props with proper defaults', () => {
      // Test minimal props
      render(<OmniCoinToast message="Minimal" />);
      expect(screen.getByText('Minimal')).toBeInTheDocument();
      
      // Test with only type
      render(<OmniCoinToast message="With type" type="error" />);
      expect(screen.getByText('With type')).toBeInTheDocument();
      
      // Test with only duration
      render(<OmniCoinToast message="With duration" duration={5000} />);
      expect(screen.getByText('With duration')).toBeInTheDocument();
      
      // Test with only onClose
      render(<OmniCoinToast message="With onClose" onClose={() => {}} />);
      expect(screen.getByText('With onClose')).toBeInTheDocument();
    });

    it('should properly type the onClose callback', () => {
      const onClose: () => void = jest.fn();
      
      render(<OmniCoinToast message="Type test" onClose={onClose} />);
      
      const closeButton = screen.getByRole('button', { name: 'Close toast' });
      expect(closeButton).toBeInTheDocument();
    });

    it('should handle all valid toast types', () => {
      const validTypes: Array<'success' | 'error' | 'info' | 'pending'> = ['success', 'error', 'info', 'pending'];
      
      validTypes.forEach((type, index) => {
        const { unmount } = render(<OmniCoinToast message={`Type: ${type}`} type={type} />);
        expect(screen.getByText(`Type: ${type}`)).toBeInTheDocument();
        unmount();
      });
    });

    it('should handle message prop as string type only', () => {
      // This test ensures TypeScript compliance - message must be string
      const message: string = "Typed message";
      render(<OmniCoinToast message={message} />);
      expect(screen.getByText('Typed message')).toBeInTheDocument();
    });

    it('should handle duration prop as number type only', () => {
      // This test ensures TypeScript compliance - duration must be number
      const duration: number = 2500;
      const onClose = jest.fn();
      
      render(<OmniCoinToast message="Duration type" duration={duration} onClose={onClose} />);
      
      act(() => {
        jest.advanceTimersByTime(duration);
      });
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Component Structure and Styling', () => {
    it('should render with correct CSS structure', () => {
      render(<OmniCoinToast message="Structure test" type="success" />);
      
      const container = screen.getByTestId('toast-container');
      expect(container).toHaveStyle({
        position: 'fixed',
        bottom: '2rem',
        right: '2rem',
        padding: '1rem',
        display: 'flex',
        gap: '0.5rem'
      });
    });

    it('should render message with correct styling', () => {
      render(<OmniCoinToast message="Message styling" />);
      
      const messageElement = screen.getByText('Message styling');
      expect(messageElement.tagName).toBe('P');
      expect(messageElement).toHaveStyle({
        margin: '0px',
        fontSize: '0.875rem'
      });
    });

    it('should render close button with correct styling', () => {
      render(<OmniCoinToast message="Close button styling" onClose={() => {}} />);
      
      const closeButton = screen.getByRole('button', { name: 'Close toast' });
      expect(closeButton).toHaveStyle({
        cursor: 'pointer',
        padding: '0.25rem',
        opacity: '0.7'
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA label for close button', () => {
      render(<OmniCoinToast message="Accessibility test" onClose={() => {}} />);
      
      const closeButton = screen.getByRole('button', { name: 'Close toast' });
      expect(closeButton).toHaveAttribute('aria-label', 'Close toast');
    });

    it('should be focusable when close button is present', () => {
      render(<OmniCoinToast message="Focus test" onClose={() => {}} />);
      
      const closeButton = screen.getByRole('button', { name: 'Close toast' });
      closeButton.focus();
      expect(closeButton).toHaveFocus();
    });

    it('should not have focusable elements when no close button', () => {
      render(<OmniCoinToast message="No focus" />);
      
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long messages', () => {
      const longMessage = 'A'.repeat(1000);
      render(<OmniCoinToast message={longMessage} />);
      
      expect(screen.getByText(longMessage)).toBeInTheDocument();
    });

    it('should handle empty message', () => {
      render(<OmniCoinToast message="" />);
      
      const messageElement = screen.getByTestId('toast-container').querySelector('p');
      expect(messageElement).toBeInTheDocument();
      expect(messageElement).toHaveTextContent('');
    });

    it('should handle very short durations', () => {
      const onClose = jest.fn();
      render(<OmniCoinToast message="Short duration" duration={1} onClose={onClose} />);
      
      act(() => {
        jest.advanceTimersByTime(1);
      });
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should handle very large durations', () => {
      const onClose = jest.fn();
      const largeDuration = 1000000; // 1 million ms (16+ minutes)
      render(<OmniCoinToast message="Large duration" duration={largeDuration} onClose={onClose} />);
      
      // Should not call onClose after advancing by much less than the duration
      act(() => {
        jest.advanceTimersByTime(10000); // Only 10 seconds
      });
      
      expect(onClose).not.toHaveBeenCalled();
      
      // But should call after advancing by the full duration
      act(() => {
        jest.advanceTimersByTime(largeDuration - 10000);
      });
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});