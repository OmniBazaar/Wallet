import type { TrezorConnect as TrezorConnectType } from "@trezor/connect-web";

/**
 * Get appropriate Trezor Connect instance based on environment
 * @returns Promise resolving to TrezorConnect instance
 */
const getTrezorConnect = async (): Promise<TrezorConnectType> => {
  // @ts-expect-error - Chrome runtime availability check
  if (typeof chrome !== 'undefined' && chrome?.runtime?.getPlatformInfo) {
    const TrezorConnect = await import("@trezor/connect-webextension");
    // @ts-expect-error - TrezorConnect type issue
    await TrezorConnect.default.init({
      manifest: {
        email: "info@enkrypt.com",
        appUrl: "https://www.enkrypt.com",
      },
      transports: ["BridgeTransport", "WebUsbTransport"],
      connectSrc: "https://connect.trezor.io/9/",
      _extendWebextensionLifetime: true,
    });
    return TrezorConnect.default as TrezorConnectType;
  } else {
    const TrezorConnect = (await import("@trezor/connect-web") as { default: { default: TrezorConnectType; init: (config: { lazyLoad: boolean; manifest: { email: string; appUrl: string } }) => Promise<void> } }).default;
    await TrezorConnect.default.init({
      lazyLoad: true,
      manifest: {
        email: "info@enkrypt.com",
        appUrl: "http://www.myetherwallet.com",
      },
    });
    return TrezorConnect.default;
  }
};

export default getTrezorConnect;
