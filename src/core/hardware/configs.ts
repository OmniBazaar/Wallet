// Minimal hardware config stubs to satisfy strict type-checking
// Real implementations should mirror the upstream libraries' structures.

/**
 * BIP44 HD wallet derivation paths for hardware wallets
 * Contains paths for both Ledger and Trezor devices across multiple networks
 */
export const bip44Paths = {
  ethereumLedger: "m/44'/60'/0'",
  ethereumLedgerLive: "m/44'/60'/0'/0",
  ethereumClassicLedger: "m/44'/61'/0'",
  ethereumClassicLedgerLive: "m/44'/61'/0'/0",
  ethereumTestnetLedger: "m/44'/1'/0'",
  // Bitcoin-family Ledger paths
  bitcoinSegwitLedger: "m/84'/0'/0'/0",
  litecoinSegwitLedger: "m/84'/2'/0'/0",
  dogecoinLedger: "m/44'/3'/0'/0",
  rootstock: "m/44'/137'/0'",
  solanaLedger: "m/44'/501'/0'",
  substrateLedger: "m/44'/354'/0'",
  // Trezor paths
  ethereum: "m/44'/60'/0'/0/0",
  ethereumClassic: "m/44'/61'/0'/0/0",
  solanaTrezor: "m/44'/501'/0'",
  // Bitcoin-family Trezor paths
  bitcoinSegwitTrezor: "m/84'/0'/0'/0",
  litecoinSegwitTrezor: "m/84'/2'/0'/0",
  dogecoinTrezor: "m/44'/3'/0'/0",
};

/**
 * Mapping of network names to Ledger app names
 * Used to determine which app should be opened on the Ledger device for each network
 */
export const ledgerAppNames: Record<string, string> = {
  Ethereum: 'Ethereum',
  Sepolia: 'Ethereum',
  Arbitrum: 'Ethereum',
  Optimism: 'Ethereum',
  Base: 'Ethereum',
  Matic: 'Polygon',
  MaticZK: 'Polygon',
  Avalanche: 'Avalanche',
  Binance: 'Binance Smart Chain',
};
