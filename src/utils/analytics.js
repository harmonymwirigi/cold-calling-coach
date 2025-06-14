// src/utils/analytics.js
export const analytics = {
    // Initialize analytics
    init() {
      if (typeof window === 'undefined') return;
  
      // Initialize performance monitoring
      performanceMonitor.trackPageLoad();
      
      // Track page views
      this.trackPageView();
      
      // Set up error tracking
      window.addEventListener('error', this.handleError.bind(this));
      window.addEventListener('unhandledrejection', this.handlePromiseRejection.bind(this));
    },
  
    // Track page views
    trackPageView(page = window.location.pathname) {
      this.track('page_view', {
        page,
        title: document.title,
        referrer: document.referrer
      });
    },
  
    // Track events
    track(event, properties = {}) {
      const eventData = {
        event,
        properties: {
          ...properties,
          timestamp: new Date().toISOString(),
          session_id: this.getSessionId(),
          user_id: this.getUserId()
        }
      };
  
      logger.info('Analytics event', eventData);
  
      // Send to analytics service
      // Example: Mixpanel, Amplitude, Google Analytics
      // mixpanel.track(event, eventData.properties);
    },
  
    // Track user properties
    identify(userId, properties = {}) {
      this.track('identify', {
        user_id: userId,
        ...properties
      });
    },
  
    // Track roleplay events
    trackRoleplayEvent(type, roleplayType, mode, data = {}) {
      this.track(`roleplay_${type}`, {
        roleplay_type: roleplayType,
        mode,
        ...data
      });
    },
  
    // Track voice events
    trackVoiceEvent(type, data = {}) {
      this.track(`voice_${type}`, data);
    },
  
    // Handle JavaScript errors
    handleError(event) {
      logger.error('JavaScript error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });
    },
  
    // Handle promise rejections
    handlePromiseRejection(event) {
      logger.error('Unhandled promise rejection', {
        reason: event.reason,
        stack: event.reason?.stack
      });
    },
  
    getSessionId() {
      // Generate or retrieve session ID
      let sessionId = sessionStorage.getItem('session_id');
      if (!sessionId) {
        sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('session_id', sessionId);
      }
      return sessionId;
    },
  
    getUserId() {
      // Get user ID from your auth system
      return 'anonymous'; // Replace with actual user ID
    }
  };