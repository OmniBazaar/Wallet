// Ambient module declarations for packages without local types.

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

declare module 'styled-components' {
  import type * as React from 'react';
  export const ThemeProvider: React.FC<{ /** Theme object to provide to styled components */
  theme: unknown; /** Child components */
  children?: React.ReactNode }>;
  export function css(strings: TemplateStringsArray, ...interpolations: unknown[]): unknown;
  export const keyframes: unknown;
  const styled: unknown;
  export default styled;
}

declare module 'ledger-bitcoin' {
  /** Bitcoin Ledger hardware wallet interface */
  export default class LedgerBTC {
    /** Create a new Ledger Bitcoin instance with transport */
    constructor(transport: unknown);
  }
}

declare module '@metamask/eth-sig-util' {
  export function recoverPersonalSignature(opts: { /** The original message data */
  data: string; /** The signature to recover from */
  signature: string }): string;
}

declare module '@rainbow-me/swaps' {
  const Swaps: unknown;
  export default Swaps;
}

declare module 'bcryptjs' {
  export function hash(data: string, saltOrRounds?: number | string): Promise<string>;
  export function compare(data: string, encrypted: string): Promise<boolean>;
}

// Additional ambient declarations to satisfy TS where external types are absent
declare module '@apollo/client' {
  export const gql: unknown;
  const Apollo: unknown;
  export default Apollo;
}

declare module '@tanstack/react-query' { const anyQuery: unknown; export = anyQuery; }
declare module 'viem' { const anyViem: unknown; export = anyViem; }
declare module '@metaplex-foundation/mpl-token-metadata' { const anyMeta: unknown; export = anyMeta; }
declare module '@trezor/connect-web' { const anyTrezor: unknown; export = anyTrezor; }
declare module '@trezor/connect-webextension' { const anyTrezorExt: unknown; export = anyTrezorExt; }
declare module '@trezor/connect-plugin-ethereum' { const anyTrezorEth: unknown; export = anyTrezorEth; }
declare module '@ethereumjs/tx' { const anyTx: unknown; export = anyTx; }
declare module '@ledgerhq/live-common/lib/hw/getDeviceInfo' { const anyX: unknown; export = anyX; }
declare module '@ledgerhq/live-common/lib/hw/openApp' { const anyX: unknown; export = anyX; }
declare module '@ledgerhq/live-common/lib/hw/getAppAndVersion' { const anyX: unknown; export = anyX; }
declare module '@ledgerhq/hw-app-solana' { const anyX: unknown; export = anyX; }
declare module '@zondax/ledger-substrate' { const anyX: unknown; export = anyX; }
declare module '@enkryptcom/types' { const anyX: unknown; export = anyX; }
declare module '@enkryptcom/utils' { const anyX: unknown; export = anyX; }
declare module '@enkryptcom/keyring' { const anyX: unknown; export = anyX; }
declare module 'tweetnacl-util' { const anyX: unknown; export = anyX; }
declare module 'hdkey' { const anyX: unknown; export = anyX; }
declare module 'elliptic' { const anyX: unknown; export = anyX; }

// Minimal JSX namespace to allow TSX without full React types
declare namespace JSX {
  interface IntrinsicElements { [elemName: string]: unknown }
  type Element = unknown;
}

// Chrome globals are handled by @types/chrome package

// Window ethereum typing
interface Window { ethereum?: unknown; phantom?: unknown; }

// Vite import.meta.env typing (minimal)
interface ImportMetaEnv { [key: string]: string | undefined }
interface ImportMeta { readonly env: ImportMetaEnv }
