<template>
  <div class="welcome-page">
    <div class="welcome-content">
      <!-- Logo and Title -->
      <div class="hero-section">
        <div class="logo-large">🌟</div>
        <h1 class="welcome-title">Welcome to OmniBazaar</h1>
        <p class="welcome-subtitle">
          Your gateway to the decentralized marketplace universe
        </p>
      </div>

      <!-- Feature Cards -->
      <div class="features-section">
        <div class="feature-card">
          <div class="feature-icon">🔐</div>
          <h3 class="feature-title">Secure & Private</h3>
          <p class="feature-description">
            Your keys, your coins. Full control with enterprise-grade security.
          </p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">🌐</div>
          <h3 class="feature-title">Multi-Chain Support</h3>
          <p class="feature-description">
            Support for 70+ blockchains including Ethereum, Bitcoin, Solana, and more.
          </p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">🎨</div>
          <h3 class="feature-title">NFT Marketplace</h3>
          <p class="feature-description">
            Mint, buy, sell, and trade NFTs across multiple chains seamlessly.
          </p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">🏪</div>
          <h3 class="feature-title">Decentralized Commerce</h3>
          <p class="feature-description">
            Shop in the first truly decentralized marketplace with IPFS storage.
          </p>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="actions-section">
        <button class="primary-button" @click="createNewWallet" :disabled="isLoading">
          <span v-if="!isLoading">Create New Wallet</span>
          <span v-else>Creating...</span>
        </button>
        
        <button class="secondary-button" @click="importWallet" :disabled="isLoading">
          Import Existing Wallet
        </button>
        
        <div class="divider">
          <span>or</span>
        </div>
        
        <button class="link-button" @click="connectHardwareWallet">
          Connect Hardware Wallet
        </button>
      </div>

      <!-- Legal Notice -->
      <div class="legal-section">
        <p class="legal-text">
          By continuing, you agree to our 
          <a href="#" @click="showTerms">Terms of Service</a> and 
          <a href="#" @click="showPrivacy">Privacy Policy</a>
        </p>
      </div>
    </div>

    <!-- Import Wallet Modal -->
    <div v-if="showImportModal" class="modal-overlay" @click="closeImportModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Import Wallet</h3>
          <button class="close-button" @click="closeImportModal">×</button>
        </div>
        
        <div class="modal-body">
          <div class="import-tabs">
            <button 
              class="tab-button" 
              :class="{ active: importMethod === 'seed' }"
              @click="importMethod = 'seed'"
            >
              Seed Phrase
            </button>
            <button 
              class="tab-button" 
              :class="{ active: importMethod === 'private' }"
              @click="importMethod = 'private'"
            >
              Private Key
            </button>
          </div>

          <div v-if="importMethod === 'seed'" class="import-form">
            <label class="form-label">Enter your 12 or 24 word seed phrase:</label>
            <textarea 
              v-model="seedPhrase" 
              class="seed-input"
              placeholder="word1 word2 word3 ..."
              rows="4"
            ></textarea>
          </div>

          <div v-if="importMethod === 'private'" class="import-form">
            <label class="form-label">Enter your private key:</label>
            <input 
              v-model="privateKey" 
              type="password"
              class="private-key-input"
              placeholder="0x..."
            />
          </div>

          <div class="wallet-name-section">
            <label class="form-label">Wallet Name (optional):</label>
            <input 
              v-model="walletName" 
              type="text"
              class="wallet-name-input"
              placeholder="My Wallet"
            />
          </div>

          <div class="password-section">
            <label class="form-label">Create Password:</label>
            <input 
              v-model="password" 
              type="password"
              class="password-input"
              placeholder="Enter secure password"
            />
            <input 
              v-model="confirmPassword" 
              type="password"
              class="password-input"
              placeholder="Confirm password"
            />
          </div>

          <div class="modal-actions">
            <button class="secondary-button" @click="closeImportModal">
              Cancel
            </button>
            <button 
              class="primary-button" 
              @click="executeImport" 
              :disabled="!isImportValid || isLoading"
            >
              <span v-if="!isLoading">Import Wallet</span>
              <span v-else>Importing...</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Hardware Wallet Modal -->
    <div v-if="showHardwareModal" class="modal-overlay" @click="closeHardwareModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Connect Hardware Wallet</h3>
          <button class="close-button" @click="closeHardwareModal">×</button>
        </div>
        
        <div class="modal-body">
          <div class="hardware-options">
            <button class="hardware-option" @click="connectLedger">
              <div class="hardware-icon">🟢</div>
              <div class="hardware-info">
                <div class="hardware-name">Ledger</div>
                <div class="hardware-desc">Nano S, Nano X, Nano S Plus</div>
              </div>
            </button>
            
            <button class="hardware-option" @click="connectTrezor">
              <div class="hardware-icon">⚫</div>
              <div class="hardware-info">
                <div class="hardware-name">Trezor</div>
                <div class="hardware-desc">Model T, Model One</div>
              </div>
            </button>
          </div>
          
          <div class="hardware-instructions">
            <p>1. Connect your hardware wallet to your computer</p>
            <p>2. Unlock your device and open the Ethereum app</p>
            <p>3. Click on your wallet brand above</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useWalletStore } from '@/stores/wallet';

const router = useRouter();
const walletStore = useWalletStore();

// Modal states
const showImportModal = ref(false);
const showHardwareModal = ref(false);
const isLoading = ref(false);

// Import form data
const importMethod = ref<'seed' | 'private'>('seed');
const seedPhrase = ref('');
const privateKey = ref('');
const walletName = ref('');
const password = ref('');
const confirmPassword = ref('');

// Computed
const isImportValid = computed(() => {
  const hasCredentials = importMethod.value === 'seed' 
    ? seedPhrase.value.trim().length > 0
    : privateKey.value.trim().length > 0;
  
  const hasPassword = password.value.length >= 8;
  const passwordsMatch = password.value === confirmPassword.value;
  
  return hasCredentials && hasPassword && passwordsMatch;
});

// Methods
async function createNewWallet(): Promise<void> {
  isLoading.value = true;
  
  try {
    console.log('🆕 Creating new wallet...');
    
    // This will be implemented with actual wallet creation
    // For now, simulate the process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Navigate to home after creation
    router.push('/');
    
  } catch (error) {
    console.error('Failed to create wallet:', error);
  } finally {
    isLoading.value = false;
  }
}

function importWallet(): void {
  showImportModal.value = true;
}

function connectHardwareWallet(): void {
  showHardwareModal.value = true;
}

async function executeImport(): Promise<void> {
  if (!isImportValid.value) return;
  
  isLoading.value = true;
  
  try {
    console.log('📥 Importing wallet...');
    
    // This will be implemented with actual wallet import
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    closeImportModal();
    router.push('/');
    
  } catch (error) {
    console.error('Failed to import wallet:', error);
  } finally {
    isLoading.value = false;
  }
}

async function connectLedger(): Promise<void> {
  isLoading.value = true;
  
  try {
    console.log('🟢 Connecting to Ledger...');
    
    // This will be implemented with actual Ledger connection
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    closeHardwareModal();
    router.push('/');
    
  } catch (error) {
    console.error('Failed to connect Ledger:', error);
  } finally {
    isLoading.value = false;
  }
}

async function connectTrezor(): Promise<void> {
  isLoading.value = true;
  
  try {
    console.log('⚫ Connecting to Trezor...');
    
    // This will be implemented with actual Trezor connection
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    closeHardwareModal();
    router.push('/');
    
  } catch (error) {
    console.error('Failed to connect Trezor:', error);
  } finally {
    isLoading.value = false;
  }
}

function closeImportModal(): void {
  showImportModal.value = false;
  // Clear form data
  seedPhrase.value = '';
  privateKey.value = '';
  walletName.value = '';
  password.value = '';
  confirmPassword.value = '';
}

function closeHardwareModal(): void {
  showHardwareModal.value = false;
}

function showTerms(): void {
  // Open terms of service
  console.log('Show terms of service');
}

function showPrivacy(): void {
  // Open privacy policy
  console.log('Show privacy policy');
}
</script>

<style scoped>
.welcome-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  overflow-y: auto;
}

.welcome-content {
  padding: 24px;
  max-width: 400px;
  margin: 0 auto;
}

.hero-section {
  text-align: center;
  margin-bottom: 32px;
}

.logo-large {
  font-size: 64px;
  margin-bottom: 16px;
  display: block;
}

.welcome-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px 0;
}

.welcome-subtitle {
  font-size: 16px;
  opacity: 0.9;
  margin: 0;
  line-height: 1.4;
}

.features-section {
  margin-bottom: 32px;
}

.feature-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  text-align: center;
}

.feature-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.feature-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 4px 0;
}

.feature-description {
  font-size: 14px;
  opacity: 0.9;
  margin: 0;
  line-height: 1.4;
}

.actions-section {
  margin-bottom: 24px;
}

.primary-button {
  width: 100%;
  background: white;
  color: #667eea;
  border: none;
  border-radius: 12px;
  padding: 16px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 12px;
}

.primary-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 25px rgba(255, 255, 255, 0.2);
}

.primary-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.secondary-button {
  width: 100%;
  background: transparent;
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  padding: 14px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 12px;
}

.secondary-button:hover:not(:disabled) {
  border-color: white;
  background: rgba(255, 255, 255, 0.1);
}

.divider {
  text-align: center;
  margin: 16px 0;
  position: relative;
}

.divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: rgba(255, 255, 255, 0.3);
}

.divider span {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 0 16px;
  font-size: 14px;
  opacity: 0.8;
}

.link-button {
  background: none;
  border: none;
  color: white;
  font-size: 16px;
  cursor: pointer;
  text-decoration: underline;
  width: 100%;
  padding: 8px;
}

.legal-section {
  text-align: center;
}

.legal-text {
  font-size: 12px;
  opacity: 0.8;
  line-height: 1.4;
  margin: 0;
}

.legal-text a {
  color: white;
  text-decoration: underline;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.modal-content {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 400px;
  max-height: 90vh;
  overflow-y: auto;
  color: #333;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 24px 0 24px;
}

.modal-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 4px;
}

.modal-body {
  padding: 24px;
}

.import-tabs {
  display: flex;
  margin-bottom: 24px;
  background: #f3f4f6;
  border-radius: 8px;
  padding: 4px;
}

.tab-button {
  flex: 1;
  background: none;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.tab-button.active {
  background: white;
  color: #667eea;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.import-form {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
  color: #374151;
}

.seed-input, .private-key-input, .wallet-name-input, .password-input {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  margin-bottom: 12px;
  font-family: monospace;
}

.seed-input {
  resize: vertical;
  min-height: 80px;
}

.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.modal-actions .secondary-button,
.modal-actions .primary-button {
  flex: 1;
  margin-bottom: 0;
}

.modal-actions .secondary-button {
  color: #6b7280;
  border-color: #d1d5db;
}

.modal-actions .primary-button {
  background: #667eea;
  color: white;
}

.hardware-options {
  margin-bottom: 24px;
}

.hardware-option {
  width: 100%;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
  transition: all 0.2s;
}

.hardware-option:hover {
  border-color: #667eea;
  transform: translateY(-1px);
}

.hardware-icon {
  font-size: 32px;
}

.hardware-info {
  text-align: left;
}

.hardware-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.hardware-desc {
  font-size: 14px;
  color: #6b7280;
}

.hardware-instructions {
  background: #f9fafb;
  border-radius: 8px;
  padding: 16px;
}

.hardware-instructions p {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #374151;
}

.hardware-instructions p:last-child {
  margin-bottom: 0;
}
</style> 