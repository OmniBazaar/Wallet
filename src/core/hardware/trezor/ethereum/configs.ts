import { bip44Paths } from "../../configs";

const DEFAULT_PATHS = [bip44Paths.ethereum];
const supportedPaths = {
  Ethereum: DEFAULT_PATHS,
  Matic: DEFAULT_PATHS,
  Avalanche: DEFAULT_PATHS,
  Binance: DEFAULT_PATHS,
  EthereumClassic: [bip44Paths.ethereumClassic],
  Rootstock: [bip44Paths.rootstock],
  MaticZK: DEFAULT_PATHS,
  Moonbeam: DEFAULT_PATHS,
  Moonriver: DEFAULT_PATHS,
  Optimism: DEFAULT_PATHS,
  Sepolia: [bip44Paths.ethereumTestnetLedger, ...DEFAULT_PATHS],
  Okc: DEFAULT_PATHS,
  ShidenEVM: DEFAULT_PATHS,
  AstarEVM: DEFAULT_PATHS,
  ZkSync: DEFAULT_PATHS,
  Arbitrum: DEFAULT_PATHS,
  Gnosis: DEFAULT_PATHS,
  Fantom: DEFAULT_PATHS,
  Kaia: DEFAULT_PATHS,
  Base: DEFAULT_PATHS,
  Celo: DEFAULT_PATHS,
  SyscoinNEVM: DEFAULT_PATHS,
  Telos: DEFAULT_PATHS,
  Blast: DEFAULT_PATHS,
};
export { supportedPaths };
