import { NetworkNames } from "../../../types/enkrypt-types";
import { bip44Paths } from "../../configs";
import { PathType } from "../types";

const supportedPaths: Record<string, PathType[]> = {
  [NetworkNames.Bitcoin]: [{
    basePath: bip44Paths.bitcoinSegwitLedger,
    path: bip44Paths.bitcoinSegwitLedger + "/{index}"
  }],
  [NetworkNames.Litecoin]: [{
    basePath: bip44Paths.litecoinSegwitLedger,
    path: bip44Paths.litecoinSegwitLedger + "/{index}"
  }],
  [NetworkNames.Dogecoin]: [{
    basePath: bip44Paths.dogecoinLedger,
    path: bip44Paths.dogecoinLedger + "/{index}"
  }],
};
export { supportedPaths };
