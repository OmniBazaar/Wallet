// Loosen types to avoid external type dependency noise
import getDeviceInfo from "@ledgerhq/live-common/lib/hw/getDeviceInfo";
import openApp from "@ledgerhq/live-common/lib/hw/openApp";
import getAppAndVersion from "@ledgerhq/live-common/lib/hw/getAppAndVersion";
import type LedgerEthereum from "./ethereum";
import type LedgerSubstrate from "./substrate";
import { ledgerAppNames } from "../configs";

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
  networkName: any,
): Promise<boolean> {
  const appName = ledgerAppNames[networkName]
    ? ledgerAppNames[networkName]
    : ledgerAppNames[NetworkNames.Ethereum];
  return getDeviceInfo(this.transport)
    .then(() =>
      openApp(this.transport, appName)
        .then(() => true)
        .catch(() => {
          throw new Error(
            `Make sure you have ${appName} App installed on your ledger`,
          );
        }),
    )
    .catch((e) => {
      if (e.message === "DeviceOnDashboardExpected") {
        return getAppAndVersion(this.transport).then((appInfo) => {
          if (appInfo.name !== appName)
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
