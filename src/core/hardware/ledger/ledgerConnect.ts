// Loosen types to avoid external type dependency noise
import getDeviceInfo from "@ledgerhq/live-common/lib/hw/getDeviceInfo";
import openApp from "@ledgerhq/live-common/lib/hw/openApp";
import getAppAndVersion from "@ledgerhq/live-common/lib/hw/getAppAndVersion";
import type LedgerEthereum from "./ethereum";
import type LedgerSubstrate from "./substrate";
import { ledgerAppNames } from "../configs";
import { NetworkNames } from "../../types/enkrypt-types";

/**
 * Connects to a Ledger device and opens the appropriate app for the network
 * @param this - The LedgerEthereum or LedgerSubstrate instance with transport
 * @param networkName - The network name to connect to
 * @returns Promise resolving to true when connection is successful
 * @throws {Error} When device connection fails or required app is not installed/opened
 * @example
 * ```typescript
 * const connected = await connect.call(ledgerInstance, NetworkNames.Ethereum);
 * ```
 */
function connect(
  this: LedgerEthereum | LedgerSubstrate,
  networkName: string,
): Promise<boolean> {
  const appName = ledgerAppNames[networkName]
    ? ledgerAppNames[networkName]
    : ledgerAppNames[NetworkNames.Ethereum];
  // @ts-expect-error - Ledger Live Common types issue
  return getDeviceInfo(this.transport)
    .then(() =>
      // @ts-expect-error - Ledger Live Common types issue
      openApp(this.transport, appName)
        .then(() => true)
        .catch(() => {
          throw new Error(
            `Make sure you have ${appName} App installed on your ledger`,
          );
        }),
    )
    .catch((e: unknown) => {
      if (e instanceof Error && e.message === "DeviceOnDashboardExpected") {
        // @ts-expect-error - Ledger Live Common types issue
        return getAppAndVersion(this.transport).then((appInfo: unknown) => {
          if ((appInfo as { name?: string }).name !== appName)
            throw new Error(`Make sure you have ${appName} App opened`);
          return true;
        });
      }
      throw e;
    });
}

/**
 * Ledger device connection utility
 */
export default connect;
