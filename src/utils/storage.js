// src/utils/storage.js
import logger from './logger';
import { analytics } from './analytics';
import { errorHandler } from './errorHandler';
import { performanceMonitor } from './performance';
import { AppError } from './errorHandler';
import { featureFlags } from './featureFlags';
import { cache } from './cache';
import { validation } from './validation';
import { ApiClient } from './apiClient';

export const storage = {
    // Safely get from localStorage
    get(key, defaultValue = null) {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
      } catch (error) {
        logger.warn('Failed to get from localStorage', { key, error: error.message });
        return defaultValue;
      }
    },
  
    // Safely set to localStorage
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        logger.warn('Failed to set to localStorage', { key, error: error.message });
        return false;
      }
    },
  
    // Remove from localStorage
    remove(key) {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (error) {
        logger.warn('Failed to remove from localStorage', { key, error: error.message });
        return false;
      }
    },
  
    // Clear all localStorage
    clear() {
      try {
        localStorage.clear();
        return true;
      } catch (error) {
        logger.warn('Failed to clear localStorage', { error: error.message });
        return false;
      }
    }
  };
  
  // Initialize utilities
  export const initializeUtils = () => {
    // Initialize analytics and performance monitoring
    analytics.init();
    
    // Set up global error handling
    window.addEventListener('error', (event) => {
      errorHandler.logError(event.error);
    });
    
    // Set up unhandled promise rejection handling
    window.addEventListener('unhandledrejection', (event) => {
      errorHandler.logError(event.reason);
    });
    
    logger.info('Utilities initialized successfully');
  };
  
  // Export everything
  export {
    AppError,
    errorHandler,
    performanceMonitor,
    analytics,
    featureFlags,
    cache,
    validation,
    ApiClient
  };