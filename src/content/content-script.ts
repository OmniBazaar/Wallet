// OmniBazaar Wallet Content Script
// Injects Web3 providers into web pages for dApp interaction

import { ProviderName, ProviderRPCRequest } from '@/types/provider';

// Declare global chrome API
declare const chrome: {
  runtime: {
    onMessage: {
      addListener: (callback: (message: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => void | boolean) => void;
    };
    sendMessage: (message: unknown) => Promise<unknown>;
  };
};
declare const window: Window & {
  ethereum?: unknown;
  [key: string]: unknown;
};

console.warn('🌐 OmniBazaar Wallet content script loaded');

// Track injected providers
const injectedProviders = new Set<string>();

// Message handler for background script communications
chrome.runtime.onMessage.addListener((message: { type: string; data?: unknown }, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => {
  console.warn('📨 Content script received message:', message.type);
  
  switch (message.type) {
    case 'PROVIDER_NOTIFICATION':
      handleProviderNotification(message.data);
      break;
      
    case 'PAGE_CONTEXT_REQUEST':
      sendResponse({
        url: window.location.href,
        title: document.title,
        favicon: getFaviconUrl()
      });
      break;
      
    default:
      console.warn('Unknown message type in content script:', message.type);
  }
  
  return true;
});

// Get favicon URL
function getFaviconUrl(): string {
  const favicon = document.querySelector('link[rel*="icon"]') as HTMLLinkElement;
  return favicon ? favicon.href : '';
}

// Handle provider notifications from background
function handleProviderNotification(data: string): void {
  try {
    const notification = JSON.parse(data);
    
    // Forward to injected provider
    window.postMessage({
      type: 'OMNIBAZAAR_PROVIDER_NOTIFICATION',
      data: notification
    }, '*');
  } catch (error) {
    console.error('Failed to handle provider notification:', error);
  }
}

// Send request to background script
async function sendToBackground(type: string, data: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, data }, (response: unknown) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

// Event callback type
type EventCallback = (detail: unknown) => void;

// Create OmniBazaar provider
function createOmniBazaarProvider(): unknown {
  console.warn('🔗 Creating OmniBazaar provider');
  
  const provider = {
    isOmniBazaar: true,
    isConnected: () => true,
    
    // Standard Web3 provider methods
    request: async (args: ProviderRPCRequest) => {
      console.warn('🔗 OmniBazaar provider request:', args.method);
      
      const response = await sendToBackground('PROVIDER_REQUEST', {
        ...args,
        provider: ProviderName.omnibazaar,
        options: {
          url: window.location.href,
          domain: window.location.hostname,
          title: document.title,
          faviconURL: getFaviconUrl(),
          tabId: -1 // Will be set by background script
        }
      });
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      return JSON.parse(response.result || 'null');
    },
    
    // Event handling
    on: (event: string, callback: EventCallback) => {
      window.addEventListener(`omnibazaar_${event}`, (e: CustomEvent) => {
        callback(e.detail);
      });
    },
    
    removeListener: (event: string, callback: EventCallback) => {
      window.removeEventListener(`omnibazaar_${event}`, callback);
    },
    
    // OmniBazaar-specific methods
    mintNFT: async (metadata: unknown) => {
      return await sendToBackground('MINT_NFT', metadata);
    },
    
    createListing: async (listing: unknown) => {
      return await sendToBackground('CREATE_LISTING', listing);
    },
    
    searchMarketplace: async (query: unknown) => {
      return await sendToBackground('SEARCH_MARKETPLACE', query);
    },
    
    // Marketplace node discovery
    discoverNodes: async (): Promise<unknown> => {
      return await sendToBackground('DISCOVER_NODES', {});
    }
  };
  
  return provider;
}

// Legacy callback type for older dApps
type LegacyCallback = (error: Error | null, result?: unknown) => void;

// Create Ethereum provider (for compatibility with existing dApps)
function createEthereumProvider(): unknown {
  console.warn('🔗 Creating Ethereum provider');
  
  const provider = {
    isMetaMask: false, // Don't pretend to be MetaMask
    isOmniBazaar: true,
    chainId: '0x1',
    networkVersion: '1',
    selectedAddress: null,
    
    request: async (args: ProviderRPCRequest) => {
      console.warn('🔗 Ethereum provider request:', args.method);
      
      const response = await sendToBackground('PROVIDER_REQUEST', {
        ...args,
        provider: ProviderName.ethereum,
        options: {
          url: window.location.href,
          domain: window.location.hostname,
          title: document.title,
          faviconURL: getFaviconUrl(),
          tabId: -1
        }
      });
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      return JSON.parse(response.result || 'null');
    },
    
    // Legacy methods for older dApps
    send: async (method: string, params: unknown[]) => {
      return provider.request({ id: Date.now(), method, params });
    },
    
    sendAsync: (request: ProviderRPCRequest, callback: LegacyCallback) => {
      provider.request(request)
        .then(result => callback(null, { id: request.id, jsonrpc: '2.0', result }))
        .catch(error => callback(error));
    },
    
    // Event handling
    on: (event: string, callback: EventCallback) => {
      window.addEventListener(`ethereum_${event}`, (e: CustomEvent<unknown>) => {
        callback(e.detail);
      });
    },
    
    removeListener: (event: string, callback: EventCallback) => {
      window.removeEventListener(`ethereum_${event}`, callback);
    },
    
    // Standard provider properties
    isConnected: () => true,
    enable: async () => {
      return provider.request({ id: Date.now(), method: 'eth_requestAccounts', params: [] });
    }
  };
  
  return provider;
}

// Inject providers into the page
function injectProviders(): void {
  if (window.omnibazaar) {
    console.warn('🔄 OmniBazaar provider already exists');
    return;
  }
  
  console.warn('💉 Injecting OmniBazaar providers');
  
  // Inject OmniBazaar provider
  window.omnibazaar = createOmniBazaarProvider();
  injectedProviders.add('omnibazaar');
  
  // Inject Ethereum provider for dApp compatibility
  if (!window.ethereum) {
    window.ethereum = createEthereumProvider();
    injectedProviders.add('ethereum');
  }
  
  // Announce provider availability (EIP-6963)
  announceProvider();
  
  // Dispatch events for dApp detection
  window.dispatchEvent(new CustomEvent('omnibazaar#initialized'));
  window.dispatchEvent(new CustomEvent('ethereum#initialized'));
  
  console.warn('✅ Providers injected successfully:', Array.from(injectedProviders));
}

// Announce provider according to EIP-6963
function announceProvider(): void {
  const detail = {
    info: {
      uuid: 'omnibazaar-wallet-' + Date.now(),
      name: 'OmniBazaar Wallet',
      icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE2IDJMMjggMTZMMTYgMzBMNCAyOEw0IDRMMTYgMloiIGZpbGw9IiMwMDc2RkYiLz4KPC9zdmc+',
      rdns: 'com.omnibazaar.wallet'
    },
    provider: window.ethereum
  };
  
  window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail }));
}

// Listen for EIP-6963 requests
window.addEventListener('eip6963:requestProvider', () => {
  announceProvider();
});

// Listen for page messages
window.addEventListener('message', (event: MessageEvent) => {
  if (event.data?.type === 'OMNIBAZAAR_PROVIDER_NOTIFICATION') {
    // Forward provider notifications to dApp
    const { method, params } = event.data.data;
    
    if (method === 'chainChanged') {
      if (window.ethereum) {
        window.ethereum.chainId = params[0];
      }
      window.dispatchEvent(new CustomEvent('ethereum_chainChanged', { detail: params[0] }));
    } else if (method === 'accountsChanged') {
      if (window.ethereum) {
        window.ethereum.selectedAddress = params[0]?.[0] || null;
      }
      window.dispatchEvent(new CustomEvent('ethereum_accountsChanged', { detail: params }));
    }
  }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectProviders);
} else {
  injectProviders();
}

// Also inject on document idle for SPA compatibility
setTimeout(injectProviders, 100);

console.warn('🚀 OmniBazaar Wallet content script initialized'); 