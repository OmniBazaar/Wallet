/**
 * OmniBazaar Wallet Content Script
 * Injects Web3 providers into web pages for dApp interaction
 * Provides both OmniBazaar-specific and Ethereum-compatible provider APIs
 */

import { ProviderName, ProviderRPCRequest } from '@/types/provider';

/**
 * Logger instance for consistent logging across content script
 */
interface Logger {
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

const logger: Logger = {
  warn: (message: string, ...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.warn(message, ...args);
  },
  error: (message: string, ...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.error(message, ...args);
  }
};

// Use casts to interact with injected providers without imposing global types
logger.warn('🌐 OmniBazaar Wallet content script loaded');

/** Track which providers have been injected to avoid duplicates */
const injectedProviders = new Set<string>();

/**
 * Message handler for background script communications
 * Handles provider notifications and page context requests
 */
chrome.runtime.onMessage.addListener((message: unknown, _sender: unknown, sendResponse: (response?: unknown) => void) => {
  const msg = (typeof message === 'object' && message !== null ? message : { type: 'UNKNOWN' }) as { type: string; data?: unknown };
  logger.warn('📨 Content script received message:', msg.type);

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
      logger.warn('Unknown message type in content script:', msg.type);
      }

  return true;
});

/**
 * Extracts the favicon URL from the current page
 * @returns The favicon URL or empty string if not found
 */
function getFaviconUrl(): string {
  const favicon = document.querySelector('link[rel*="icon"]');
  return favicon !== null ? (favicon as HTMLLinkElement).href : '';
}

/**
 * Handles provider notifications from the background script
 * Forwards notifications to injected providers via postMessage
 * @param data - JSON string containing notification data
 */
function handleProviderNotification(data: string): void {
  try {
    const notification = JSON.parse(data) as unknown;

    // Forward to injected provider
    window.postMessage({
      type: 'OMNIBAZAAR_PROVIDER_NOTIFICATION',
      data: notification
    }, '*');
  } catch (error) {
    logger.error('Failed to handle provider notification:', error);
  }
}

/**
 * Sends requests to the background script via Chrome runtime messaging
 * @param type - The message type identifier
 * @param data - The message payload
 * @returns Promise resolving to the background script response
 * @throws {Error} When the Chrome runtime encounters an error
 */
async function sendToBackground(type: string, data: unknown): Promise<unknown> {
  return await new Promise((resolve) => {
    try {
      const maybePromise = chrome.runtime.sendMessage({ type, data }, (response: unknown) => {
        resolve(response);
      });
      // Some environments return a Promise; handle that too
      if (maybePromise !== undefined && typeof (maybePromise as { then?: unknown }).then === 'function') {
        void (maybePromise as Promise<unknown>).then(resolve).catch((err) => resolve({ error: String(err) }));
      }
    } catch (err) {
      resolve({ error: err instanceof Error ? err.message : String(err) });
    }
  });
}

/** Event callback function type for provider event handling */
type EventCallback = (detail: unknown) => void;

/**
 * Creates the OmniBazaar-specific Web3 provider
 * Includes marketplace-specific methods alongside standard Web3 functionality
 * @returns The OmniBazaar provider object
 */
function createOmniBazaarProvider(): unknown {
  logger.warn('🔗 Creating OmniBazaar provider');

  const provider = {
    isOmniBazaar: true,
    isConnected: () => true,

    // Standard Web3 provider methods
    request: async (args: ProviderRPCRequest) => {
      logger.warn('🔗 OmniBazaar provider request:', args.method);

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

      const resp = response as { error?: string; result?: string };
      if (resp.error !== undefined && resp.error.length > 0) {
        throw new Error(resp.error);
      }

      return JSON.parse(resp.result ?? 'null') as unknown;
    },

    // Event handling
    on: (event: string, callback: EventCallback): void => {
      const handler = (e: Event): void => callback((e as CustomEvent).detail);
      window.addEventListener(`omnibazaar_${event}`, handler as EventListener);
    },

    removeListener: (event: string, callback: EventCallback) => {
      window.removeEventListener(`omnibazaar_${event}`, callback as unknown as EventListener);
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
  logger.warn('🔗 Creating Ethereum provider');

  const provider = {
    isMetaMask: false, // Don't pretend to be MetaMask
    isOmniBazaar: true,
    chainId: '0x1',
    networkVersion: '1',
    selectedAddress: null,

    request: async (args: ProviderRPCRequest) => {
      logger.warn('🔗 Ethereum provider request:', args.method);

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

      const resp = response as { error?: string; result?: string };
      if (resp.error !== undefined && resp.error.length > 0) {
        throw new Error(resp.error);
      }

      return JSON.parse(resp.result ?? 'null') as unknown;
    },

    // Legacy methods for older dApps
    send: async (method: string, params: unknown[]) => {
      return provider.request({ id: Date.now(), method, params });
    },

    sendAsync: (request: ProviderRPCRequest, callback: LegacyCallback) => {
      provider.request(request)
        .then((result: unknown) => callback(null, { id: request.id, jsonrpc: '2.0', result }))
        .catch((error: unknown) => callback(error instanceof Error ? error : new Error(String(error))));
    },

    // Event handling
    on: (event: string, callback: EventCallback): void => {
      const handler = (e: Event): void => callback((e as CustomEvent).detail);
      window.addEventListener(`ethereum_${event}`, handler as EventListener);
    },

    removeListener: (event: string, callback: EventCallback) => {
      window.removeEventListener(`ethereum_${event}`, callback as unknown as EventListener);
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
 * Extended window interface for provider injection
 */
interface ExtendedWindow extends Window {
  omnibazaar?: unknown;
  ethereum?: unknown;
}

/**
 * Injects Web3 providers into the page's window object
 * Creates both OmniBazaar and Ethereum providers for maximum dApp compatibility
 */
function injectProviders(): void {
  const extWindow = window as ExtendedWindow;
  if (extWindow.omnibazaar !== undefined) {
    logger.warn('🔄 OmniBazaar provider already exists');
    return;
  }

  logger.warn('💉 Injecting OmniBazaar providers');

  // Inject OmniBazaar provider
  extWindow.omnibazaar = createOmniBazaarProvider();
  injectedProviders.add('omnibazaar');

  // Inject Ethereum provider for dApp compatibility
  if (extWindow.ethereum === undefined) {
    extWindow.ethereum = createEthereumProvider();
    injectedProviders.add('ethereum');
  }

  // Announce provider availability (EIP-6963)
  announceProvider();

  // Dispatch events for dApp detection
  window.dispatchEvent(new CustomEvent('omnibazaar#initialized'));
  window.dispatchEvent(new CustomEvent('ethereum#initialized'));

  logger.warn('✅ Providers injected successfully:', Array.from(injectedProviders));
}

/**
 * Announces the provider according to EIP-6963 wallet discovery standard
 * Allows dApps to discover and connect to OmniBazaar Wallet
 */
function announceProvider(): void {
  const extWindow = window as ExtendedWindow;
  const detail = {
    info: {
      uuid: 'omnibazaar-wallet-' + Date.now().toString(),
      name: 'OmniBazaar Wallet',
      icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE2IDJMMjggMTZMMTYgMzBMNCAyOEw0IDRMMTYgMloiIGZpbGw9IiMwMDc2RkYiLz4KPC9zdmc+',
      rdns: 'com.omnibazaar.wallet'
    },
    provider: extWindow.ethereum
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
/**
 * Message event data structure
 */
interface ProviderMessage {
  type: string;
  data: {
    method?: string;
    params?: unknown[];
  };
}

window.addEventListener('message', (event: MessageEvent) => {
  const eventData = event.data as unknown;
  if (typeof eventData === 'object' && eventData !== null && 
      'type' in eventData && 'data' in eventData) {
    const messageData = eventData as ProviderMessage;
    if (messageData.type === 'OMNIBAZAAR_PROVIDER_NOTIFICATION' && 
        typeof messageData.data === 'object' && messageData.data !== null) {
      const extWindow = window as ExtendedWindow;
      // Forward provider notifications to dApp
      const { method, params } = messageData.data;

    if (method === 'chainChanged' && Array.isArray(params) && params.length > 0) {
      const ethProvider = extWindow.ethereum as { chainId?: string } | undefined;
      if (ethProvider !== undefined) {
        ethProvider.chainId = params[0] as string;
      }
      window.dispatchEvent(new CustomEvent('ethereum_chainChanged', { detail: params[0] }));
    } else if (method === 'accountsChanged' && Array.isArray(params)) {
      const ethProvider = extWindow.ethereum as { selectedAddress?: string | null } | undefined;
      if (ethProvider !== undefined) {
        const accounts = params[0] as string[] | undefined;
        ethProvider.selectedAddress = accounts?.[0] ?? null;
      }
      window.dispatchEvent(new CustomEvent('ethereum_accountsChanged', { detail: params }));
    }
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

logger.warn('🚀 OmniBazaar Wallet content script initialized');
