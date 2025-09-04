// Minimal hardware config stubs to satisfy strict type-checking
// Real implementations should mirror the upstream libraries’ structures.

export const bip44Paths = {
  ethereumLedger: "m/44'/60'/0'",
  ethereumLedgerLive: "m/44'/60'/0'/0",
  ethereumClassicLedger: "m/44'/61'/0'",
  ethereumClassicLedgerLive: "m/44'/61'/0'/0",
  ethereumTestnetLedger: "m/44'/1'/0'",
  rootstock: "m/44'/137'/0'",
  solanaLedger: "m/44'/501'/0'",
  substrateLedger: "m/44'/354'/0'",
  // Trezor paths
  ethereum: "m/44'/60'/0'/0/0",
  ethereumClassic: "m/44'/61'/0'/0/0",
  solanaTrezor: "m/44'/501'/0'",
};

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
