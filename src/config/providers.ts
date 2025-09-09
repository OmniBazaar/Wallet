/**
 * Wallet provider discovery and access utilities.
 *
 * Exposes a simple registry of known browser-injected wallet providers
 * and helpers to obtain the EIP-1193 provider instances.
 */

/**
 * Provider identification type for supported wallet providers
 */
export type ProviderId =
  | 'metamask'
  | 'coinbase'
  | 'brave'
  | 'okx'
  | 'phantom-evm'
  | 'walletconnect'
  | 'window-ethereum';

/**
 * Provider information interface for wallet discovery
 */
export interface ProviderInfo {
  /** Stable identifier */
  id: ProviderId;
  /** Human-readable name */
  name: string;
  /** Optional icon identifier or URL */
  icon: string;
  /** Lazy getter to return EIP-1193 provider when available */
  getProvider: () => Promise<unknown>;
  /** Whether provider appears installed in current environment */
  isInstalled: boolean;
}

/**
 * EIP-1193 Ethereum provider interface
 */
interface EthereumProvider {
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isBraveWallet?: boolean;
  isOkxWallet?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

/**
 * Global window interface with potential wallet providers
 */
interface GlobalWindow {
  ethereum?: EthereumProvider;
  phantom?: {
    ethereum?: EthereumProvider;
  };
}

/**
 * Resolve a specific provider by id.
 * @param id - Provider identifier to look up
 * @returns ProviderInfo if found, undefined otherwise
 */
export function getProvider(id: ProviderId): ProviderInfo | undefined {
  const providers = getAvailableProviders();
  return providers.find((p) => p.id === id);
}

/**
 * Enumerate available providers visible on `window`.
 * @returns Array of installed provider information
 */
export function getAvailableProviders(): ProviderInfo[] {
  const w = globalThis as unknown as GlobalWindow;
  const ethereum = w.ethereum ?? null;

  const hasMetaMask = ethereum?.isMetaMask === true;
  const hasCoinbase = ethereum?.isCoinbaseWallet === true;
  const hasBrave = ethereum?.isBraveWallet === true;
  const hasOkx = ethereum?.isOkxWallet === true;

  const entries: ProviderInfo[] = [
    {
      id: 'metamask',
      name: 'MetaMask',
      icon: 'metamask',
      isInstalled: hasMetaMask,
      getProvider: (): Promise<unknown> => Promise.resolve(hasMetaMask ? ethereum : null),
    },
    {
      id: 'coinbase',
      name: 'Coinbase Wallet',
      icon: 'coinbase',
      isInstalled: hasCoinbase,
      getProvider: (): Promise<unknown> => Promise.resolve(hasCoinbase ? ethereum : null),
    },
    {
      id: 'brave',
      name: 'Brave Wallet',
      icon: 'brave',
      isInstalled: hasBrave,
      getProvider: (): Promise<unknown> => Promise.resolve(hasBrave ? ethereum : null),
    },
    {
      id: 'okx',
      name: 'OKX Wallet',
      icon: 'okx',
      isInstalled: hasOkx,
      getProvider: (): Promise<unknown> => Promise.resolve(hasOkx ? ethereum : null),
    },
    {
      id: 'phantom-evm',
      name: 'Phantom (EVM)',
      icon: 'phantom',
      isInstalled: typeof w.phantom?.ethereum !== 'undefined',
      getProvider: (): Promise<unknown> => Promise.resolve(w.phantom?.ethereum ?? null),
    },
    {
      id: 'walletconnect',
      name: 'WalletConnect',
      icon: 'walletconnect',
      // WalletConnect requires SDK initialization; discovery returns not installed
      isInstalled: false,
      getProvider: (): Promise<unknown> => Promise.resolve(null),
    },
    {
      id: 'window-ethereum',
      name: 'Window Ethereum',
      icon: 'ethereum',
      isInstalled: ethereum !== null && ethereum !== undefined,
      getProvider: (): Promise<unknown> => Promise.resolve(ethereum ?? null),
    },
  ];

  return entries.filter((e) => e.isInstalled);
}