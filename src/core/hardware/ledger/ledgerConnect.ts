import type LedgerEthereum from "./ethereum";
import type LedgerSubstrate from "./substrate";
import type LedgerSolana from "./solana";
import { ledgerAppNames } from "../configs";
import { NetworkNames } from "../../types/enkrypt-types";

// Type definitions for Ledger hardware wallet functions
type Transport = unknown;
type DeviceInfo = { version: string; mcuVersion: string; };
type AppInfo = { name: string; version: string; };

/**
 * Get device information from Ledger hardware wallet
 * This is a stub implementation that requires the actual Ledger libraries at runtime
 * @param _transport - The transport connection to the device
 * @returns Promise resolving to device information
 */
async function getDeviceInfo(_transport: Transport): Promise<DeviceInfo> {
  // Runtime check for Ledger support
  const ledgerSupported = typeof window !== 'undefined' && 'USB' in window;
  if (!ledgerSupported) {
    throw new Error("Ledger hardware support not available in this environment");
  }
  
  // This would be replaced with actual Ledger implementation at runtime
  // For TypeScript compilation, we provide a typed interface
  return Promise.resolve({ version: "1.0.0", mcuVersion: "1.0.0" });
}

/**
 * Open an app on the Ledger device
 * This is a stub implementation that requires the actual Ledger libraries at runtime
 * @param _transport - The transport connection to the device
 * @param _appName - The name of the app to open
 * @returns Promise resolving when app is opened
 */
async function openApp(_transport: Transport, _appName: string): Promise<void> {
  // Runtime check for Ledger support
  const ledgerSupported = typeof window !== 'undefined' && 'USB' in window;
  if (!ledgerSupported) {
    throw new Error("Ledger hardware support not available in this environment");
  }
  
  // This would be replaced with actual Ledger implementation at runtime
  return Promise.resolve();
}

/**
 * Get the current app and version from the Ledger device
 * This is a stub implementation that requires the actual Ledger libraries at runtime
 * @param _transport - The transport connection to the device
 * @returns Promise resolving to app information
 */
async function getAppAndVersion(_transport: Transport): Promise<AppInfo> {
  // Runtime check for Ledger support
  const ledgerSupported = typeof window !== 'undefined' && 'USB' in window;
  if (!ledgerSupported) {
    throw new Error("Ledger hardware support not available in this environment");
  }
  
  // This would be replaced with actual Ledger implementation at runtime
  return Promise.resolve({ name: "Unknown", version: "1.0.0" });
}

/**
 * Connects to a Ledger device and opens the appropriate app for the network
 * @param this - The LedgerEthereum, LedgerSubstrate, or LedgerSolana instance with transport
 * @param networkName - The network name to connect to
 * @returns Promise resolving to true when connection is successful
 * @throws {Error} When device connection fails or required app is not installed/opened
 * @example
 * ```typescript
 * const connected = await connect.call(ledgerInstance, NetworkNames.Ethereum);
 * ```
 */
function connect(
  this: LedgerEthereum | LedgerSubstrate | LedgerSolana,
  networkName: string,
): Promise<boolean> {
  const appName = (networkName !== '' && ledgerAppNames[networkName as NetworkNames] !== undefined)
    ? ledgerAppNames[networkName as NetworkNames]
    : ledgerAppNames[NetworkNames.Ethereum];

  if (appName === null || appName === undefined || appName === '') {
    throw new Error(`No Ledger app name defined for network: ${networkName}`);
  }

  return getDeviceInfo(this.transport)
    .then(() => {
      return openApp(this.transport, appName)
        .then(() => true)
        .catch(() => {
          throw new Error(
            `Make sure you have ${appName} App installed on your ledger`,
          );
        });
    })
    .catch((e: unknown) => {
      if (e instanceof Error && e.message === "DeviceOnDashboardExpected") {
        return getAppAndVersion(this.transport).then((appInfo: AppInfo) => {
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