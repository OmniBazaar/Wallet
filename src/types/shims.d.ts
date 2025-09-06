// Ambient module declarations for packages without local types.

declare module 'styled-components' {
  import type * as React from 'react';
  export const ThemeProvider: React.FC<{ theme: unknown; children?: React.ReactNode }>;
  export function css(strings: TemplateStringsArray, ...interpolations: any[]): any;
  export const keyframes: any;
  const styled: any;
  export default styled;
}

declare module 'ledger-bitcoin' {
  export default class LedgerBTC {
    constructor(transport: unknown);
  }
}

declare module '@metamask/eth-sig-util' {
  export function recoverPersonalSignature(opts: { data: string; signature: string }): string;
}

declare module '@rainbow-me/swaps' {
  const Swaps: any;
  export default Swaps;
}

declare module 'bcryptjs' {
  export function hash(data: string, saltOrRounds?: number | string): Promise<string>;
  export function compare(data: string, encrypted: string): Promise<boolean>;
}

// Additional ambient declarations to satisfy TS where external types are absent
declare module '@apollo/client' {
  export const gql: any;
  const Apollo: any;
  export default Apollo;
}

declare module '@tanstack/react-query' { const anyQuery: any; export = anyQuery; }
declare module 'viem' { const anyViem: any; export = anyViem; }
declare module '@metaplex-foundation/mpl-token-metadata' { const anyMeta: any; export = anyMeta; }
declare module '@trezor/connect-web' { const anyTrezor: any; export = anyTrezor; }
declare module '@trezor/connect-webextension' { const anyTrezorExt: any; export = anyTrezorExt; }
declare module '@trezor/connect-plugin-ethereum' { const anyTrezorEth: any; export = anyTrezorEth; }
declare module '@ethereumjs/tx' { const anyTx: any; export = anyTx; }
declare module '@ledgerhq/live-common/lib/hw/getDeviceInfo' { const anyX: any; export = anyX; }
declare module '@ledgerhq/live-common/lib/hw/openApp' { const anyX: any; export = anyX; }
declare module '@ledgerhq/live-common/lib/hw/getAppAndVersion' { const anyX: any; export = anyX; }
declare module '@ledgerhq/hw-app-solana' { const anyX: any; export = anyX; }
declare module '@zondax/ledger-substrate' { const anyX: any; export = anyX; }
declare module '@enkryptcom/types' { const anyX: any; export = anyX; }
declare module '@enkryptcom/utils' { const anyX: any; export = anyX; }
declare module '@enkryptcom/keyring' { const anyX: any; export = anyX; }
declare module 'tweetnacl-util' { const anyX: any; export = anyX; }
declare module 'hdkey' { const anyX: any; export = anyX; }
declare module 'elliptic' { const anyX: any; export = anyX; }

// Minimal JSX namespace to allow TSX without full React types
declare namespace JSX {
  interface IntrinsicElements { [elemName: string]: any }
  type Element = any;
}

// Basic chrome global for extension context if types not present
declare namespace chrome {
  const runtime: any;
  const tabs: any;
}

// Window ethereum typing
interface Window { ethereum?: any; phantom?: any; }

// Vite import.meta.env typing (minimal)
interface ImportMetaEnv { [key: string]: string | undefined }
interface ImportMeta { readonly env: ImportMetaEnv }
