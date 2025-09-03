// Lightweight shims to reduce type noise in strict mode

// Browser extension APIs
declare namespace chrome {
  // Minimal runtime messaging surface used in the app
  namespace runtime {
    interface MessageSender { tab?: unknown; id?: string }
    function sendMessage(message: unknown): Promise<unknown>;
    const onMessage: { addListener: (callback: (message: unknown, sender: MessageSender, sendResponse: (response?: unknown) => void) => boolean | void) => void };
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
declare module '@trezor/*';
declare module '@zondax/ledger-substrate';
declare module '@enkryptcom/*';

// Path alias shims used by imported example files
declare module '~/core/*';
declare module '~/entries/*';
declare module '~/logger';
declare module '~/test/*';
