/* Import the type definitions */
import './shims-vue.d.ts';
/**
 * OmniBazaar Wallet Popup Main Entry Point
 * Initializes the Vue.js application for the browser extension popup
 * Sets up routing, state management, and error handling
 */
import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import { createPinia } from 'pinia';
import App from './App.vue';
import { logger } from '../utils/logger';

/** Import all page components for routing */
import Home from './pages/Home.vue';
import Send from './pages/Send.vue';
import Receive from './pages/Receive.vue';
import NFTMint from './pages/NFTMint.vue';
import Marketplace from './pages/Marketplace.vue';
import Settings from './pages/Settings.vue';
import Welcome from './pages/Welcome.vue';

logger.warn('🚀 OmniBazaar Wallet popup initializing...');

/**
 * Create Vue Router instance with hash-based routing
 * Uses hash routing for browser extension compatibility
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    /** Main wallet dashboard */
    { path: '/', name: 'Home', component: Home },
    /** Send cryptocurrency/tokens page */
    { path: '/send', name: 'Send', component: Send },
    /** Receive cryptocurrency/tokens page */
    { path: '/receive', name: 'Receive', component: Receive },
    /** NFT minting interface */
    { path: '/nft-mint', name: 'NFTMint', component: NFTMint },
    /** OmniBazaar marketplace interface */
    { path: '/marketplace', name: 'Marketplace', component: Marketplace },
    /** Wallet settings and configuration */
    { path: '/settings', name: 'Settings', component: Settings },
    /** Welcome/onboarding page */
    { path: '/welcome', name: 'Welcome', component: Welcome },
  ],
});

/** Create Pinia store for state management */
const pinia = createPinia();

/** Create Vue application instance and configure plugins */
const app = createApp(App);
app.use(router);
app.use(pinia);

/**
 * Global error handler for Vue application errors
 * Logs errors to console for debugging in development
 * @param err - The error object
 * @param vm - Vue component instance (deprecated in Vue 3)
 * @param info - Vue-specific error info
 */
app.config.errorHandler = (err, vm, info) => {
  logger.error(`Vue error: ${info}`, err);
};

/** Mount the application to the DOM element */
app.mount('#app');

logger.warn('✅ OmniBazaar Wallet popup mounted'); 