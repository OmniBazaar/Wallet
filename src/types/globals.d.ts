// Global type declarations for OmniBazaar Wallet

// Chrome Extension APIs
declare const chrome: {
  runtime: {
    onMessage: {
      addListener: (callback: (message: any, sender: any, sendResponse: any) => boolean | void) => void;
    };
    onInstalled: {
      addListener: (callback: (details: { reason: string }) => void) => void;
    };
    onStartup: {
      addListener: (callback: () => void) => void;
    };
    sendMessage: (message: any, callback?: (response: any) => void) => void;
    getURL: (path: string) => string;
    lastError?: { message: string };
  };
  tabs: {
    sendMessage: (tabId: number, message: any) => Promise<any>;
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
  omnibazaar?: any;
  ethereum?: any;
  chrome?: typeof chrome;
}

// Custom event types
interface CustomEvent<T = any> {
  detail: T;
}

// Ethereum provider types
interface EthereumProvider {
  isMetaMask?: boolean;
  isOmniBazaar?: boolean;
  chainId?: string;
  networkVersion?: string;
  selectedAddress?: string | null;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on?: (event: string, callback: (data: any) => void) => void;
  removeListener?: (event: string, callback: (data: any) => void) => void;
  isConnected?: () => boolean;
  enable?: () => Promise<string[]>;
  send?: (method: string, params: any[]) => Promise<any>;
  sendAsync?: (request: any, callback: (error: Error | null, result?: any) => void) => void;
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