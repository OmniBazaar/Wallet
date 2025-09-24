/**
 * HardwareWalletService - Hardware Wallet Integration Service
 * 
 * Provides integration with hardware wallets like Ledger and Trezor,
 * supporting secure key management and transaction signing.
 */

/** Hardware wallet types */
export type HardwareWalletType = 'ledger' | 'trezor' | 'gridplus' | 'keepkey';

/** Hardware wallet connection status */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/** Hardware wallet device information */
export interface HardwareDevice {
  /** Device type */
  type: HardwareWalletType;
  /** Device model */
  model: string;
  /** Firmware version */
  firmwareVersion: string;
  /** Device serial number */
  serialNumber: string;
  /** Connection status */
  status: ConnectionStatus;
  /** Whether device is locked */
  isLocked: boolean;
  /** Supported features */
  features: string[];
}

/** Hardware account information */
export interface HardwareAccount {
  /** Account index */
  index: number;
  /** Derivation path */
  path: string;
  /** Public key */
  publicKey: string;
  /** Address */
  address: string;
  /** Balance (if available) */
  balance?: string;
  /** Account name */
  name: string;
}

/** Hardware wallet connection options */
export interface ConnectionOptions {
  /** Device type to connect */
  type: HardwareWalletType;
  /** Whether to automatically reconnect */
  autoReconnect?: boolean;
  /** Connection timeout in ms */
  timeout?: number;
  /** Whether to prompt for device approval */
  requireApproval?: boolean;
}

/** Hardware wallet events */
export interface HardwareWalletEvents {
  /** Device connected */
  deviceConnected: (device: HardwareDevice) => void;
  /** Device disconnected */
  deviceDisconnected: (device: HardwareDevice) => void;
  /** Connection error */
  connectionError: (error: Error) => void;
  /** Device locked/unlocked */
  deviceLockChanged: (isLocked: boolean) => void;
}

/**
 * Hardware wallet integration service
 */
export class HardwareWalletService {
  private isInitialized = false;
  private connectedDevices: Map<string, HardwareDevice> = new Map();
  private listeners: Partial<HardwareWalletEvents> = {};
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Creates a new HardwareWalletService instance
   */
  constructor() {}

  /**
   * Initialize the hardware wallet service
   * @throws {Error} When initialization fails
   */
  init(): void {
    try {
      if (this.isInitialized) {
        return;
      }

      // Check for hardware wallet support
      if (!this.isHardwareWalletSupported()) {
        console.warn('Hardware wallet support not available in this environment');
      }

      this.isInitialized = true;
      // console.log('HardwareWalletService initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to initialize hardware wallet service: ${errorMessage}`);
    }
  }

  /**
   * Check if hardware wallets are supported in current environment
   * @returns Support status
   */
  isHardwareWalletSupported(): boolean {
    // Check for WebUSB or WebHID support (browser)
    if (typeof navigator !== 'undefined') {
      const hasUsb = (navigator as { usb?: unknown }).usb !== undefined;
      const hasHid = (navigator as { hid?: unknown }).hid !== undefined;
      const hasWebUsb = (navigator as { webusb?: unknown }).webusb !== undefined;
      return hasUsb || hasHid || hasWebUsb;
    }
    
    // Check for Node.js environment with USB support
    if (typeof process !== 'undefined' && process.versions?.node !== undefined) {
      try {
        // In a real implementation, would check for node-hid or similar
        return true; // Assume USB support available in Node.js
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Get list of supported hardware wallet types
   * @returns Array of supported wallet types
   */
  getSupportedWalletTypes(): HardwareWalletType[] {
    return ['ledger', 'trezor', 'gridplus', 'keepkey'];
  }

  /**
   * Discover available hardware wallet devices
   * @returns Array of discovered devices
   */
  discoverDevices(): HardwareDevice[] {
    if (!this.isInitialized) {
      throw new Error('Hardware wallet service not initialized');
    }

    try {
      const devices: HardwareDevice[] = [];

      // Mock device discovery - in production would use actual hardware wallet libraries
      if (this.isHardwareWalletSupported()) {
        // Simulate finding devices
        const mockDevice: HardwareDevice = {
          type: 'ledger',
          model: 'Nano X',
          firmwareVersion: '2.1.0',
          serialNumber: 'mock-serial-123',
          status: 'disconnected',
          isLocked: true,
          features: ['bitcoin', 'ethereum', 'signing']
        };
        devices.push(mockDevice);
      }

      // console.log(`Discovered ${devices.length} hardware wallet devices`);
      return devices;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Device discovery failed: ${errorMessage}`);
    }
  }

  /**
   * Detect available hardware wallet devices (alias for discoverDevices)
   * @returns Array of detected devices with id and label fields
   */
  detectDevices(): Array<{ type: string; id: string; label: string }> {
    const devices = this.discoverDevices();
    
    // Map to expected format for tests
    return devices.map(device => ({
      type: device.type,
      id: (device.serialNumber !== null && device.serialNumber !== undefined && device.serialNumber.length > 0) ? device.serialNumber : `${device.type}-${Date.now()}`,
      label: `${device.model} (${device.type})`
    }));
  }

  /**
   * Connect to a hardware wallet device
   * @param options - Connection options
   * @returns Connected device information
   * @throws {Error} When connection fails
   */
  async connect(options: ConnectionOptions): Promise<HardwareDevice> {
    if (!this.isInitialized) {
      throw new Error('Hardware wallet service not initialized');
    }

    try {
      // Mock connection - in production would use actual hardware wallet SDK
      const device: HardwareDevice = {
        type: options.type,
        model: this.getModelForType(options.type),
        firmwareVersion: '2.1.0',
        serialNumber: `mock-${options.type}-${Date.now()}`,
        status: 'connecting',
        isLocked: false,
        features: ['bitcoin', 'ethereum', 'signing']
      };

      // Simulate connection process
      await this.delay(1000);

      device.status = 'connected';
      this.connectedDevices.set(device.serialNumber, device);

      this.listeners.deviceConnected?.(device);
      // console.log(`Connected to ${device.type} device: ${device.model}`);
      
      return device;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.listeners.connectionError?.(new Error(`Connection failed: ${errorMessage}`));
      throw new Error(`Failed to connect to hardware wallet: ${errorMessage}`);
    }
  }

  /**
   * Disconnect from a hardware wallet device
   * @param deviceId - Device serial number or ID
   * @returns Success status
   */
  disconnect(deviceId: string): boolean {
    const device = this.connectedDevices.get(deviceId);
    if (device === null || device === undefined) {
      return false;
    }

    try {
      device.status = 'disconnected';
      this.connectedDevices.delete(deviceId);

      // Clear reconnect timer if exists
      const timer = this.reconnectTimers.get(deviceId);
      if (timer !== null && timer !== undefined) {
        clearTimeout(timer);
        this.reconnectTimers.delete(deviceId);
      }

      this.listeners.deviceDisconnected?.(device);
      // console.log(`Disconnected from ${device.type} device`);
      
      return true;
    } catch (error) {
      console.error('Error disconnecting device:', error);
      return false;
    }
  }

  /**
   * Get connected devices
   * @returns Array of connected devices
   */
  getConnectedDevices(): HardwareDevice[] {
    return Array.from(this.connectedDevices.values());
  }

  /**
   * Get device by ID
   * @param deviceId - Device serial number or ID
   * @returns Device information or null
   */
  getDevice(deviceId: string): HardwareDevice | null {
    return this.connectedDevices.get(deviceId) ?? null;
  }

  /**
   * Get accounts from hardware wallet
   * @param deviceId - Device ID
   * @param startIndex - Starting account index
   * @param count - Number of accounts to retrieve
   * @returns Array of hardware accounts
   */
  getAccounts(
    deviceId: string,
    startIndex: number = 0,
    count: number = 5
  ): HardwareAccount[] {
    const device = this.connectedDevices.get(deviceId);
    if (device === null || device === undefined || device.status !== 'connected') {
      throw new Error('Device not connected');
    }

    try {
      const accounts: HardwareAccount[] = [];

      // Mock account generation - in production would derive from hardware wallet
      for (let i = startIndex; i < startIndex + count; i++) {
        const path = `m/44'/60'/${i}'/0/0`; // Ethereum derivation path
        // Mock address and public key generation
        const mockAddress = '0x' + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
        const mockPublicKey = '0x' + Array(130).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');

        accounts.push({
          index: i,
          path,
          publicKey: mockPublicKey,
          address: mockAddress,
          name: `${device.model} Account ${i + 1}`
        });
      }

      // console.log(`Retrieved ${accounts.length} accounts from ${device.type} device`);
      return accounts;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get accounts: ${errorMessage}`);
    }
  }

  /**
   * Sign message with hardware wallet
   * @param deviceId - Device ID
   * @param _accountPath - Account derivation path (unused in mock)
   * @param _message - Message to sign (unused in mock)
   * @returns Signature
   * @throws {Error} When signing fails
   */
  async signMessage(
    deviceId: string,
    _accountPath: string,
    _message: string
  ): Promise<string> {
    const device = this.connectedDevices.get(deviceId);
    if (device === null || device === undefined || device.status !== 'connected') {
      throw new Error('Device not connected');
    }

    try {
      // Mock signing - in production would use hardware wallet SDK
      
      // Simulate user approval time
      await this.delay(2000);

      // Mock signature
      const signature = `0x${Array(130).fill(0).map(() => 
        Math.floor(Math.random() * 16).toString(16)
      ).join('')}`;

      // console.log('Message signed successfully');
      return signature;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Message signing failed: ${errorMessage}`);
    }
  }

  /**
   * Sign transaction with hardware wallet
   * @param deviceId - Device ID
   * @param _accountPath - Account derivation path (unused in mock)
   * @param _transaction - Transaction to sign (unused in mock)
   * @returns Signed transaction
   * @throws {Error} When signing fails
   */
  async signTransaction(
    deviceId: string,
    _accountPath: string,
    _transaction: unknown
  ): Promise<string> {
    const device = this.connectedDevices.get(deviceId);
    if (device === null || device === undefined || device.status !== 'connected') {
      throw new Error('Device not connected');
    }

    try {
      // Mock transaction signing - in production would use hardware wallet SDK
      
      // Simulate user approval time
      await this.delay(3000);

      // Mock signed transaction
      const signedTx = `0x${Array(200).fill(0).map(() => 
        Math.floor(Math.random() * 16).toString(16)
      ).join('')}`;

      // console.log('Transaction signed successfully');
      return signedTx;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Transaction signing failed: ${errorMessage}`);
    }
  }

  /**
   * Check if device supports a specific feature
   * @param deviceId - Device ID
   * @param feature - Feature to check
   * @returns Support status
   */
  supportsFeature(deviceId: string, feature: string): boolean {
    const device = this.connectedDevices.get(deviceId);
    return (device !== null && device !== undefined) ? device.features.includes(feature) : false;
  }

  /**
   * Register event listener
   * @param event - Event name
   * @param callback - Event callback
   */
  on<K extends keyof HardwareWalletEvents>(event: K, callback: HardwareWalletEvents[K]): void {
    this.listeners[event] = callback;
  }

  /**
   * Remove event listener
   * @param event - Event name
   */
  off<K extends keyof HardwareWalletEvents>(event: K): void {
    delete this.listeners[event];
  }

  /**
   * Get model name for wallet type
   * @param type Hardware wallet type
   * @returns Model name for the wallet type
   * @private
   */
  private getModelForType(type: HardwareWalletType): string {
    const models = {
      ledger: 'Nano X',
      trezor: 'Model T',
      gridplus: 'Lattice1',
      keepkey: 'KeepKey'
    };
    return models[type];
  }

  /**
   * Utility delay function
   * @param ms Milliseconds to delay
   * @returns Promise that resolves after the delay
   * @private
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear cache and reset data
   */
  async clearCache(): Promise<void> {
    // Clear any cached device data
    // console.log('HardwareWalletService cache cleared');
  }

  /**
   * Cleanup service and release resources
   */
  cleanup(): void {
    try {
      // Disconnect all devices
      const deviceIds = Array.from(this.connectedDevices.keys());
      for (const deviceId of deviceIds) {
        this.disconnect(deviceId);
      }

      // Clear timers
      this.reconnectTimers.forEach(timer => {
        clearTimeout(timer);
      });
      this.reconnectTimers.clear();

      // Clear listeners
      this.listeners = {};

      this.isInitialized = false;
      // console.log('HardwareWalletService cleanup completed');
    } catch (error) {
      console.error('Error during HardwareWalletService cleanup:', error);
    }
  }

  /**
   * Connect to a Ledger device specifically
   * @returns Ledger connection result
   */
  async connectLedger(): Promise<{ connected: boolean; deviceId?: string; appVersion?: string; accounts?: unknown[]; error?: string }> {
    try {
      const device = await this.connect({ 
        type: 'ledger'
      });
      
      // In test environment, return mock data
      if (process.env['NODE_ENV'] === 'test') {
        return {
          connected: true,
          deviceId: device.serialNumber,
          appVersion: '2.1.0',
          accounts: []
        };
      }
      
      return {
        connected: true,
        deviceId: device.serialNumber,
        appVersion: '2.1.0', // Mock version for now
        accounts: []
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Failed to connect to Ledger'
      };
    }
  }

  /**
   * Derive multiple accounts from a hardware wallet
   * @param _device - Hardware device (unused in mock)
   * @param options - Derivation options
   * @param options.start Starting index for derivation
   * @param options.count Number of accounts to derive
   * @param options.derivationPath Base derivation path
   * @returns Array of derived accounts
   */
  deriveAccounts(
    _device: HardwareDevice, 
    options: { start: number; count: number; derivationPath: string }
  ): Array<{ address: string; path: string; index: number }> {
    const accounts: Array<{ address: string; path: string; index: number }> = [];
    
    for (let i = 0; i < options.count; i++) {
      const index = options.start + i;
      const path = `${options.derivationPath}/${index}`;
      
      // Mock address derivation - in production would use hardware wallet SDK
      const mockAddress = '0x' + (index + 1).toString(16).padStart(40, '0');
      
      accounts.push({
        address: mockAddress,
        path,
        index
      });
    }
    
    return accounts;
  }
}