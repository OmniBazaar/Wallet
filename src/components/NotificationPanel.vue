<template>
  <div class="notification-panel">
    <div class="panel-header">
      <h3>Notifications</h3>
      <button @click="$emit('close')" class="close-btn">×</button>
    </div>
    
    <div class="panel-actions">
      <button @click="$emit('mark-all-read')" data-testid="mark-all-read" class="mark-read-btn">
        Mark All Read
      </button>
    </div>
    
    <div class="notification-list">
      <div v-for="notification in notifications" 
           :key="notification.id" 
           class="notification-item"
           :class="{ unread: !notification.read }">
        <div class="notification-icon">{{ getIcon(notification.type) }}</div>
        <div class="notification-content">
          <p class="notification-message">{{ notification.message }}</p>
          <span class="notification-time">{{ formatTime(notification.timestamp) }}</span>
        </div>
      </div>
      
      <div v-if="notifications.length === 0" class="empty-state">
        No notifications
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Notification Panel Component
 * Displays user notifications in a dropdown panel
 */
import { computed } from 'vue';
import { useWalletStore } from '../stores/wallet';

defineEmits(['close', 'mark-all-read']);

const walletStore = useWalletStore();
const notifications = computed(() => walletStore.notifications ?? []);

const getIcon = (type: string): string => {
  const icons: Record<string, string> = {
    transaction: '💸',
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
    success: '✅'
  };
  return icons[type] ?? 'ℹ️';
};

const formatTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
};
</script>

<style scoped>
.notification-panel {
  position: absolute;
  top: 60px;
  right: 0;
  width: 320px;
  max-height: 400px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  z-index: 100;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-secondary);
}

.panel-actions {
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--border-color);
}

.mark-read-btn {
  background: none;
  border: none;
  color: var(--primary-color);
  cursor: pointer;
  font-size: 0.875rem;
}

.notification-list {
  max-height: 300px;
  overflow-y: auto;
}

.notification-item {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
  transition: background 0.2s;
}

.notification-item:hover {
  background: var(--bg-tertiary);
}

.notification-item.unread {
  background: rgba(59, 130, 246, 0.05);
}

.notification-icon {
  font-size: 1.25rem;
}

.notification-content {
  flex: 1;
}

.notification-message {
  margin: 0 0 0.25rem 0;
  font-size: 0.875rem;
}

.notification-time {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--text-secondary);
}
</style>