// src/utils/apiClient.js
export class ApiClient {
    constructor(baseURL, options = {}) {
      this.baseURL = baseURL;
      this.timeout = options.timeout || 10000;
      this.retries = options.retries || 3;
      this.retryDelay = options.retryDelay || 1000;
    }
  
    async request(endpoint, options = {}) {
      const url = `${this.baseURL}${endpoint}`;
      const controller = new AbortController();
      
      // Set timeout
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const requestOptions = {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      };
  
      let lastError;
      
      // Retry logic
      for (let attempt = 0; attempt <= this.retries; attempt++) {
        try {
          const startTime = performance.now();
          const response = await fetch(url, requestOptions);
          const endTime = performance.now();
          
          clearTimeout(timeoutId);
          
          // Track API performance
          performanceMonitor.trackApiCall(endpoint, startTime, endTime, response.ok);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.json();
          logger.debug('API request successful', { endpoint, attempt });
          
          return data;
        } catch (error) {
          lastError = error;
          logger.warn('API request failed', { endpoint, attempt, error: error.message });
          
          // Don't retry on certain errors
          if (error.name === 'AbortError' || error.status === 401) {
            break;
          }
          
          // Wait before retry
          if (attempt < this.retries) {
            await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)));
          }
        }
      }
      
      clearTimeout(timeoutId);
      throw lastError;
    }
  
    get(endpoint, options = {}) {
      return this.request(endpoint, { ...options, method: 'GET' });
    }
  
    post(endpoint, data, options = {}) {
      return this.request(endpoint, {
        ...options,
        method: 'POST',
        body: JSON.stringify(data)
      });
    }
  
    put(endpoint, data, options = {}) {
      return this.request(endpoint, {
        ...options,
        method: 'PUT',
        body: JSON.stringify(data)
      });
    }
  
    delete(endpoint, options = {}) {
      return this.request(endpoint, { ...options, method: 'DELETE' });
    }
  }