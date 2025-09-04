import { bip44Paths } from "../../configs";

const supportedPaths = {
  Bitcoin: [bip44Paths.bitcoinSegwitTrezor],
  Litecoin: [bip44Paths.litecoinSegwitTrezor],
  Dogecoin: [bip44Paths.dogecoinTrezor],
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
