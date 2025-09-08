<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <h2>Send Tokens</h2>
      <button @click="$emit('close')" class="close-btn">×</button>
      
      <!-- Send form content -->
      <div class="send-form">
        <label>Recipient Address</label>
        <input type="text" placeholder="0x..." class="address-input" />
        
        <label>Amount</label>
        <input type="number" placeholder="0.0" class="amount-input" />
        
        <button class="send-btn">Send</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Send Modal Component
 * Modal for sending tokens to another address
 */
defineEmits(['close']);
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

.send-form {
  margin-top: 1.5rem;
}

.send-form label {
  display: block;
  margin-bottom: 0.5rem;
  color: var(--text-secondary);
}

.address-input,
.amount-input {
  width: 100%;
  padding: 0.75rem;
  margin-bottom: 1rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
}

.send-btn {
  width: 100%;
  padding: 0.75rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
}
</style>