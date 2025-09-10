// import {
//   newAcalaApp,
//   newKusamaApp,
//   newPolkadotApp,
//   newKaruraApp,
// } from "@zondax/ledger-substrate";
// import type { SubstrateApp } from "@zondax/ledger-substrate";

// Temporary stub for missing imports
type SubstrateApp = Record<string, unknown>;
const newAcalaApp = (_transport: unknown) => ({} as SubstrateApp);
const newKusamaApp = (_transport: unknown) => ({} as SubstrateApp);
const newPolkadotApp = (_transport: unknown) => ({} as SubstrateApp);
const newKaruraApp = (_transport: unknown) => ({} as SubstrateApp);
import type Transport from "@ledgerhq/hw-transport";
import { NetworkNames } from "../../../types/enkrypt-types";

export const LedgerApps: Record<
  string,
  (transport: Transport) => SubstrateApp
> = {
  [NetworkNames.Acala]: newAcalaApp,
  [NetworkNames.Kusama]: newKusamaApp,
  [NetworkNames.Polkadot]: newPolkadotApp,
  [NetworkNames.Karura]: newKaruraApp,
};
