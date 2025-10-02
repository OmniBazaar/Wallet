/**
 * Example usage of ValidatorDiscoveryService in Wallet extension components
 *
 * This demonstrates how popup, content scripts, and other extension
 * components interact with the background discovery service.
 */

/// <reference types="chrome"/>

/**
 * Example 1: Popup script getting validator status
 */
async function popupGetValidatorStatus(): Promise<void> {
  // Request validators from background service
  const response = await chrome.runtime.sendMessage({
    type: 'getValidators'
  });

  console.log('Available validators:', response.validators);
  console.log('Connected validators:', response.connected);
  console.log('Best validator:', response.best);

  // Display in popup UI
  const statusElement = document.getElementById('validator-status');
  if (statusElement && response.best) {
    statusElement.textContent = `Connected to ${response.best.region} (${response.best.latency}ms)`;
  }
}

/**
 * Example 2: Content script sending transaction via validator
 */
async function contentScriptSendTransaction(
  transaction: { to: string; value: string; data: string }
): Promise<void> {
  try {
    // Send transaction via background service
    const response = await chrome.runtime.sendMessage({
      type: 'sendToValidator',
      validatorId: 'auto', // Use best validator
      method: 'eth_sendTransaction',
      params: [transaction]
    });

    if (response.error) {
      throw new Error(response.error);
    }

    console.log('Transaction sent:', response.result);
  } catch (error) {
    console.error('Transaction failed:', error);
  }
}

/**
 * Example 3: Listening for validator connection changes
 */
function listenForValidatorChanges(): void {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'validator:connected') {
      console.log(`Connected to validator in ${message.region}`);
      // Update UI to show connection status
    } else if (message.type === 'validator:message') {
      console.log(`Message from validator ${message.validatorId}:`, message.message);
      // Handle real-time updates from validator
    }
  });
}

/**
 * Example 4: Wallet service using discovery for RPC calls
 */
class WalletService {
  async getBalance(address: string): Promise<string> {
    const response = await chrome.runtime.sendMessage({
      type: 'sendToValidator',
      validatorId: 'auto',
      method: 'eth_getBalance',
      params: [address, 'latest']
    });

    if (response.error) {
      throw new Error(response.error);
    }

    return response.result as string;
  }

  async getTransactionCount(address: string): Promise<number> {
    const response = await chrome.runtime.sendMessage({
      type: 'sendToValidator',
      validatorId: 'auto',
      method: 'eth_getTransactionCount',
      params: [address, 'latest']
    });

    if (response.error) {
      throw new Error(response.error);
    }

    return parseInt(response.result as string, 16);
  }

  async subscribeToNewBlocks(
    callback: (blockNumber: number) => void
  ): Promise<() => void> {
    // Subscribe via background service
    await chrome.runtime.sendMessage({
      type: 'sendToValidator',
      validatorId: 'auto',
      method: 'eth_subscribe',
      params: ['newHeads']
    });

    // Listen for updates
    const listener = (message: any) => {
      if (message.type === 'validator:message' &&
          message.message.method === 'eth_subscription') {
        const blockNumber = parseInt(message.message.params.result.number, 16);
        callback(blockNumber);
      }
    };

    chrome.runtime.onMessage.addListener(listener);

    // Return unsubscribe function
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }
}

/**
 * Example 5: Options page configuration
 */
async function optionsPageSetRegion(region: string): Promise<void> {
  // Save preferred region
  await chrome.storage.local.set({ clientRegion: region });

  // Trigger rediscovery
  await chrome.runtime.sendMessage({
    type: 'rediscoverValidators'
  });

  console.log(`Region preference set to ${region}`);
}

/**
 * Example 6: Service worker handling offline/online
 */
function setupOfflineHandling(): void {
  // Browser online/offline events
  self.addEventListener('online', () => {
    console.log('Browser back online, reconnecting to validators...');
    // Background service automatically reconnects
  });

  self.addEventListener('offline', () => {
    console.log('Browser offline, validator connections paused');
    // Background service queues messages
  });
}

/**
 * Example 7: Monitoring validator health in popup
 */
class ValidatorMonitor {
  private updateInterval?: number;

  start(): void {
    // Update every 5 seconds
    this.updateInterval = window.setInterval(async () => {
      const response = await chrome.runtime.sendMessage({
        type: 'getValidators'
      });

      this.updateUI(response.validators);
    }, 5000);
  }

  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }

  private updateUI(validators: any[]): void {
    const container = document.getElementById('validator-list');
    if (!container) return;

    container.innerHTML = validators
      .map(v => `
        <div class="validator ${v.healthy ? 'healthy' : 'unhealthy'}">
          <span class="region">${v.region}</span>
          <span class="latency">${v.latency || '---'}ms</span>
          <span class="status">${v.healthy ? '✓' : '✗'}</span>
        </div>
      `)
      .join('');
  }
}

// Export for use in extension components
export {
  popupGetValidatorStatus,
  contentScriptSendTransaction,
  listenForValidatorChanges,
  WalletService,
  optionsPageSetRegion,
  setupOfflineHandling,
  ValidatorMonitor
};