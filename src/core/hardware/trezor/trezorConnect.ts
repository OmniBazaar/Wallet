import type { TrezorConnect as TrezorConnectType } from "@trezor/connect-web";

/**
 * Get appropriate Trezor Connect instance based on environment
 * @returns Promise resolving to TrezorConnect instance
 */
const getTrezorConnect = async (): Promise<TrezorConnectType> => {
  // Check if running in Chrome extension environment
  const isExtension = typeof chrome !== 'undefined' && 
    chrome !== null && 
    typeof chrome === 'object' && 
    'runtime' in chrome &&
    chrome.runtime !== null &&
    typeof chrome.runtime === 'object' &&
    'getPlatformInfo' in chrome.runtime;

  if (isExtension) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const TrezorConnect = require("@trezor/connect-webextension") as {
      default: TrezorConnectType & {
        init(config: {
          manifest: { email: string; appUrl: string };
          transports: string[];
          connectSrc: string;
          _extendWebextensionLifetime: boolean;
        }): Promise<void>;
      };
    };
    
    await TrezorConnect.default.init({
      manifest: {
        email: "info@enkrypt.com",
        appUrl: "https://www.enkrypt.com",
      },
      transports: ["BridgeTransport", "WebUsbTransport"],
      connectSrc: "https://connect.trezor.io/9/",
      _extendWebextensionLifetime: true,
    });
    return TrezorConnect.default;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const TrezorConnect = require("@trezor/connect-web") as {
      default: {
        default: TrezorConnectType;
        init(config: {
          lazyLoad: boolean;
          manifest: { email: string; appUrl: string };
        }): Promise<void>;
      };
    };
    
    await TrezorConnect.default.init({
      lazyLoad: true,
      manifest: {
        email: "info@enkrypt.com",
        appUrl: "http://www.myetherwallet.com",
      },
    });
    return TrezorConnect.default.default;
  }
};

export default getTrezorConnect;