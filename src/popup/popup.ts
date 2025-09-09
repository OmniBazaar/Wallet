/**
 * Popup entry point for OmniWallet browser extension
 */

/**
 * Logger instance for consistent logging across popup script
 */
interface Logger {
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

const logger: Logger = {
  warn: (message: string, ...args: unknown[]) => console.warn(message, ...args),
  error: (message: string, ...args: unknown[]) => console.error(message, ...args)
};

logger.warn('OmniWallet popup loaded');

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