// import {
//   newAcalaApp,
//   newKusamaApp,
//   newPolkadotApp,
//   newKaruraApp,
// } from "@zondax/ledger-substrate";
// import type { SubstrateApp } from "@zondax/ledger-substrate";

// Temporary stub for missing imports
type SubstrateApp = any;
const newAcalaApp = (transport: any) => ({} as SubstrateApp);
const newKusamaApp = (transport: any) => ({} as SubstrateApp);
const newPolkadotApp = (transport: any) => ({} as SubstrateApp);
const newKaruraApp = (transport: any) => ({} as SubstrateApp);
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
