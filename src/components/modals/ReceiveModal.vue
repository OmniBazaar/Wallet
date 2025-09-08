<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <h2>Receive Tokens</h2>
      <button @click="$emit('close')" class="close-btn">×</button>
      
      <!-- Receive content -->
      <div class="receive-content">
        <div data-testid="qr-code" class="qr-code">
          <!-- QR Code placeholder -->
          <div class="qr-placeholder">QR Code</div>
        </div>
        
        <div data-testid="receive-address" class="address-display">
          {{ walletAddress }}
        </div>
        
        <button @click="copyAddress" class="copy-btn">Copy Address</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Receive Modal Component
 * Modal for displaying wallet address and QR code for receiving tokens
 */
import { computed } from 'vue';
import { useWalletStore } from '../../stores/wallet';

defineEmits(['close']);

const walletStore = useWalletStore();
const walletAddress = computed(() => walletStore.address);

const copyAddress = () => {
  navigator.clipboard.writeText(walletAddress.value);
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 2rem;
  max-width: 480px;
  width: 90%;
  position: relative;
}

.close-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-secondary);
}

.receive-content {
  margin-top: 1.5rem;
  text-align: center;
}

.qr-code {
  margin: 1.5rem auto;
  width: 200px;
  height: 200px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qr-placeholder {
  color: var(--text-secondary);
}

.address-display {
  font-family: monospace;
  background: var(--bg-primary);
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  word-break: break-all;
  font-size: 0.875rem;
}

.copy-btn {
  padding: 0.75rem 2rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
}
</style>