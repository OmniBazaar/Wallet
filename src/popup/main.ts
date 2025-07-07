// OmniBazaar Wallet Popup Main Entry Point
import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import { createPinia } from 'pinia';
import App from './App.vue';

// Import pages
import Home from './pages/Home.vue';
import Send from './pages/Send.vue';
import Receive from './pages/Receive.vue';
import NFTMint from './pages/NFTMint.vue';
import Marketplace from './pages/Marketplace.vue';
import Settings from './pages/Settings.vue';
import Welcome from './pages/Welcome.vue';

console.log('🚀 OmniBazaar Wallet popup initializing...');

// Create router
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'Home', component: Home },
    { path: '/send', name: 'Send', component: Send },
    { path: '/receive', name: 'Receive', component: Receive },
    { path: '/nft-mint', name: 'NFTMint', component: NFTMint },
    { path: '/marketplace', name: 'Marketplace', component: Marketplace },
    { path: '/settings', name: 'Settings', component: Settings },
    { path: '/welcome', name: 'Welcome', component: Welcome },
  ],
});

// Create Pinia store
const pinia = createPinia();

// Create and mount app
const app = createApp(App);
app.use(router);
app.use(pinia);

// Global error handler
app.config.errorHandler = (err, vm, info) => {
  console.error('Vue error:', err, info);
};

// Mount the app
app.mount('#app');

console.log('✅ OmniBazaar Wallet popup mounted'); 