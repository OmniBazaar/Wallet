/**
 * OmniBazaar Wallet Content Script
 * Injects Web3 providers into web pages for dApp interaction
 * Provides both OmniBazaar-specific and Ethereum-compatible provider APIs
 */

import { ProviderName, ProviderRPCRequest } from '@/types/provider';

// Use casts to interact with injected providers without imposing global types

console.warn('🌐 OmniBazaar Wallet content script loaded');

/** Track which providers have been injected to avoid duplicates */
const injectedProviders = new Set<string>();

/**
 * Message handler for background script communications
 * Handles provider notifications and page context requests
 */
chrome.runtime.onMessage.addListener((message: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => {
  const msg = (typeof message === 'object' && message !== null ? message : { type: 'UNKNOWN' }) as { type: string; data?: unknown };
  console.warn('📨 Content script received message:', msg.type);

  switch (msg.type) {
    case 'PROVIDER_NOTIFICATION':
      handleProviderNotification(msg.data as string);
      break;

    case 'PAGE_CONTEXT_REQUEST':
      sendResponse({
        url: window.location.href,
        title: document.title,
        favicon: getFaviconUrl()
      });
      break;

    default:
      console.warn('Unknown message type in content script:', msg.type);
      }

  return true;
});

/**
 * Extracts the favicon URL from the current page
 * @returns The favicon URL or empty string if not found
 */
function getFaviconUrl(): string {
  const favicon = document.querySelector('link[rel*="icon"]') as HTMLLinkElement;
  return favicon != null ? favicon.href : '';
}

/**
 * Handles provider notifications from the background script
 * Forwards notifications to injected providers via postMessage
 * @param data - JSON string containing notification data
 */
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

/**
 * Sends requests to the background script via Chrome runtime messaging
 * @param type - The message type identifier
 * @param data - The message payload
 * @returns Promise resolving to the background script response
 * @throws {Error} When the Chrome runtime encounters an error
 */
async function sendToBackground(type: string, data: unknown): Promise<any> {
  return chrome.runtime.sendMessage({ type, data });
}

/** Event callback function type for provider event handling */
type EventCallback = (detail: unknown) => void;

/**
 * Creates the OmniBazaar-specific Web3 provider
 * Includes marketplace-specific methods alongside standard Web3 functionality
 * @returns The OmniBazaar provider object
 */
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
        provider: ProviderName.OMNIBAZAAR,
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
      const handler = (e: Event) => callback((e as CustomEvent).detail);
      window.addEventListener(`omnibazaar_${event}` as string, handler as EventListener);
    },

    removeListener: (event: string, callback: EventCallback) => {
      window.removeEventListener(`omnibazaar_${event}` as string, callback as unknown as EventListener);
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

/** Legacy callback type for older dApps that use sendAsync */
type LegacyCallback = (error: Error | null, result?: unknown) => void;

/**
 * Creates an Ethereum-compatible Web3 provider for dApp compatibility
 * Provides standard Ethereum RPC methods and legacy support
 * @returns The Ethereum provider object
 */
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
        provider: ProviderName.ETHEREUM,
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
      const handler = (e: Event) => callback((e as CustomEvent).detail);
      window.addEventListener(`ethereum_${event}` as string, handler as EventListener);
    },

    removeListener: (event: string, callback: EventCallback) => {
      window.removeEventListener(`ethereum_${event}` as string, callback as unknown as EventListener);
    },

    // Standard provider properties
    isConnected: () => true,
    enable: async () => {
      return provider.request({ id: Date.now(), method: 'eth_requestAccounts', params: [] });
    }
  };

  return provider;
}

/**
 * Injects Web3 providers into the page's window object
 * Creates both OmniBazaar and Ethereum providers for maximum dApp compatibility
 */
function injectProviders(): void {
  if ((window as any).omnibazaar) {
    console.warn('🔄 OmniBazaar provider already exists');
    return;
  }

  console.warn('💉 Injecting OmniBazaar providers');

  // Inject OmniBazaar provider
  (window as any).omnibazaar = createOmniBazaarProvider();
  injectedProviders.add('omnibazaar');

  // Inject Ethereum provider for dApp compatibility
  if (!(window as any).ethereum) {
    (window as any).ethereum = createEthereumProvider();
    injectedProviders.add('ethereum');
  }

  // Announce provider availability (EIP-6963)
  announceProvider();

  // Dispatch events for dApp detection
  window.dispatchEvent(new CustomEvent('omnibazaar#initialized'));
  window.dispatchEvent(new CustomEvent('ethereum#initialized'));

  console.warn('✅ Providers injected successfully:', Array.from(injectedProviders));
}

/**
 * Announces the provider according to EIP-6963 wallet discovery standard
 * Allows dApps to discover and connect to OmniBazaar Wallet
 */
function announceProvider(): void {
  const detail = {
    info: {
      uuid: 'omnibazaar-wallet-' + Date.now(),
      name: 'OmniBazaar Wallet',
      icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE2IDJMMjggMTZMMTYgMzBMNCAyOEw0IDRMMTYgMloiIGZpbGw9IiMwMDc2RkYiLz4KPC9zdmc+',
      rdns: 'com.omnibazaar.wallet'
    },
    provider: (window as any).ethereum
  };

  window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail }));
}

/**
 * Listen for EIP-6963 provider discovery requests
 * Responds with provider announcement when requested by dApps
 */
window.addEventListener('eip6963:requestProvider', () => {
  announceProvider();
});

/**
 * Listen for page messages and handle provider notifications
 * Forwards blockchain events to the appropriate provider instances
 */
window.addEventListener('message', (event: MessageEvent) => {
  if (event.data?.type === 'OMNIBAZAAR_PROVIDER_NOTIFICATION') {
    // Forward provider notifications to dApp
    const { method, params } = event.data.data;

    if (method === 'chainChanged') {
      if ((window as any).ethereum) {
        (window as any).ethereum.chainId = params[0];
      }
      window.dispatchEvent(new CustomEvent('ethereum_chainChanged', { detail: params[0] }));
    } else if (method === 'accountsChanged') {
      if ((window as any).ethereum) {
        (window as any).ethereum.selectedAddress = params[0]?.[0] || null;
      }
      window.dispatchEvent(new CustomEvent('ethereum_accountsChanged', { detail: params }));
    }
  }
});

/**
 * Initialize providers when DOM is ready
 * Handles both traditional page loads and SPA navigation
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectProviders);
} else {
  injectProviders();
}

/** Additional injection timeout for SPA compatibility */
setTimeout(injectProviders, 100);

console.warn('🚀 OmniBazaar Wallet content script initialized');
