// Global type declarations for OmniBazaar Wallet
// Chrome types are provided via @types/chrome and tsconfig "types" entry.

// Window object extensions
interface Window {
  omnibazaar?: EthereumProvider;
  ethereum?: EthereumProvider;
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

export {}; 
