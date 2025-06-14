// src/utils/cache.js
export const cache = {
    // In-memory cache for API responses
    memory: new Map(),
    
    // Cache duration in milliseconds
    durations: {
      SHORT: 5 * 60 * 1000,      // 5 minutes
      MEDIUM: 30 * 60 * 1000,    // 30 minutes
      LONG: 60 * 60 * 1000,      // 1 hour
      VERY_LONG: 24 * 60 * 60 * 1000  // 24 hours
    },
  
    set(key, value, duration = this.durations.MEDIUM) {
      const expiry = Date.now() + duration;
      this.memory.set(key, { value, expiry });
    },
  
    get(key) {
      const item = this.memory.get(key);
      if (!item) return null;
      
      if (Date.now() > item.expiry) {
        this.memory.delete(key);
        return null;
      }
      
      return item.value;
    },
  
    has(key) {
      return this.get(key) !== null;
    },
  
    delete(key) {
      this.memory.delete(key);
    },
  
    clear() {
      this.memory.clear();
    },
  
    // Cache API responses
    async cacheApiCall(key, apiCall, duration = this.durations.MEDIUM) {
      // Check cache first
      const cached = this.get(key);
      if (cached) {
        logger.debug('Cache hit', { key });
        return cached;
      }
  
      // Make API call and cache result
      try {
        const result = await apiCall();
        this.set(key, result, duration);
        logger.debug('Cache miss - stored result', { key });
        return result;
      } catch (error) {
        logger.error('API call failed', { key, error: error.message });
        throw error;
      }
    }
  };
  