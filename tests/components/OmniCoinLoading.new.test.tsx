/**
 * OmniCoinLoading.new React Component Tests
 * Tests the new version of the loading component with unique style ID
 */

import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { jest } from '@jest/globals';
import { OmniCoinLoading } from '../../src/ui/widgets/omnicoin/components/OmniCoinLoading.new';

describe('OmniCoinLoading.new Component', () => {
  
  beforeEach(() => {
    // Clean up any existing style elements before each test
    const existingStyles = document.querySelectorAll('#omnicoin-loading-styles-new');
    existingStyles.forEach(style => style.remove());
  });

  afterEach(() => {
    cleanup();
    // Clean up style elements after each test
    const existingStyles = document.querySelectorAll('#omnicoin-loading-styles-new');
    existingStyles.forEach(style => style.remove());
  });

  describe('Style ID Uniqueness', () => {
    it('should inject CSS with unique style ID (omnicoin-loading-styles-new)', () => {
      render(<OmniCoinLoading />);
      
      const styleElement = document.getElementById('omnicoin-loading-styles-new');
      expect(styleElement).toBeInTheDocument();
      expect(styleElement?.tagName).toBe('STYLE');
      
      // Should not conflict with original component style ID
      const originalStyleElement = document.getElementById('omnicoin-loading-styles');
      expect(originalStyleElement).not.toBeInTheDocument();
    });

    it('should not inject duplicate styles with the new ID', () => {
      // Pre-inject the styles with new ID
      const preExistingStyle = document.createElement('style');
      preExistingStyle.id = 'omnicoin-loading-styles-new';
      preExistingStyle.textContent = 'test new content';
      document.head.appendChild(preExistingStyle);
      
      render(<OmniCoinLoading />);
      
      const styleElements = document.querySelectorAll('#omnicoin-loading-styles-new');
      expect(styleElements).toHaveLength(1);
      expect(styleElements[0].textContent).toBe('test new content');
    });
  });

  describe('Functional Equivalence to Original', () => {
    it('should render with default props identically to original', () => {
      render(<OmniCoinLoading />);
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should render with custom text identically to original', () => {
      render(<OmniCoinLoading text="New component test" />);
      
      expect(screen.getByText('New component test')).toBeInTheDocument();
    });

    it('should handle progress bar functionality identically', () => {
      render(<OmniCoinLoading showProgress={true} progress={65} />);
      
      const progressFill = screen.getByTestId('omnicoin-loading-progress');
      
      expect(progressFill).toHaveStyle({ width: '65%' });
    });

    it('should apply identical container styles', () => {
      render(<OmniCoinLoading />);
      
      const container = screen.getByTestId('omnicoin-loading-container');
      expect(container).toHaveStyle({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      });
    });

    it('should apply identical spinner styles', () => {
      render(<OmniCoinLoading />);
      
      const spinner = screen.getByTestId('omnicoin-loading-spinner');
      
      expect(spinner).toBeTruthy();
      expect(spinner).toHaveStyle({
        width: '40px',
        height: '40px',
        border: '3px solid #f3f4f6',
        borderTop: '3px solid #3b82f6',
        borderRadius: '50%',
        marginBottom: '16px'
      });
    });

    it('should apply identical text styles', () => {
      render(<OmniCoinLoading text="Style test" />);
      
      const textElement = screen.getByText('Style test');
      expect(textElement.tagName).toBe('P');
      expect(textElement).toHaveStyle({
        color: '#1f2937',
        fontSize: '14px',
        margin: '0',
        textAlign: 'center'
      });
    });
  });

  describe('TypeScript Strict Mode Compliance', () => {
    it('should handle all optional props with proper defaults', () => {
      render(<OmniCoinLoading />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should properly handle typed props', () => {
      const props: {
        text?: string;
        progress?: number;
        showProgress?: boolean;
      } = {
        text: 'New component interface test',
        progress: 42,
        showProgress: true
      };
      
      render(<OmniCoinLoading {...props} />);
      
      expect(screen.getByText('New component interface test')).toBeInTheDocument();
      
      const progressFill = screen.getByTestId('omnicoin-loading-progress');
      expect(progressFill).toHaveStyle({ width: '42%' });
    });
  });

  describe('CSS Animation Content Verification', () => {
    it('should inject identical animation keyframes as original', () => {
      render(<OmniCoinLoading />);
      
      const styleElement = document.getElementById('omnicoin-loading-styles-new');
      expect(styleElement?.textContent).toContain('@keyframes spin');
      expect(styleElement?.textContent).toContain('@keyframes fadeIn');
      expect(styleElement?.textContent).toContain('transform: rotate(0deg)');
      expect(styleElement?.textContent).toContain('transform: rotate(360deg)');
      expect(styleElement?.textContent).toContain('opacity: 0');
      expect(styleElement?.textContent).toContain('opacity: 1');
    });

    it('should have animation properties applied to elements', () => {
      render(<OmniCoinLoading />);
      
      const container = screen.getByTestId('omnicoin-loading-container');
      expect(container).toHaveStyle({
        animation: 'fadeIn 0.3s ease-in-out'
      });
      
      const spinner = screen.getByTestId('omnicoin-loading-spinner');
      
      expect(spinner).toHaveStyle({
        animation: 'spin 1s linear infinite'
      });
    });
  });

  describe('Component Isolation', () => {
    it('should work independently of the original component', () => {
      // This test ensures that the new component doesn't interfere with 
      // or depend on the original component being loaded
      render(<OmniCoinLoading text="Independent test" showProgress={true} progress={30} />);
      
      expect(screen.getByText('Independent test')).toBeInTheDocument();
      
      const progressFill = screen.getByTestId('omnicoin-loading-progress');
      expect(progressFill).toHaveStyle({ width: '30%' });
      
      // Verify it uses the new style ID
      const newStyleElement = document.getElementById('omnicoin-loading-styles-new');
      expect(newStyleElement).toBeInTheDocument();
      
      // Verify it doesn't create the original style ID
      const originalStyleElement = document.getElementById('omnicoin-loading-styles');
      expect(originalStyleElement).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases Specific to New Component', () => {
    it('should handle multiple instances with new style ID', () => {
      const { unmount: unmount1 } = render(<OmniCoinLoading text="New Instance 1" />);
      const { unmount: unmount2 } = render(<OmniCoinLoading text="New Instance 2" />);
      
      expect(screen.getByText('New Instance 1')).toBeInTheDocument();
      expect(screen.getByText('New Instance 2')).toBeInTheDocument();
      
      // Should only have one style element with the new ID
      const styleElements = document.querySelectorAll('#omnicoin-loading-styles-new');
      expect(styleElements).toHaveLength(1);
      
      unmount1();
      unmount2();
    });

    it('should maintain style isolation when both versions might be used', () => {
      // Simulate a scenario where both old and new components might be used
      const oldStyleElement = document.createElement('style');
      oldStyleElement.id = 'omnicoin-loading-styles';
      oldStyleElement.textContent = 'old component styles';
      document.head.appendChild(oldStyleElement);
      
      render(<OmniCoinLoading text="New version with old styles present" />);
      
      // Should create new style element without interfering with old one
      const newStyleElement = document.getElementById('omnicoin-loading-styles-new');
      expect(newStyleElement).toBeInTheDocument();
      
      const oldStyleStillExists = document.getElementById('omnicoin-loading-styles');
      expect(oldStyleStillExists).toBeInTheDocument();
      expect(oldStyleStillExists?.textContent).toBe('old component styles');
      
      expect(screen.getByText('New version with old styles present')).toBeInTheDocument();
      
      // Clean up
      oldStyleElement.remove();
    });
  });

  describe('Server-Side Rendering Compatibility (New Version)', () => {
    it('should handle document undefined gracefully', () => {
      const originalDocument = global.document;
      (global as any).document = undefined;
      
      expect(() => {
        // Should not crash when document is undefined
        const { OmniCoinLoading: SSRNewComponent } = require('../../src/ui/widgets/omnicoin/components/OmniCoinLoading.new');
        render(<SSRNewComponent text="SSR new version test" />);
      }).not.toThrow();
      
      global.document = originalDocument;
    });
  });

  describe('Performance Considerations', () => {
    it('should not re-inject styles on re-renders', () => {
      const { rerender } = render(<OmniCoinLoading text="Initial" />);
      
      expect(document.querySelectorAll('#omnicoin-loading-styles-new')).toHaveLength(1);
      
      rerender(<OmniCoinLoading text="Updated" />);
      rerender(<OmniCoinLoading text="Updated Again" progress={50} showProgress={true} />);
      
      // Should still only have one style element
      expect(document.querySelectorAll('#omnicoin-loading-styles-new')).toHaveLength(1);
      
      expect(screen.getByText('Updated Again')).toBeInTheDocument();
    });
  });
});