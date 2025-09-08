/**
 * Popup entry point for OmniWallet browser extension
 */

console.log('OmniWallet popup loaded');

// Basic popup functionality
document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = '<h1>OmniWallet</h1><p>Multi-chain wallet ready</p>';
  }
});