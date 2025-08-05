// Global type declarations for OmniBazaar Wallet

// Chrome Extension APIs
declare const chrome: {
  runtime: {
    onMessage: {
      addListener: (callback: (message: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => boolean | void) => void;
    };
    onInstalled: {
      addListener: (callback: (details: { reason: string }) => void) => void;
    };
    onStartup: {
      addListener: (callback: () => void) => void;
    };
    sendMessage: (message: unknown, callback?: (response: unknown) => void) => void;
    getURL: (path: string) => string;
    lastError?: { message: string };
  };
  tabs: {
    sendMessage: (tabId: number, message: unknown) => Promise<unknown>;
    create: (options: { url: string }) => void;
    onActivated: {
      addListener: (callback: (activeInfo: { tabId: number }) => void) => void;
    };
    query: (options: { active: boolean; windowId?: number }) => Promise<Array<{ id?: number }>>;
  };
  windows: {
    onFocusChanged: {
      addListener: (callback: (windowId: number) => void) => void;
    };
    WINDOW_ID_NONE: number;
  };
};

// Window object extensions
interface Window {
  omnibazaar?: EthereumProvider;
  ethereum?: EthereumProvider;
  chrome?: typeof chrome;
}

// Custom event types
interface CustomEvent<T = unknown> {
  detail: T;
}

// Ethereum provider types
interface EthereumProvider {
  isMetaMask?: boolean;
  isOmniBazaar?: boolean;
  chainId?: string;
  networkVersion?: string;
  selectedAddress?: string | null;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, callback: (data: unknown) => void) => void;
  removeListener?: (event: string, callback: (data: unknown) => void) => void;
  isConnected?: () => boolean;
  enable?: () => Promise<string[]>;
  send?: (method: string, params: unknown[]) => Promise<unknown>;
  sendAsync?: (request: unknown, callback: (error: Error | null, result?: unknown) => void) => void;
}

// AbortSignal timeout method (newer browsers)
interface AbortSignal {
  timeout?: (milliseconds: number) => AbortSignal;
}

declare namespace AbortSignal {
  function timeout(milliseconds: number): AbortSignal;
}

// Browser globals
declare const document: Document;
declare const window: Window & typeof globalThis;
declare const navigator: Navigator;

export {}; 