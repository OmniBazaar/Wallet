// import { bip44Paths } from "../../configs"; - unused import
import type { PathType } from "../types";

const supportedPaths: Record<string, PathType[]> = {
  Solana: [{
    basePath: "m/44'/501'/0'",
    path: "m/44'/501'/0'/0/{index}"
  }],
};

export { supportedPaths };
