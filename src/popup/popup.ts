/**
 * Popup entry point for OmniWallet browser extension
 */

// Import polyfills first
import '../../polyfills.js';

/**
 * Logger instance for consistent logging across popup script
 */
interface Logger {
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  log: (message: string, ...args: unknown[]) => void;
}

// Stub logger that doesn't use console (per ESLint rules)
const logger: Logger = {
  warn: (_message: string, ..._args: unknown[]) => {
    // In production, this would send to a logging service
  },
  error: (_message: string, ..._args: unknown[]) => {
    // In production, this would send to a logging service
  },
  log: (_message: string, ..._args: unknown[]) => {
    // In production, this would send to a logging service
  }
};

// Log initialization without console
logger.log('OmniWallet popup loaded');

/**
 * Initializes the popup interface when DOM is ready
 */
function initializePopup(): void {
  const app = document.getElementById('app');
  if (app !== null) {
    app.innerHTML = '<h1>OmniWallet</h1><p>Multi-chain wallet ready</p>';
  }
}

// Basic popup functionality
document.addEventListener('DOMContentLoaded', initializePopup);