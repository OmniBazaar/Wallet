/**
 * Wallet provider discovery and access utilities.
 *
 * Exposes a simple registry of known browser-injected wallet providers
 * and helpers to obtain the EIP-1193 provider instances.
 */

/**
 *
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
 *
 */
export interface ProviderInfo {
  /** Stable identifier */
  id: ProviderId;
  /** Human-readable name */
  name: string;
  /** Optional icon identifier or URL */
  icon: string;
  /** Lazy getter to return EIP-1193 provider when available */
  getProvider: () => Promise<unknown | null>;
  /** Whether provider appears installed in current environment */
  isInstalled: boolean;
}

/**
 * Resolve a specific provider by id.
 * @param id
 */
export function getProvider(id: ProviderId): ProviderInfo | undefined {
  const providers = getAvailableProviders();
  return providers.find((p) => p.id === id);
}

/** Enumerate available providers visible on `window`. */
export function getAvailableProviders(): ProviderInfo[] {
  const w = (globalThis as unknown as { [k: string]: any }) || {};
  const ethereum = w['ethereum'] ?? w['window']?.['ethereum'] ?? null;

  const hasMetaMask = Boolean(ethereum?.isMetaMask);
  const hasCoinbase = Boolean(ethereum?.isCoinbaseWallet);
  const hasBrave = Boolean(ethereum?.isBraveWallet);
  const hasOkx = Boolean(ethereum?.isOkxWallet);

  const entries: ProviderInfo[] = [
    {
      id: 'metamask',
      name: 'MetaMask',
      icon: 'metamask',
      isInstalled: hasMetaMask,
      getProvider: async () => (hasMetaMask ? ethereum : null),
    },
    {
      id: 'coinbase',
      name: 'Coinbase Wallet',
      icon: 'coinbase',
      isInstalled: hasCoinbase,
      getProvider: async () => (hasCoinbase ? ethereum : null),
    },
    {
      id: 'brave',
      name: 'Brave Wallet',
      icon: 'brave',
      isInstalled: hasBrave,
      getProvider: async () => (hasBrave ? ethereum : null),
    },
    {
      id: 'okx',
      name: 'OKX Wallet',
      icon: 'okx',
      isInstalled: hasOkx,
      getProvider: async () => (hasOkx ? ethereum : null),
    },
    {
      id: 'phantom-evm',
      name: 'Phantom (EVM)',
      icon: 'phantom',
      isInstalled: Boolean(w['phantom']?.['ethereum']),
      getProvider: async () => w['phantom']?.['ethereum'] ?? null,
    },
    {
      id: 'walletconnect',
      name: 'WalletConnect',
      icon: 'walletconnect',
      // WalletConnect requires SDK initialization; discovery returns not installed
      isInstalled: false,
      getProvider: async () => null,
    },
    {
      id: 'window-ethereum',
      name: 'Window Ethereum',
      icon: 'ethereum',
      isInstalled: Boolean(ethereum),
      getProvider: async () => ethereum ?? null,
    },
  ];

  return entries.filter((e) => e.isInstalled);
}
