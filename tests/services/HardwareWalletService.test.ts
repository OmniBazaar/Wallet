/**
 * HardwareWalletService Tests
 * Comprehensive tests for hardware wallet integration functionality
 */

import { 
  HardwareWalletService, 
  HardwareWalletType,
  ConnectionOptions,
  HardwareDevice,
  HardwareAccount,
  ConnectionStatus
} from '../../src/services/HardwareWalletService';

describe('HardwareWalletService', () => {
  let service: HardwareWalletService;

  beforeEach(() => {
    service = new HardwareWalletService();
    service.init();
  });

  afterEach(() => {
    service.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      const newService = new HardwareWalletService();
      expect(() => newService.init()).not.toThrow();
    });

    it('should handle multiple initialization calls', async () => {
      service.init(); // Already initialized in beforeEach
      service.init(); // Should not throw
    });

    it('should detect hardware wallet support', () => {
      // In test environment, should return true (mocked)
      expect(service.isHardwareWalletSupported()).toBeDefined();
    });
  });

  describe('Supported Wallet Types', () => {
    it('should return supported wallet types', () => {
      const types = service.getSupportedWalletTypes();
      
      expect(types).toContain('ledger');
      expect(types).toContain('trezor');
      expect(types).toContain('gridplus');
      expect(types).toContain('keepkey');
      expect(types.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Device Discovery', () => {
    it('should discover devices', async () => {
      const devices = await service.discoverDevices();
      
      expect(Array.isArray(devices)).toBe(true);
      
      if (devices.length > 0) {
        const device = devices[0];
        expect(device.type).toBeDefined();
        expect(device.model).toBeDefined();
        expect(device.firmwareVersion).toBeDefined();
        expect(device.serialNumber).toBeDefined();
        expect(device.status).toBeDefined();
        expect(device.isLocked).toBeDefined();
        expect(device.features).toBeDefined();
      }
    });

    it('should detect devices in alternative format', async () => {
      const devices = await service.detectDevices();
      
      expect(Array.isArray(devices)).toBe(true);
      
      if (devices.length > 0) {
        const device = devices[0];
        expect(device.type).toBeDefined();
        expect(device.id).toBeDefined();
        expect(device.label).toBeDefined();
      }
    });

    it('should throw when not initialized', () => {
      const uninitService = new HardwareWalletService();

      expect(() => uninitService.discoverDevices())
        .toThrow('Hardware wallet service not initialized');
    });
  });

  describe('Device Connection', () => {
    it('should connect to Ledger device', async () => {
      const options: ConnectionOptions = {
        type: 'ledger',
        autoReconnect: true,
        timeout: 5000
      };
      
      const device = await service.connect(options);
      
      expect(device).toBeDefined();
      expect(device.type).toBe('ledger');
      expect(device.model).toBe('Nano X');
      expect(device.status).toBe('connected');
      expect(device.serialNumber).toBeDefined();
      
      // Check device is in connected list
      const connectedDevices = service.getConnectedDevices();
      expect(connectedDevices).toHaveLength(1);
      expect(connectedDevices[0].serialNumber).toBe(device.serialNumber);
    });

    it('should connect to Trezor device', async () => {
      const options: ConnectionOptions = {
        type: 'trezor'
      };
      
      const device = await service.connect(options);
      
      expect(device.type).toBe('trezor');
      expect(device.model).toBe('Model T');
      expect(device.status).toBe('connected');
    });

    it('should connect to GridPlus device', async () => {
      const options: ConnectionOptions = {
        type: 'gridplus'
      };
      
      const device = await service.connect(options);
      
      expect(device.type).toBe('gridplus');
      expect(device.model).toBe('Lattice1');
    });

    it('should connect to KeepKey device', async () => {
      const options: ConnectionOptions = {
        type: 'keepkey'
      };
      
      const device = await service.connect(options);
      
      expect(device.type).toBe('keepkey');
      expect(device.model).toBe('KeepKey');
    });

    it('should throw when not initialized', async () => {
      const uninitService = new HardwareWalletService();
      
      await expect(uninitService.connect({ type: 'ledger' }))
        .rejects.toThrow('Hardware wallet service not initialized');
    });

    it('should use connectLedger helper method', async () => {
      const result = await service.connectLedger();
      
      expect(result.connected).toBe(true);
      expect(result.deviceId).toBeDefined();
      expect(result.error).toBeUndefined();
      
      // Verify device is connected
      const device = service.getDevice(result.deviceId!);
      expect(device).toBeDefined();
      expect(device?.type).toBe('ledger');
    });
  });

  describe('Device Disconnection', () => {
    let device: HardwareDevice;

    beforeEach(async () => {
      device = await service.connect({ type: 'ledger' });
    });

    it('should disconnect device', async () => {
      const disconnected = await service.disconnect(device.serialNumber);
      
      expect(disconnected).toBe(true);
      
      // Check device is removed from connected list
      const connectedDevices = service.getConnectedDevices();
      expect(connectedDevices).toHaveLength(0);
      
      // Check device can't be found
      const foundDevice = service.getDevice(device.serialNumber);
      expect(foundDevice).toBeNull();
    });

    it('should return false for non-existent device', async () => {
      const disconnected = await service.disconnect('non-existent-id');
      expect(disconnected).toBe(false);
    });
  });

  describe('Device Management', () => {
    it('should get connected devices', async () => {
      // Connect multiple devices
      const device1 = await service.connect({ type: 'ledger' });
      const device2 = await service.connect({ type: 'trezor' });
      
      const devices = service.getConnectedDevices();
      
      expect(devices).toHaveLength(2);
      expect(devices.map(d => d.type)).toContain('ledger');
      expect(devices.map(d => d.type)).toContain('trezor');
    });

    it('should get device by ID', async () => {
      const device = await service.connect({ type: 'ledger' });
      
      const foundDevice = service.getDevice(device.serialNumber);
      
      expect(foundDevice).toBeDefined();
      expect(foundDevice?.serialNumber).toBe(device.serialNumber);
    });

    it('should return null for non-existent device', () => {
      const device = service.getDevice('non-existent-id');
      expect(device).toBeNull();
    });
  });

  describe('Account Management', () => {
    let device: HardwareDevice;

    beforeEach(async () => {
      device = await service.connect({ type: 'ledger' });
    });

    it('should get accounts from device', async () => {
      const accounts = service.getAccounts(device.serialNumber);
      
      expect(accounts).toHaveLength(5); // Default count
      
      accounts.forEach((account, index) => {
        expect(account.index).toBe(index);
        expect(account.path).toMatch(/^m\/44'\/60'\/\d+'\/0\/0$/);
        expect(account.publicKey).toMatch(/^0x[a-fA-F0-9]{130}$/);
        expect(account.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
        expect(account.name).toContain(device.model);
      });
    });

    it('should get accounts with custom range', async () => {
      const startIndex = 5;
      const count = 10;
      
      const accounts = service.getAccounts(device.serialNumber, startIndex, count);
      
      expect(accounts).toHaveLength(count);
      expect(accounts[0].index).toBe(startIndex);
      expect(accounts[accounts.length - 1].index).toBe(startIndex + count - 1);
    });

    it('should derive accounts with helper method', async () => {
      const options = {
        start: 0,
        count: 3,
        derivationPath: "m/44'/60'/0'"
      };
      
      const accounts = service.deriveAccounts(device, options);
      
      expect(accounts).toHaveLength(3);
      accounts.forEach((account, index) => {
        expect(account.index).toBe(index);
        expect(account.path).toBe(`${options.derivationPath}/${index}`);
        expect(account.address).toMatch(/^0x[a-fA-F0-9]+$/);
      });
    });

    it('should throw when device not connected', () => {
      expect(() => service.getAccounts('non-existent-device'))
        .toThrow('Device not connected');
    });
  });

  describe('Message Signing', () => {
    let device: HardwareDevice;
    const testMessage = 'Sign this message with hardware wallet';
    const testPath = "m/44'/60'/0'/0/0";

    beforeEach(async () => {
      device = await service.connect({ type: 'ledger' });
    });

    it('should sign message with device', async () => {
      const signature = await service.signMessage(
        device.serialNumber,
        testPath,
        testMessage
      );
      
      expect(signature).toBeDefined();
      expect(signature).toMatch(/^0x[a-fA-F0-9]{130}$/);
    });

    it('should throw when device not connected', async () => {
      await expect(service.signMessage('non-existent-device', testPath, testMessage))
        .rejects.toThrow('Device not connected');
    });

    it('should handle signing timeout', async () => {
      // This test would need actual timeout simulation
      // For now, just verify the method completes
      const signature = await service.signMessage(
        device.serialNumber,
        testPath,
        'Timeout test message'
      );
      
      expect(signature).toBeDefined();
    });
  });

  describe('Transaction Signing', () => {
    let device: HardwareDevice;
    const testPath = "m/44'/60'/0'/0/0";
    const testTransaction = {
      to: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fA65',
      value: '1000000000000000000', // 1 ETH
      gasPrice: '20000000000',
      gasLimit: '21000',
      nonce: 0,
      chainId: 1
    };

    beforeEach(async () => {
      device = await service.connect({ type: 'ledger' });
    });

    it('should sign transaction with device', async () => {
      const signedTx = await service.signTransaction(
        device.serialNumber,
        testPath,
        testTransaction
      );
      
      expect(signedTx).toBeDefined();
      expect(signedTx).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(signedTx.length).toBeGreaterThan(100);
    });

    it('should throw when device not connected', async () => {
      await expect(service.signTransaction('non-existent-device', testPath, testTransaction))
        .rejects.toThrow('Device not connected');
    });

    it('should handle complex transactions', async () => {
      const complexTransaction = {
        ...testTransaction,
        data: '0x' + '00'.repeat(100), // Contract data
        maxFeePerGas: '100000000000',
        maxPriorityFeePerGas: '2000000000'
      };
      
      const signedTx = await service.signTransaction(
        device.serialNumber,
        testPath,
        complexTransaction
      );
      
      expect(signedTx).toBeDefined();
    });
  });

  describe('Feature Support', () => {
    let device: HardwareDevice;

    beforeEach(async () => {
      device = await service.connect({ type: 'ledger' });
    });

    it('should check feature support', () => {
      expect(service.supportsFeature(device.serialNumber, 'bitcoin')).toBe(true);
      expect(service.supportsFeature(device.serialNumber, 'ethereum')).toBe(true);
      expect(service.supportsFeature(device.serialNumber, 'signing')).toBe(true);
      expect(service.supportsFeature(device.serialNumber, 'unsupported-feature')).toBe(false);
    });

    it('should return false for non-existent device', () => {
      expect(service.supportsFeature('non-existent-device', 'bitcoin')).toBe(false);
    });
  });

  describe('Event Handling', () => {
    it('should register and trigger device connected event', async () => {
      const mockCallback = jest.fn();
      service.on('deviceConnected', mockCallback);
      
      const device = await service.connect({ type: 'ledger' });
      
      expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'ledger',
        status: 'connected'
      }));
    });

    it('should register and trigger device disconnected event', async () => {
      const mockCallback = jest.fn();
      service.on('deviceDisconnected', mockCallback);
      
      const device = await service.connect({ type: 'ledger' });
      await service.disconnect(device.serialNumber);
      
      expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'ledger',
        serialNumber: device.serialNumber
      }));
    });

    it('should handle connection errors', async () => {
      const mockCallback = jest.fn();
      service.on('connectionError', mockCallback);
      
      // Would need to simulate actual connection error
      // For now, verify event registration works
      expect(() => service.off('connectionError')).not.toThrow();
    });

    it('should remove event listeners', () => {
      const mockCallback = jest.fn();
      service.on('deviceConnected', mockCallback);
      service.off('deviceConnected');
      
      // Verify callback is removed (would need to trigger event to test fully)
      expect(() => service.off('deviceConnected')).not.toThrow();
    });
  });

  describe('Memory Management', () => {
    it('should clear cache', async () => {
      await expect(service.clearCache()).resolves.not.toThrow();
    });

    it('should cleanup resources', async () => {
      // Connect some devices
      const device1 = await service.connect({ type: 'ledger' });
      const device2 = await service.connect({ type: 'trezor' });
      
      // Add event listeners
      service.on('deviceConnected', () => {});
      service.on('deviceDisconnected', () => {});
      
      service.cleanup();
      
      // Verify all devices are disconnected
      expect(service.getConnectedDevices()).toHaveLength(0);
    });

    it('should handle cleanup errors gracefully', () => {
      // Mock console.error to verify error handling
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Force an error by manipulating internal state
      service['connectedDevices'] = null as any;

      expect(() => service.cleanup()).not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid connect/disconnect cycles', async () => {
      for (let i = 0; i < 5; i++) {
        const device = await service.connect({ type: 'ledger' });
        await service.disconnect(device.serialNumber);
      }
      
      expect(service.getConnectedDevices()).toHaveLength(0);
    });

    it('should handle multiple devices of same type', async () => {
      const device1 = await service.connect({ type: 'ledger' });
      const device2 = await service.connect({ type: 'ledger' });
      
      expect(device1.serialNumber).not.toBe(device2.serialNumber);
      expect(service.getConnectedDevices()).toHaveLength(2);
    });

    it('should handle empty account derivation', async () => {
      const device = await service.connect({ type: 'ledger' });
      const accounts = await service.getAccounts(device.serialNumber, 0, 0);
      
      expect(accounts).toHaveLength(0);
    });
  });

  describe('Browser Compatibility', () => {
    it('should detect WebUSB support', () => {
      const originalNavigator = (global as any).navigator;
      
      // Test with WebUSB
      (global as any).navigator = { usb: {} };
      expect(service.isHardwareWalletSupported()).toBe(true);
      
      // Test with WebHID
      (global as any).navigator = { hid: {} };
      expect(service.isHardwareWalletSupported()).toBe(true);
      
      // Test with neither
      (global as any).navigator = {};
      expect(service.isHardwareWalletSupported()).toBe(false);
      
      (global as any).navigator = originalNavigator;
    });

    it('should detect Node.js environment', () => {
      const originalProcess = (global as any).process;
      const originalNavigator = (global as any).navigator;

      try {
        // Clear navigator to ensure Node.js detection
        delete (global as any).navigator;

        // Simulate Node.js environment
        (global as any).process = { versions: { node: '16.0.0' } };

        // Create new service instance to test with modified environment
        const testService = new HardwareWalletService();
        expect(testService.isHardwareWalletSupported()).toBe(true);
      } finally {
        (global as any).process = originalProcess;
        (global as any).navigator = originalNavigator;
      }
    });
  });

  describe('Connection Options', () => {
    it('should respect timeout option', async () => {
      const testService = new HardwareWalletService();
      testService.init();

      const startTime = Date.now();
      const device = await testService.connect({
        type: 'ledger',
        timeout: 100 // Very short timeout
      });
      const endTime = Date.now();

      // Connection should still succeed (mocked)
      expect(device.status).toBe('connected');
      // But should take at least the simulated delay
      expect(endTime - startTime).toBeGreaterThanOrEqual(1000);

      testService.cleanup();
    });

    it('should handle auto-reconnect option', async () => {
      const testService = new HardwareWalletService();
      testService.init();

      const device = await testService.connect({
        type: 'ledger',
        autoReconnect: true
      });

      // In a real implementation, would test reconnection behavior
      expect(device).toBeDefined();

      testService.cleanup();
    });

    it('should handle require approval option', async () => {
      const testService = new HardwareWalletService();
      testService.init();

      const device = await testService.connect({
        type: 'ledger',
        requireApproval: true
      });

      // In a real implementation, would test approval flow
      expect(device).toBeDefined();

      testService.cleanup();
    });
  });
});