// Lightweight shims to reduce type noise in strict mode

// Browser extension APIs
declare namespace chrome {
  // Minimal runtime messaging surface used in the app
  namespace runtime {
    interface MessageSender { tab?: { id?: number } | undefined; id?: string }
    interface InstalledDetails { reason?: string; previousVersion?: string }
    function sendMessage(message: unknown): Promise<unknown>;
    const onMessage: {
      addListener: (
        callback: (
          message: unknown,
          sender: MessageSender,
          sendResponse: (response?: unknown) => void
        ) => boolean | void | Promise<boolean | void>
      ) => void
    };
    const onInstalled: { addListener: (callback: (details: InstalledDetails) => void) => void };
    const onStartup: { addListener: (callback: () => void) => void };
    function getURL(path: string): string;
  }

  // Minimal tabs API typings used by background script
  namespace tabs {
    interface Tab { id?: number; url?: string }
    interface TabActiveInfo { tabId: number; windowId: number }
    function sendMessage(tabId: number, message: unknown): Promise<void>;
    function create(createProperties: { url: string }): void;
    function query(queryInfo: { active: boolean; windowId: number }): Promise<Tab[]>;
    const onActivated: { addListener: (callback: (activeInfo: TabActiveInfo) => void) => void };
  }

  // Minimal windows API surface used
  namespace windows {
    const WINDOW_ID_NONE: number;
    const onFocusChanged: { addListener: (callback: (windowId: number) => void) => void };
  }
}

// Global WebSocket for environments where DOM lib isn’t present
declare const WebSocket: any;

// Minimal JSX support for TSX usage without pulling full React/Vue types
declare namespace JSX {
  interface IntrinsicElements { [elemName: string]: any }
  // Keep Element very loose to avoid conflicts across renderers
  interface Element {}
}

// Node-style process/env used in a few places
declare const process: { env?: Record<string, string | undefined> };

// Vite-style import meta used in some services
interface ImportMeta { env?: Record<string, string | undefined> }

// Jest globals for isolated unit tests without @types/jest
declare const jest: any;
declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void | Promise<void>): void;
declare function beforeEach(fn: () => void | Promise<void>): void;
declare function afterEach(fn: () => void | Promise<void>): void;
declare function expect(actual: any): any;

// Frequently missing external module typings — treat them as any
declare module '@metaplex-foundation/mpl-token-metadata';
declare module '@tanstack/react-query';
declare module 'viem';
declare module 'hdkey';
declare module 'tweetnacl-util';
declare module '@apollo/client';
declare module '@ledgerhq/*';
declare module '@ledgerhq/live-common/*';
declare module '@trezor/*';
declare module '@zondax/ledger-substrate';
declare module '@enkryptcom/*';
declare module '@enkryptcom/types';
declare module '@enkryptcom/utils';
declare module '@ethereumjs/tx';
declare module '@ethereumjs/util';
declare module '@ethereumjs/rlp';
declare module '@coti-io/coti-sdk-typescript';
declare module '@polkadot/*';
declare module '@solana/web3.js';
declare module '@mui/material';
declare module '@mui/icons-material';

// Path alias shims used by imported example files
declare module '~/core/*';
declare module '~/entries/*';
declare module '~/logger';
declare module '~/test/*';

// Permit '@/...' imports used within Wallet without a repo-level path mapping
declare module '@/*';
