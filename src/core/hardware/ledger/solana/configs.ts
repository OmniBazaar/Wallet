import { bip44Paths } from "../../configs";
import { PathType } from "../types";

const supportedPaths: Record<string, PathType[]> = {
  Solana: [{
    basePath: bip44Paths.solanaLedger,
    path: bip44Paths.solanaLedger + "/{index}"
  }],
};
export { supportedPaths };
