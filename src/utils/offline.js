import logger from './logger';

// src/utils/offline.js
export const offlineManager = {
    isOnline: navigator.onLine,
  
    init() {
      window.addEventListener('online', this.handleOnline.bind(this));
      window.addEventListener('offline', this.handleOffline.bind(this));
    },
  
    handleOnline() {
      this.isOnline = true;
      this.syncPendingData();
      this.showNotification('Back online! Syncing your data...', 'success');
    },
  
    handleOffline() {
      this.isOnline = false;
      this.showNotification('You\'re offline. Some features may be limited.', 'warning');
    },
  
    async syncPendingData() {
      // Sync any offline data when back online
      const pendingData = this.getPendingData();
      
      for (const item of pendingData) {
        try {
          await this.syncItem(item);
          this.removePendingItem(item.id);
        } catch (error) {
          logger.error('Failed to sync item:', error);
        }
      }
    },
  
    storePendingData(data) {
      const pending = this.getPendingData();
      pending.push({ ...data, id: Date.now() });
      localStorage.setItem('pending_sync', JSON.stringify(pending));
    },
  
    getPendingData() {
      try {
        return JSON.parse(localStorage.getItem('pending_sync')) || [];
      } catch {
        return [];
      }
    },
  
    removePendingItem(id) {
      const pending = this.getPendingData().filter(item => item.id !== id);
      localStorage.setItem('pending_sync', JSON.stringify(pending));
    },
  
    async syncItem(item) {
      // Implement actual sync logic based on item type
      logger.log('Syncing item:', item);
    },
  
    showNotification(message, type) {
      // Show in-app notification
      logger.log(`[${type.toUpperCase()}] ${message}`);
    }
  };
  
