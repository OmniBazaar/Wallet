"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseProvider = void 0;
/**
 * Base provider class that all chain-specific providers extend
 */
class BaseProvider {
    /**
     * Create a new base provider
     * @param config Network configuration
     */
    constructor(config) {
        this.config = config;
    }
    /**
     * Get network configuration
     * @returns Network configuration object
     */
    getConfig() {
        return this.config;
    }
    /**
     * Get chain/network name
     * @returns Network name
     */
    getName() {
        return this.config.name;
    }
    /**
     * Get currency symbol
     * @returns Native currency symbol
     */
    getCurrency() {
        return this.config.currency;
    }
    /**
     * Get RPC URL
     * @returns RPC endpoint URL
     */
    getRpcUrl() {
        return this.config.rpcUrl;
    }
}
exports.BaseProvider = BaseProvider;
