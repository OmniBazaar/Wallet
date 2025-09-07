import { bip44Paths } from "../../configs";
import { PathType } from "../types";

const supportedPaths: PathType[] = [{
  basePath: bip44Paths.substrateLedger,
  path: bip44Paths.substrateLedger + "/{index}"
}];

export { supportedPaths };
