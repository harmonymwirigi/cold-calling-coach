// src/utils/logger.js

const isDevelopment = process.env.NODE_ENV === 'development';

// eslint-disable-next-line no-console
const log = (...args) => isDevelopment && logger.log(...args);
// eslint-disable-next-line no-console
const error = (...args) => isDevelopment && logger.error(...args);
// eslint-disable-next-line no-console
const warn = (...args) => isDevelopment && logger.warn(...args);
// eslint-disable-next-line no-console
const info = (...args) => isDevelopment && logger.info(...args);

const logger = {
  log,
  error,
  warn,
  info
};

export default logger;