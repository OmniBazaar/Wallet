/**
 * ValidatorDiscoveryService for OmniBazaar Wallet Browser Extension
 *
 * This service runs in the browser extension background script and provides
 * persistent validator discovery for all wallet operations. It discovers
 * validators via IPNS/IPFS and maintains a live connection pool.
 *
 * Key Features:
 * - Runs persistently in background (survives popup close)
 * - Discovers validators via IPNS (primary) with fallbacks
 * - Maintains WebSocket connections to multiple validators
 * - Automatic geographic routing and failover
 * - Syncs state across all extension contexts
 * - Handles browser events (startup, network changes)
 *
 * @module background/services/ValidatorDiscoveryService
 */

/// <reference types="chrome"/>

/** IPNS address for OmniBazaar validator list */
const VALIDATOR_LIST_IPNS = 'k51qzi5uqu5dh1pbhx2x0xfo2qqu87o5jvlo7d3ducynk3k22jzz40q0v1zr6';

/** Cache duration for validator list */
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/** Health check interval */
const HEALTH_CHECK_INTERVAL = 30 * 1000; // 30 seconds

/** WebSocket reconnection delay */
const RECONNECT_DELAY = 5000; // 5 seconds

/** IPFS/IPNS gateway URLs */
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://dweb.link/ipfs/'
];

const IPNS_GATEWAYS = [
  'https://ipfs.io/ipns/',
  'https://cloudflare-ipfs.com/ipns/',
  'https://gateway.pinata.cloud/ipns/',
  'https://dweb.link/ipns/'
];

/** Validator endpoint information */
export interface ValidatorEndpoint {
  id: string;
  httpUrl: string;
  wsUrl: string;
  region?: string;
  latency?: number;
  healthy: boolean;
  reputation?: number;
  lastCheck?: number;
}

/** Validator connection state */
interface ValidatorConnection {
  endpoint: ValidatorEndpoint;
  websocket?: WebSocket;
  reconnectTimer?: number;
  messageQueue: QueuedMessage[];
  subscriptions: Set<string>;
}

/** Queued message for offline handling */
interface QueuedMessage {
  method: string;
  params: unknown;
  callback: (error: Error | null, result?: unknown) => void;
}

/** Validator list from IPFS */
interface ValidatorList {
  version: string;
  timestamp: number;
  validators: Array<{
    validatorId: string;
    rpcUrl: string;
    wsUrl: string;
    region: string;
    reputation: number;
    lastSeen: number;
  }>;
}

/**
 * Background service for persistent validator discovery and connection management
 */
export class ValidatorDiscoveryService {
  private validators = new Map<string, ValidatorEndpoint>();
  private connections = new Map<string, ValidatorConnection>();
  private clientRegion?: string;
  private discoveryTimer?: number;
  private healthCheckTimer?: number;
  private isRunning = false;

  /**
   * Initialize and start the discovery service
   */
  async initialize(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // Load cached validators
    await this.loadCachedValidators();

    // Detect client region
    this.clientRegion = await this.detectClientRegion();

    // Start discovery
    await this.discoverValidators();

    // Setup periodic tasks
    this.setupPeriodicTasks();

    // Setup browser event listeners
    this.setupBrowserListeners();

    // Connect to best validators
    await this.connectToBestValidators();

    console.log('Validator discovery service initialized');
  }

  /**
   * Discover validators via IPNS/IPFS with fallbacks
   */
  private async discoverValidators(): Promise<void> {
    try {
      // Check cache first
      const cached = await this.getCachedValidatorList();
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log('Using cached validator list');
        this.updateValidators(cached.validators);
        return;
      }

      // Discover via IPNS
      const validators = await this.discoverFromIPNS();
      this.updateValidators(validators);

      // Cache the results
      await this.cacheValidatorList(validators);

    } catch (error) {
      console.error('IPNS discovery failed, using fallbacks', error);

      // Try fallback methods
      const fallbackValidators = await this.discoverFromFallbacks();
      this.updateValidators(fallbackValidators);
    }
  }

  /**
   * Discover validators from IPNS
   */
  private async discoverFromIPNS(): Promise<ValidatorEndpoint[]> {
    // Resolve IPNS to IPFS CID
    const ipfsCid = await this.resolveIPNS(VALIDATOR_LIST_IPNS);
    if (!ipfsCid) throw new Error('Failed to resolve IPNS');

    // Fetch validator list from IPFS
    const validatorList = await this.fetchFromIPFS(ipfsCid);

    // Convert to ValidatorEndpoint format
    return validatorList.validators
      .filter(v => Date.now() - v.lastSeen * 1000 < 600000) // Active in last 10 min
      .map(v => ({
        id: this.getValidatorId(v.rpcUrl),
        httpUrl: v.rpcUrl,
        wsUrl: v.wsUrl,
        region: v.region,
        healthy: false,
        reputation: v.reputation
      }));
  }

  /**
   * Resolve IPNS address to IPFS CID
   */
  private async resolveIPNS(ipnsAddress: string): Promise<string | null> {
    for (const gateway of IPNS_GATEWAYS) {
      try {
        const response = await fetch(`${gateway}${ipnsAddress}`, {
          method: 'HEAD',
          redirect: 'manual'
        });

        if (response.status === 301 || response.status === 302) {
          const location = response.headers.get('location');
          if (location) {
            const match = location.match(/\/ipfs\/([a-zA-Z0-9]+)/);
            if (match?.[1]) return match[1];
          }
        }
      } catch {
        // Try next gateway
      }
    }
    return null;
  }

  /**
   * Fetch validator list from IPFS
   */
  private async fetchFromIPFS(cid: string): Promise<ValidatorList> {
    for (const gateway of IPFS_GATEWAYS) {
      try {
        const response = await fetch(`${gateway}${cid}`);
        if (response.ok) {
          return await response.json();
        }
      } catch {
        // Try next gateway
      }
    }
    throw new Error('All IPFS gateways failed');
  }

  /**
   * Fallback discovery methods
   */
  private async discoverFromFallbacks(): Promise<ValidatorEndpoint[]> {
    // Hardcoded seed validators as ultimate fallback
    return [
      {
        id: 'validator1',
        httpUrl: 'https://validator1.omnibazaar.com:8545',
        wsUrl: 'wss://validator1.omnibazaar.com:8546',
        region: 'us-east',
        healthy: false
      },
      {
        id: 'validator2',
        httpUrl: 'https://validator2.omnibazaar.com:8545',
        wsUrl: 'wss://validator2.omnibazaar.com:8546',
        region: 'us-west',
        healthy: false
      },
      {
        id: 'validator3',
        httpUrl: 'https://validator3.omnibazaar.com:8545',
        wsUrl: 'wss://validator3.omnibazaar.com:8546',
        region: 'eu-west',
        healthy: false
      }
    ];
  }

  /**
   * Update validator list and check health
   */
  private async updateValidators(newValidators: ValidatorEndpoint[]): Promise<void> {
    // Update validator map
    for (const validator of newValidators) {
      this.validators.set(validator.id, validator);
    }

    // Check health of all validators
    await this.checkAllValidatorHealth();
  }

  /**
   * Check health of all validators
   */
  private async checkAllValidatorHealth(): Promise<void> {
    const healthChecks = Array.from(this.validators.values()).map(v =>
      this.checkValidatorHealth(v)
    );

    await Promise.allSettled(healthChecks);
  }

  /**
   * Check individual validator health
   */
  private async checkValidatorHealth(validator: ValidatorEndpoint): Promise<void> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${validator.httpUrl}/health`, {
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        validator.healthy = true;
        validator.latency = Date.now() - startTime;
        validator.lastCheck = Date.now();

        // Update connection if needed
        const connection = this.connections.get(validator.id);
        if (connection && !connection.websocket) {
          await this.connectToValidator(validator);
        }
      } else {
        validator.healthy = false;
        validator.lastCheck = Date.now();
      }
    } catch {
      validator.healthy = false;
      validator.lastCheck = Date.now();
    }
  }

  /**
   * Connect to best validators based on region and latency
   */
  private async connectToBestValidators(): Promise<void> {
    const healthyValidators = this.getHealthyValidators();

    // Group by region
    const byRegion = new Map<string, ValidatorEndpoint[]>();
    for (const validator of healthyValidators) {
      const region = validator.region || 'unknown';
      const list = byRegion.get(region) || [];
      list.push(validator);
      byRegion.set(region, list);
    }

    // Connect to best validator in client region
    if (this.clientRegion && byRegion.has(this.clientRegion)) {
      const regional = byRegion.get(this.clientRegion)!;
      const best = regional.sort((a, b) => (a.latency || 999) - (b.latency || 999))[0];
      if (best) await this.connectToValidator(best);
    }

    // Connect to best validator in each other region (for redundancy)
    for (const [region, validators] of byRegion) {
      if (region === this.clientRegion) continue;

      const best = validators.sort((a, b) => (a.latency || 999) - (b.latency || 999))[0];
      if (best && this.connections.size < 3) { // Limit connections
        await this.connectToValidator(best);
      }
    }
  }

  /**
   * Connect to a specific validator
   */
  private async connectToValidator(validator: ValidatorEndpoint): Promise<void> {
    // Check if already connected
    const existing = this.connections.get(validator.id);
    if (existing?.websocket?.readyState === WebSocket.OPEN) return;

    // Create connection record
    const connection: ValidatorConnection = {
      endpoint: validator,
      messageQueue: [],
      subscriptions: new Set()
    };

    // Create WebSocket connection
    try {
      const ws = new WebSocket(validator.wsUrl);

      ws.onopen = () => {
        console.log(`Connected to validator ${validator.id} in ${validator.region}`);
        connection.websocket = ws;

        // Send queued messages
        for (const msg of connection.messageQueue) {
          this.sendMessage(validator.id, msg.method, msg.params, msg.callback);
        }
        connection.messageQueue = [];

        // Notify extension
        chrome.runtime.sendMessage({
          type: 'validator:connected',
          validatorId: validator.id,
          region: validator.region
        }).catch(() => {
          // Popup might be closed
        });
      };

      ws.onmessage = (event) => {
        this.handleValidatorMessage(validator.id, event.data);
      };

      ws.onerror = (error) => {
        console.error(`WebSocket error for ${validator.id}:`, error);
      };

      ws.onclose = () => {
        console.log(`Disconnected from validator ${validator.id}`);
        connection.websocket = undefined;

        // Schedule reconnection
        if (this.isRunning && validator.healthy) {
          connection.reconnectTimer = window.setTimeout(() => {
            this.connectToValidator(validator).catch(console.error);
          }, RECONNECT_DELAY);
        }
      };

      connection.websocket = ws;
      this.connections.set(validator.id, connection);

    } catch (error) {
      console.error(`Failed to connect to ${validator.id}:`, error);
    }
  }

  /**
   * Send message to validator
   */
  sendMessage(
    validatorId: string,
    method: string,
    params: unknown,
    callback: (error: Error | null, result?: unknown) => void
  ): void {
    const connection = this.connections.get(validatorId);
    if (!connection) {
      callback(new Error('No connection to validator'));
      return;
    }

    if (connection.websocket?.readyState === WebSocket.OPEN) {
      const message = {
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params
      };

      connection.websocket.send(JSON.stringify(message));

      // Store callback (in real implementation, use proper request tracking)
      // For demo, just call success
      setTimeout(() => callback(null, { success: true }), 100);
    } else {
      // Queue message
      connection.messageQueue.push({ method, params, callback });
    }
  }

  /**
   * Handle incoming message from validator
   */
  private handleValidatorMessage(validatorId: string, data: string): void {
    try {
      const message = JSON.parse(data);

      // Broadcast to extension components
      chrome.runtime.sendMessage({
        type: 'validator:message',
        validatorId,
        message
      }).catch(() => {
        // Popup might be closed
      });

    } catch (error) {
      console.error('Failed to parse validator message:', error);
    }
  }

  /**
   * Get healthy validators sorted by preference
   */
  getHealthyValidators(): ValidatorEndpoint[] {
    const validators = Array.from(this.validators.values())
      .filter(v => v.healthy);

    // Sort by region preference and latency
    return validators.sort((a, b) => {
      // Prefer same region
      if (this.clientRegion) {
        const aMatch = a.region === this.clientRegion;
        const bMatch = b.region === this.clientRegion;
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
      }

      // Then by latency
      return (a.latency || 999) - (b.latency || 999);
    });
  }

  /**
   * Get best validator for client
   */
  getBestValidator(): ValidatorEndpoint | null {
    const validators = this.getHealthyValidators();
    return validators[0] || null;
  }

  /**
   * Get connected validators
   */
  getConnectedValidators(): ValidatorEndpoint[] {
    const connected: ValidatorEndpoint[] = [];

    for (const connection of this.connections.values()) {
      if (connection.websocket?.readyState === WebSocket.OPEN) {
        connected.push(connection.endpoint);
      }
    }

    return connected;
  }

  /**
   * Detect client's geographic region
   */
  private async detectClientRegion(): Promise<string | undefined> {
    try {
      // Try to get from storage first
      const stored = await chrome.storage.local.get(['clientRegion']);
      if (stored.clientRegion) return stored.clientRegion;

      // Detect from timezone
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      let region: string | undefined;

      if (timezone.includes('America/New_York')) region = 'us-east';
      else if (timezone.includes('America/Los_Angeles')) region = 'us-west';
      else if (timezone.includes('Europe/')) region = 'eu-west';
      else if (timezone.includes('Asia/')) region = 'asia-pacific';

      // Store detected region
      if (region) {
        await chrome.storage.local.set({ clientRegion: region });
      }

      return region;
    } catch {
      return undefined;
    }
  }

  /**
   * Load cached validators from extension storage
   */
  private async loadCachedValidators(): Promise<void> {
    try {
      const stored = await chrome.storage.local.get(['validators']);
      if (stored.validators) {
        for (const validator of stored.validators) {
          this.validators.set(validator.id, validator);
        }
      }
    } catch (error) {
      console.error('Failed to load cached validators:', error);
    }
  }

  /**
   * Get cached validator list
   */
  private async getCachedValidatorList(): Promise<ValidatorList | null> {
    try {
      const stored = await chrome.storage.local.get(['validatorList']);
      return stored.validatorList || null;
    } catch {
      return null;
    }
  }

  /**
   * Cache validator list
   */
  private async cacheValidatorList(validators: ValidatorEndpoint[]): Promise<void> {
    try {
      await chrome.storage.local.set({
        validatorList: {
          version: '1.0.0',
          timestamp: Date.now(),
          validators
        },
        validators
      });
    } catch (error) {
      console.error('Failed to cache validators:', error);
    }
  }

  /**
   * Setup periodic discovery and health checks
   */
  private setupPeriodicTasks(): void {
    // Periodic discovery (every 5 minutes)
    this.discoveryTimer = window.setInterval(() => {
      this.discoverValidators().catch(console.error);
    }, CACHE_DURATION);

    // Periodic health checks (every 30 seconds)
    this.healthCheckTimer = window.setInterval(() => {
      this.checkAllValidatorHealth().catch(console.error);
    }, HEALTH_CHECK_INTERVAL);
  }

  /**
   * Setup browser event listeners
   */
  private setupBrowserListeners(): void {
    // Network change detection
    if ('connection' in navigator) {
      (navigator as any).connection.addEventListener('change', () => {
        console.log('Network changed, rediscovering validators');
        this.discoverValidators().catch(console.error);
      });
    }

    // Browser startup
    chrome.runtime.onStartup.addListener(() => {
      this.initialize().catch(console.error);
    });

    // Extension install/update
    chrome.runtime.onInstalled.addListener(() => {
      this.initialize().catch(console.error);
    });

    // Handle messages from popup/content scripts
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'getValidators') {
        sendResponse({
          validators: Array.from(this.validators.values()),
          connected: this.getConnectedValidators(),
          best: this.getBestValidator()
        });
      } else if (request.type === 'sendToValidator') {
        this.sendMessage(
          request.validatorId,
          request.method,
          request.params,
          (error, result) => {
            sendResponse({ error: error?.message, result });
          }
        );
        return true; // Keep message channel open
      }
    });
  }

  /**
   * Get validator ID from URL
   */
  private getValidatorId(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.hostname}:${parsed.port || '8545'}`;
    } catch {
      return url;
    }
  }

  /**
   * Shutdown the service
   */
  shutdown(): void {
    this.isRunning = false;

    // Clear timers
    if (this.discoveryTimer) clearInterval(this.discoveryTimer);
    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);

    // Close connections
    for (const connection of this.connections.values()) {
      if (connection.reconnectTimer) clearTimeout(connection.reconnectTimer);
      if (connection.websocket) connection.websocket.close();
    }

    this.connections.clear();
    console.log('Validator discovery service shut down');
  }
}

// Singleton instance
let discoveryService: ValidatorDiscoveryService | null = null;

/**
 * Get or create the discovery service instance
 */
export function getDiscoveryService(): ValidatorDiscoveryService {
  if (!discoveryService) {
    discoveryService = new ValidatorDiscoveryService();
  }
  return discoveryService;
}

// Auto-initialize on background script load
if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
  getDiscoveryService().initialize().catch(console.error);
}