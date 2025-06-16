// src/utils/logger.js - Simple logger utility for debugging
const logger = {
  log: (...args) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[LOG]', new Date().toISOString(), ...args);
    }
  },
  
  warn: (...args) => {
    console.warn('[WARN]', new Date().toISOString(), ...args);
  },
  
  error: (...args) => {
    console.error('[ERROR]', new Date().toISOString(), ...args);
  },
  
  info: (...args) => {
    if (process.env.NODE_ENV === 'development') {
      console.info('[INFO]', new Date().toISOString(), ...args);
    }
  }
};

export default logger;