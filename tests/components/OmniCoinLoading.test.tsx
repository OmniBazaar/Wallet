/**
 * OmniCoinLoading React Component Tests
 * Tests TypeScript strict compliance, CSS injection, and loading states
 */

import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { jest } from '@jest/globals';
import { OmniCoinLoading } from '../../src/ui/widgets/omnicoin/components/OmniCoinLoading';

describe('OmniCoinLoading Component', () => {
  
  beforeEach(() => {
    // Clean up any existing style elements before each test
    const existingStyles = document.querySelectorAll('#omnicoin-loading-styles');
    existingStyles.forEach(style => style.remove());
  });

  afterEach(() => {
    cleanup();
    // Clean up style elements after each test
    const existingStyles = document.querySelectorAll('#omnicoin-loading-styles');
    existingStyles.forEach(style => style.remove());
  });

  describe('Basic Rendering', () => {
    it('should render with default props', () => {
      render(<OmniCoinLoading />);
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should render with custom text', () => {
      render(<OmniCoinLoading text="Custom loading text" />);
      
      expect(screen.getByText('Custom loading text')).toBeInTheDocument();
    });

    it('should render with empty text', () => {
      render(<OmniCoinLoading text="" />);
      
      const textElement = screen.getByTestId('loading-text');
      expect(textElement).toBeInTheDocument();
      expect(textElement).toHaveTextContent('');
    });
  });

  describe('Progress Bar Functionality', () => {
    it('should not show progress bar by default', () => {
      render(<OmniCoinLoading />);
      
      expect(screen.queryByTestId('progress-bar')).not.toBeInTheDocument();
    });

    it('should show progress bar when showProgress is true', () => {
      render(<OmniCoinLoading showProgress={true} progress={50} />);
      
      const progressContainer = screen.getByTestId('progress-bar');
      expect(progressContainer).toBeInTheDocument();
    });

    it('should display correct progress percentage', () => {
      render(<OmniCoinLoading showProgress={true} progress={75} />);
      
      const progressFill = screen.getByTestId('progress-fill');
      expect(progressFill).toHaveStyle({ width: '75%' });
    });

    it('should handle 0% progress', () => {
      render(<OmniCoinLoading showProgress={true} progress={0} />);
      
      const progressFill = screen.getByTestId('progress-fill');
      expect(progressFill).toHaveStyle({ width: '0%' });
    });

    it('should handle 100% progress', () => {
      render(<OmniCoinLoading showProgress={true} progress={100} />);
      
      const progressFill = screen.getByTestId('progress-fill');
      expect(progressFill).toHaveStyle({ width: '100%' });
    });

    it('should handle progress values over 100%', () => {
      render(<OmniCoinLoading showProgress={true} progress={150} />);
      
      const progressFill = screen.getByTestId('progress-fill');
      expect(progressFill).toHaveStyle({ width: '150%' });
    });

    it('should handle negative progress values', () => {
      render(<OmniCoinLoading showProgress={true} progress={-25} />);
      
      const progressFill = screen.getByTestId('progress-fill');
      expect(progressFill).toHaveStyle({ width: '-25%' });
    });
  });

  describe('CSS Injection and Styling', () => {
    it('should inject CSS animations into document head on first render', () => {
      // Clear existing styles first, then render component
      const existingStyles = document.querySelectorAll('#omnicoin-loading-styles');
      existingStyles.forEach(style => style.remove());
      
      render(<OmniCoinLoading />);
      
      const styleElement = document.getElementById('omnicoin-loading-styles');
      expect(styleElement).toBeInTheDocument();
      expect(styleElement?.tagName).toBe('STYLE');
    });

    it('should not inject duplicate styles if already present', () => {
      // Pre-inject the styles
      const preExistingStyle = document.createElement('style');
      preExistingStyle.id = 'omnicoin-loading-styles';
      preExistingStyle.textContent = 'test content';
      document.head.appendChild(preExistingStyle);
      
      render(<OmniCoinLoading />);
      
      const styleElements = document.querySelectorAll('#omnicoin-loading-styles');
      expect(styleElements).toHaveLength(1);
      expect(styleElements[0].textContent).toBe('test content');
    });

    it('should have correct keyframes in injected CSS', () => {
      // Clear existing styles first, then render component
      const existingStyles = document.querySelectorAll('#omnicoin-loading-styles');
      existingStyles.forEach(style => style.remove());
      
      render(<OmniCoinLoading />);
      
      const styleElement = document.getElementById('omnicoin-loading-styles');
      expect(styleElement?.textContent).toContain('@keyframes spin');
      expect(styleElement?.textContent).toContain('@keyframes fadeIn');
      expect(styleElement?.textContent).toContain('rotate(0deg)');
      expect(styleElement?.textContent).toContain('rotate(360deg)');
      expect(styleElement?.textContent).toContain('opacity: 0');
      expect(styleElement?.textContent).toContain('opacity: 1');
    });

    it('should apply correct container styles', () => {
      render(<OmniCoinLoading />);
      
      const container = screen.getByTestId('loading-container');
      expect(container).toHaveStyle({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      });
    });

    it('should apply correct spinner styles', () => {
      render(<OmniCoinLoading />);
      
      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toHaveStyle({
        width: '40px',
        height: '40px',
        border: '3px solid #f3f4f6',
        borderTop: '3px solid #3b82f6',
        borderRadius: '50%',
        marginBottom: '16px'
      });
    });

    it('should apply correct text styles', () => {
      render(<OmniCoinLoading text="Test text" />);
      
      const textElement = screen.getByText('Test text');
      expect(textElement.tagName).toBe('P');
      expect(textElement).toHaveStyle({
        color: '#1f2937',
        fontSize: '14px',
        margin: '0',
        textAlign: 'center'
      });
    });

    it('should apply correct progress bar container styles', () => {
      render(<OmniCoinLoading showProgress={true} />);
      
      const progressContainer = screen.getByTestId('progress-bar');
      expect(progressContainer).toHaveStyle({
        width: '200px',
        height: '4px',
        background: '#f3f4f6',
        borderRadius: '2px',
        marginTop: '16px',
        overflow: 'hidden'
      });
    });

    it('should apply correct progress fill styles', () => {
      render(<OmniCoinLoading showProgress={true} progress={60} />);
      
      const progressFill = screen.getByTestId('progress-fill');
      expect(progressFill).toHaveStyle({
        width: '60%',
        height: '100%',
        background: '#3b82f6',
        borderRadius: '2px',
        transition: 'width 0.3s ease-in-out'
      });
    });
  });

  describe('TypeScript Strict Mode Compliance', () => {
    it('should handle all optional props with proper defaults', () => {
      // Test completely minimal usage
      render(<OmniCoinLoading />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should handle partial prop combinations', () => {
      // Text only
      render(<OmniCoinLoading text="Custom text" />);
      expect(screen.getByText('Custom text')).toBeInTheDocument();
      
      cleanup();
      
      // Progress only
      render(<OmniCoinLoading progress={50} />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      
      cleanup();
      
      // ShowProgress only
      render(<OmniCoinLoading showProgress={true} />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should properly type text prop as optional string', () => {
      const text: string | undefined = 'Typed text';
      render(<OmniCoinLoading text={text} />);
      expect(screen.getByText('Typed text')).toBeInTheDocument();
      
      cleanup();
      
      const undefinedText: string | undefined = undefined;
      render(<OmniCoinLoading text={undefinedText} />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should properly type progress prop as optional number', () => {
      const progress: number | undefined = 42;
      render(<OmniCoinLoading progress={progress} showProgress={true} />);
      
      const progressFill = screen.getByTestId('progress-fill');
      expect(progressFill).toHaveStyle({ width: '42%' });
      
      cleanup();
      
      const undefinedProgress: number | undefined = undefined;
      render(<OmniCoinLoading progress={undefinedProgress} showProgress={true} />);
      
      const defaultProgressFill = screen.getByTestId('progress-fill');
      expect(defaultProgressFill).toHaveStyle({ width: '0%' });
    });

    it('should properly type showProgress prop as optional boolean', () => {
      const showProgress: boolean | undefined = true;
      render(<OmniCoinLoading showProgress={showProgress} />);
      
      expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
      
      cleanup();
      
      const undefinedShowProgress: boolean | undefined = undefined;
      render(<OmniCoinLoading showProgress={undefinedShowProgress} />);
      
      expect(screen.queryByTestId('progress-bar')).not.toBeInTheDocument();
    });

    it('should handle interface props correctly', () => {
      const props: {
        text?: string;
        progress?: number;
        showProgress?: boolean;
      } = {
        text: 'Interface test',
        progress: 88,
        showProgress: true
      };
      
      render(<OmniCoinLoading {...props} />);
      
      expect(screen.getByText('Interface test')).toBeInTheDocument();
      
      const progressFill = screen.getByTestId('progress-fill');
      expect(progressFill).toHaveStyle({ width: '88%' });
    });
  });

  describe('Component Structure', () => {
    it('should render correct DOM structure without progress', () => {
      render(<OmniCoinLoading text="Structure test" />);
      
      const container = screen.getByTestId('loading-container');
      expect(container.children).toHaveLength(2); // spinner + text
      
      const spinner = screen.getByTestId('loading-spinner');
      const text = screen.getByTestId('loading-text');
      expect(spinner.tagName).toBe('DIV');
      expect(text.tagName).toBe('P');
      expect(text).toHaveTextContent('Structure test');
    });

    it('should render correct DOM structure with progress', () => {
      render(<OmniCoinLoading text="Structure with progress" showProgress={true} progress={25} />);
      
      const container = screen.getByTestId('loading-container');
      expect(container.children).toHaveLength(3); // spinner + text + progress
      
      const spinner = screen.getByTestId('loading-spinner');
      const text = screen.getByTestId('loading-text');
      const progressContainer = screen.getByTestId('progress-bar');
      expect(spinner.tagName).toBe('DIV');
      expect(text.tagName).toBe('P');
      expect(text).toHaveTextContent('Structure with progress');
      expect(progressContainer.tagName).toBe('DIV');
      expect(progressContainer.children).toHaveLength(1); // progress fill
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long text', () => {
      const longText = 'A'.repeat(1000);
      render(<OmniCoinLoading text={longText} />);
      
      expect(screen.getByText(longText)).toBeInTheDocument();
    });

    it('should handle special characters in text', () => {
      const specialText = '!@#$%^&*()_+{}[]|\\:";\'<>?,./~`';
      render(<OmniCoinLoading text={specialText} />);
      
      expect(screen.getByText(specialText)).toBeInTheDocument();
    });

    it('should handle Unicode characters in text', () => {
      const unicodeText = '🚀 Loading... 🌟 正在加载... 🔄';
      render(<OmniCoinLoading text={unicodeText} />);
      
      expect(screen.getByText(unicodeText)).toBeInTheDocument();
    });

    it('should handle floating point progress values', () => {
      render(<OmniCoinLoading showProgress={true} progress={33.7} />);
      
      const progressFill = screen.getByTestId('progress-fill');
      expect(progressFill).toHaveStyle({ width: '33.7%' });
    });

    it('should handle very large progress values', () => {
      render(<OmniCoinLoading showProgress={true} progress={999999} />);
      
      const progressFill = screen.getByTestId('progress-fill');
      expect(progressFill).toHaveStyle({ width: '999999%' });
    });

    it('should handle very small progress values', () => {
      render(<OmniCoinLoading showProgress={true} progress={0.001} />);
      
      const progressFill = screen.getByTestId('progress-fill');
      expect(progressFill).toHaveStyle({ width: '0.001%' });
    });
  });

  describe('Server-Side Rendering Compatibility', () => {
    it('should not crash when document is undefined', () => {
      // Mock document as undefined to simulate SSR
      const originalDocument = global.document;
      (global as any).document = undefined;
      
      expect(() => {
        // The component should still render without crashing
        const { OmniCoinLoading: SSRComponent } = require('../../src/ui/widgets/omnicoin/components/OmniCoinLoading');
        render(<SSRComponent text="SSR test" />);
      }).not.toThrow();
      
      // Restore document
      global.document = originalDocument;
    });
  });

  describe('Multiple Instance Handling', () => {
    it('should handle multiple instances without style conflicts', () => {
      // Clear existing styles first
      const existingStyles = document.querySelectorAll('#omnicoin-loading-styles');
      existingStyles.forEach(style => style.remove());
      
      render(<OmniCoinLoading text="Instance 1" />);
      render(<OmniCoinLoading text="Instance 2" />);
      
      expect(screen.getByText('Instance 1')).toBeInTheDocument();
      expect(screen.getByText('Instance 2')).toBeInTheDocument();
      
      // Should only have one style element
      const styleElements = document.querySelectorAll('#omnicoin-loading-styles');
      expect(styleElements).toHaveLength(1);
    });
  });
});