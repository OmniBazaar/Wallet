declare namespace OmniCoinWidgets {
  interface Connect {
    mount: (options: {
      container?: HTMLElement;
      configuration?: string;
      configurationId?: string;
      accept?: string[];
      reject?: string[];
      onConnect?: (wallet: { address: string; provider: unknown; chainId: number }) => void;
      onDisconnect?: () => void;
      onError?: (error: Error) => void;
    }) => void;
    unmount: () => void;
  }

  interface Login {
    mount: (options: {
      container?: HTMLElement;
      configuration?: string;
      configurationId?: string;
      onLogin?: (wallet: { address: string; provider: unknown; chainId: number }) => void;
      onError?: (error: Error) => void;
    }) => void;
    unmount: () => void;
  }

  interface Payment {
    mount: (options: {
      container?: HTMLElement;
      configuration?: string;
      configurationId?: string;
      onSuccess?: (transaction: { hash: string; blockNumber?: number; status: string }) => void;
      onError?: (error: Error) => void;
    }) => void;
    unmount: () => void;
  }

  interface Sale {
    mount: (options: {
      container?: HTMLElement;
      configuration?: string;
      configurationId?: string;
      onSuccess?: (transaction: { hash: string; blockNumber?: number; status: string }) => void;
      onError?: (error: Error) => void;
    }) => void;
    unmount: () => void;
  }

  interface Select {
    mount: (options: {
      container?: HTMLElement;
      configuration?: string;
      configurationId?: string;
      onSelect?: (selection: { value: unknown; label: string }) => void;
      onError?: (error: Error) => void;
    }) => void;
    unmount: () => void;
  }

  interface Loading {
    mount: (options: {
      container?: HTMLElement;
      message?: string;
    }) => void;
    unmount: () => void;
  }
}

declare const OmniCoinWidgets: {
  Connect: OmniCoinWidgets.Connect;
  Login: OmniCoinWidgets.Login;
  Payment: OmniCoinWidgets.Payment;
  Sale: OmniCoinWidgets.Sale;
  Select: OmniCoinWidgets.Select;
  Loading: OmniCoinWidgets.Loading;
}

export default OmniCoinWidgets;
