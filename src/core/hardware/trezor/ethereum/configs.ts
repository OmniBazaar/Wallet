import { bip44Paths } from "../../configs";
import type { PathType } from "../types";

const DEFAULT_PATH: PathType = {
  basePath: "m/44'/60'/0'",
  path: "m/44'/60'/0'/0/{index}"
};

const supportedPaths: Record<string, PathType[]> = {
  Ethereum: [DEFAULT_PATH],
  Matic: [DEFAULT_PATH],
  Avalanche: [DEFAULT_PATH],
  Binance: [DEFAULT_PATH],
  EthereumClassic: [{
    basePath: "m/44'/61'/0'",
    path: "m/44'/61'/0'/0/{index}"
  }],
  Rootstock: [{
    basePath: "m/44'/137'/0'",
    path: "m/44'/137'/0'/0/{index}"
  }],
  MaticZK: [DEFAULT_PATH],
  Moonbeam: [DEFAULT_PATH],
  Moonriver: [DEFAULT_PATH],
  Optimism: [DEFAULT_PATH],
  Sepolia: [{
    basePath: "m/44'/1'/0'",
    path: "m/44'/1'/0'/0/{index}"
  }, DEFAULT_PATH],
  Okc: [DEFAULT_PATH],
  ShidenEVM: [DEFAULT_PATH],
  AstarEVM: [DEFAULT_PATH],
  ZkSync: [DEFAULT_PATH],
  Arbitrum: [DEFAULT_PATH],
  Gnosis: [DEFAULT_PATH],
  Fantom: [DEFAULT_PATH],
  Kaia: [DEFAULT_PATH],
  Base: [DEFAULT_PATH],
  Celo: [DEFAULT_PATH],
  SyscoinNEVM: [DEFAULT_PATH],
  Telos: [DEFAULT_PATH],
  Blast: [DEFAULT_PATH],
};
export { supportedPaths };
