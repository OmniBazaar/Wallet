<template>
  <div class="wallet-app">
    <!-- Navigation Header -->
    <nav class="nav-header" v-if="!isWelcome">
      <div class="nav-brand">
        <div class="logo">🌟</div>
        <span class="brand-text">OmniBazaar</span>
      </div>
      
      <div class="nav-actions">
        <button 
          class="nav-button"
          @click="$router.push('/settings')"
          :class="{ active: $route.path === '/settings' }"
        >
          ⚙️
        </button>
      </div>
    </nav>

    <!-- Main Content Area -->
    <main class="main-content" :class="{ 'welcome-mode': isWelcome }">
      <router-view />
    </main>

    <!-- Bottom Navigation -->
    <nav class="bottom-nav" v-if="!isWelcome && walletStore.isUnlocked">
      <button 
        class="nav-tab"
        @click="$router.push('/')"
        :class="{ active: $route.path === '/' }"
      >
        <div class="nav-icon">🏠</div>
        <span class="nav-label">Home</span>
      </button>
      
      <button 
        class="nav-tab"
        @click="$router.push('/send')"
        :class="{ active: $route.path === '/send' }"
      >
        <div class="nav-icon">📤</div>
        <span class="nav-label">Send</span>
      </button>
      
      <button 
        class="nav-tab"
        @click="$router.push('/receive')"
        :class="{ active: $route.path === '/receive' }"
      >
        <div class="nav-icon">📥</div>
        <span class="nav-label">Receive</span>
      </button>
      
      <button 
        class="nav-tab"
        @click="$router.push('/marketplace')"
        :class="{ active: $route.path === '/marketplace' }"
      >
        <div class="nav-icon">🏪</div>
        <span class="nav-label">Market</span>
      </button>
      
      <button 
        class="nav-tab"
        @click="$router.push('/nft-mint')"
        :class="{ active: $route.path === '/nft-mint' }"
      >
        <div class="nav-icon">🎨</div>
        <span class="nav-label">Mint</span>
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useWalletStore } from '@/stores/wallet';

const route = useRoute();
const router = useRouter();
const walletStore = useWalletStore();

// Check if current route is welcome page
const isWelcome = computed(() => route.path === '/welcome');

// Initialize wallet on app load
onMounted(async () => {
  console.log('🚀 OmniBazaar Wallet App mounted');
  
  try {
    await walletStore.initialize();
    
    // Redirect to welcome if first time user
    if (!walletStore.isSetup && route.path !== '/welcome') {
      router.push('/welcome');
    }
  } catch (error) {
    console.error('Failed to initialize wallet:', error);
  }
});
</script>

<style scoped>
.wallet-app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #333;
}

.nav-header {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo {
  font-size: 20px;
}

.brand-text {
  font-weight: 600;
  font-size: 16px;
  color: #333;
}

.nav-actions {
  display: flex;
  gap: 8px;
}

.nav-button {
  background: none;
  border: none;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.2s;
}

.nav-button:hover {
  background: rgba(0, 0, 0, 0.1);
}

.nav-button.active {
  background: rgba(102, 126, 234, 0.2);
}

.main-content {
  flex: 1;
  overflow-y: auto;
  background: white;
}

.main-content.welcome-mode {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.bottom-nav {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  padding: 8px 0;
  display: flex;
  justify-content: space-around;
}

.nav-tab {
  background: none;
  border: none;
  padding: 8px 4px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 60px;
  transition: all 0.2s;
  border-radius: 8px;
}

.nav-tab:hover {
  background: rgba(0, 0, 0, 0.05);
}

.nav-tab.active {
  background: rgba(102, 126, 234, 0.1);
  color: #667eea;
}

.nav-icon {
  font-size: 18px;
}

.nav-label {
  font-size: 11px;
  font-weight: 500;
}

/* Responsive adjustments */
@media (max-width: 380px) {
  .nav-tab {
    min-width: 50px;
  }
  
  .nav-label {
    font-size: 10px;
  }
  
  .nav-icon {
    font-size: 16px;
  }
}
</style> 