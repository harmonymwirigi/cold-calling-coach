// src/utils/logger.js

const isDevelopment = process.env.NODE_ENV === 'development';

const logger = {
  log: (...args) => isDevelopment && console.log(...args),
  error: (...args) => isDevelopment && console.error(...args),
  warn: (...args) => isDevelopment && console.warn(...args),
  info: (...args) => isDevelopment && console.info(...args)
};

export default logger;