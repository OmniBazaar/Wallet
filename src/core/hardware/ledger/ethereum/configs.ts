import { bip44Paths } from "../../configs";

/** Default BIP44 paths for Ethereum-based networks on Ledger */
const DEFAULT_PATHS = [
  bip44Paths.ethereumLedger,
  bip44Paths.ethereumLedgerLive,
];
/**
 * Supported derivation paths for each network on Ledger hardware wallets
 * Based on Ledger Ethereum app network configurations
 * @see https://github.com/LedgerHQ/app-ethereum/blob/develop/src/network.c
 * Last updated: 08-29-2024
 */
const supportedPaths = {
  Ethereum: DEFAULT_PATHS,
  Matic: DEFAULT_PATHS,
  MaticZK: DEFAULT_PATHS,
  Binance: DEFAULT_PATHS,
  Rootstock: [bip44Paths.rootstock],
  EthereumClassic: [
    bip44Paths.ethereumClassicLedger,
    bip44Paths.ethereumClassicLedgerLive,
  ],
  Moonbeam: DEFAULT_PATHS,
  Moonriver: DEFAULT_PATHS,
  Avalanche: DEFAULT_PATHS,
  Optimism: DEFAULT_PATHS,
  Sepolia: [bip44Paths.ethereumTestnetLedger, ...DEFAULT_PATHS],
  Okc: DEFAULT_PATHS,
  ShidenEVM: DEFAULT_PATHS,
  AstarEVM: DEFAULT_PATHS,
  ZkSync: DEFAULT_PATHS,
  Arbitrum: DEFAULT_PATHS,
  Gnosis: DEFAULT_PATHS,
  Fantom: DEFAULT_PATHS,
  Klaytn: DEFAULT_PATHS,
  Base: DEFAULT_PATHS,
  Celo: DEFAULT_PATHS,
  Syscoin: DEFAULT_PATHS,
  Telos: DEFAULT_PATHS,
  Blast: DEFAULT_PATHS,
};
/**
 * Supported derivation paths mapping for Ledger Ethereum networks
 */
export { supportedPaths };
