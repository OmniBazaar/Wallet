// import { bip44Paths } from "../../configs"; - unused import
import type { PathType } from "../types";

const supportedPaths: Record<string, PathType[]> = {
  Bitcoin: [{
    basePath: "m/84'/0'/0'",
    path: "m/84'/0'/0'/0/{index}"
  }],
  Litecoin: [{
    basePath: "m/84'/2'/0'",
    path: "m/84'/2'/0'/0/{index}"
  }],
  Dogecoin: [{
    basePath: "m/44'/3'/0'",
    path: "m/44'/3'/0'/0/{index}"
  }],
};

const TrezorNetworkConfigs = {
  Bitcoin: {
    symbol: "btc",
    isSegwit: true,
  },
  Litecoin: {
    symbol: "ltc",
    isSegwit: true,
  },
  Dogecoin: {
    symbol: "doge",
    isSegwit: false,
  },
};
export { supportedPaths, TrezorNetworkConfigs };
