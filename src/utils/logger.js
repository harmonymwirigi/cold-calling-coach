// src/utils/logger.js
export const logger = {
    levels: {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3
    },
  
    currentLevel: process.env.NODE_ENV === 'production' ? 2 : 0,
  
    log(level, message, data = {}) {
      if (this.levels[level] < this.currentLevel) return;
  
      const logEntry = {
        level,
        message,
        data,
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
      };
  
      // Console output with appropriate styling
      const styles = {
        DEBUG: 'color: #64748b;',
        INFO: 'color: #3b82f6;',
        WARN: 'color: #f59e0b; font-weight: bold;',
        ERROR: 'color: #ef4444; font-weight: bold;'
      };
  
      console.log(`%c[${level}] ${message}`, styles[level], data);
  
      // Send to external logging service in production
      if (process.env.NODE_ENV === 'production') {
        this.sendToLoggingService(logEntry);
      }
    },
  
    debug(message, data) {
      this.log('DEBUG', message, data);
    },
  
    info(message, data) {
      this.log('INFO', message, data);
    },
  
    warn(message, data) {
      this.log('WARN', message, data);
    },
  
    error(message, data) {
      this.log('ERROR', message, data);
    },
  
    sendToLoggingService(logEntry) {
      // Send to external logging service
      // Example: LogRocket, Datadog, etc.
      console.log('Would send to logging service:', logEntry);
    }
  };