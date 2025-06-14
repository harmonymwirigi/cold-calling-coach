import logger from './logger';

// src/utils/performance.js
export const performanceMonitor = {
    // Track page load performance
    trackPageLoad() {
      if (typeof window !== 'undefined' && 'performance' in window) {
        window.addEventListener('load', () => {
          setTimeout(() => {
            const navigation = performance.getEntriesByType('navigation')[0];
            const paint = performance.getEntriesByType('paint');
            
            const metrics = {
              // Core Web Vitals
              loadTime: navigation.loadEventEnd - navigation.loadEventStart,
              domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
              firstPaint: paint.find(p => p.name === 'first-paint')?.startTime,
              firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime,
              
              // Additional metrics
              ttfb: navigation.responseStart - navigation.requestStart,
              dns: navigation.domainLookupEnd - navigation.domainLookupStart,
              tcp: navigation.connectEnd - navigation.connectStart,
              ssl: navigation.requestStart - navigation.secureConnectionStart
            };
            
            this.sendMetrics('page_load', metrics);
          }, 0);
        });
      }
    },
  
    // Track API performance
    trackApiCall(endpoint, startTime, endTime, success = true) {
      const duration = endTime - startTime;
      
      this.sendMetrics('api_call', {
        endpoint,
        duration,
        success,
        timestamp: new Date().toISOString()
      });
    },
  
    // Track voice recognition performance
    trackVoiceRecognition(duration, confidence, success) {
      this.sendMetrics('voice_recognition', {
        duration,
        confidence,
        success,
        timestamp: new Date().toISOString()
      });
    },
  
    // Track user interactions
    trackUserInteraction(action, element, metadata = {}) {
      this.sendMetrics('user_interaction', {
        action,
        element,
        metadata,
        timestamp: new Date().toISOString(),
        page: window.location.pathname
      });
    },
  
    // Send metrics to analytics service
    sendMetrics(type, data) {
      // In production, send to your analytics service
      logger.log(`Performance metric [${type}]:`, data);
      
      // Example: Send to Google Analytics 4
      // gtag('event', type, data);
      
      // Example: Send to custom analytics
      // analytics.track(type, data);
    },
  
    // Measure function execution time
    measureExecution(fn, name) {
      return async (...args) => {
        const start = performance.now();
        try {
          const result = await fn(...args);
          const end = performance.now();
          
          this.trackApiCall(name, start, end, true);
          return result;
        } catch (error) {
          const end = performance.now();
          this.trackApiCall(name, start, end, false);
          throw error;
        }
      };
    }
  };
  
