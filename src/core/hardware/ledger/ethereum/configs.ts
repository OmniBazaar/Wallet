import { bip44Paths } from "../../configs";
import type { PathType } from "../types";

/** Default BIP44 paths for Ethereum-based networks on Ledger */
const DEFAULT_PATHS: PathType[] = [
  { basePath: bip44Paths.ethereumLedger, path: bip44Paths.ethereumLedger + "/{index}" },
  { basePath: bip44Paths.ethereumLedgerLive, path: bip44Paths.ethereumLedgerLive + "/{index}" },
];
/**
 * Supported derivation paths for each network on Ledger hardware wallets
 * Based on Ledger Ethereum app network configurations
 * @see https://github.com/LedgerHQ/app-ethereum/blob/develop/src/network.c
 * Last updated: 08-29-2024
 */
const supportedPaths: Record<string, PathType[]> = {
  Ethereum: DEFAULT_PATHS,
  Matic: DEFAULT_PATHS,
  MaticZK: DEFAULT_PATHS,
  Binance: DEFAULT_PATHS,
  Rootstock: [{ basePath: bip44Paths.rootstock, path: bip44Paths.rootstock + "/{index}" }],
  EthereumClassic: [
    { basePath: bip44Paths.ethereumClassicLedger, path: bip44Paths.ethereumClassicLedger + "/{index}" },
    { basePath: bip44Paths.ethereumClassicLedgerLive, path: bip44Paths.ethereumClassicLedgerLive + "/{index}" },
  ],
  Moonbeam: DEFAULT_PATHS,
  Moonriver: DEFAULT_PATHS,
  Avalanche: DEFAULT_PATHS,
  Optimism: DEFAULT_PATHS,
  Sepolia: [
    { basePath: bip44Paths.ethereumTestnetLedger, path: bip44Paths.ethereumTestnetLedger + "/{index}" },
    ...DEFAULT_PATHS
  ],
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
