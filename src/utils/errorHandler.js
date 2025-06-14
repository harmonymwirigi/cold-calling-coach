// src/utils/errorHandler.js
class AppError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
      super(message);
      this.statusCode = statusCode;
      this.isOperational = isOperational;
      this.timestamp = new Date().toISOString();
      
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  export const errorTypes = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
    NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
    RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
    EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    VOICE_ERROR: 'VOICE_ERROR',
    AI_ERROR: 'AI_ERROR'
  };
  
  export const createError = (type, message, statusCode) => {
    const error = new AppError(message, statusCode);
    error.type = type;
    return error;
  };
  
  export const errorHandler = {
    // Handle API errors
    handleApiError(error) {
      logger.error('API Error:', error);
      
      // Log to external service (Sentry, LogRocket, etc.)
      this.logError(error);
      
      // Return user-friendly message
      return this.getUserFriendlyMessage(error);
    },
  
    // Handle voice recognition errors
    handleVoiceError(error) {
      logger.error('Voice Error:', error);
      
      const voiceErrors = {
        'not-allowed': 'Microphone access denied. Please allow microphone access and try again.',
        'no-speech': 'No speech detected. Please speak clearly and try again.',
        'audio-capture': 'Microphone not available. Please check your microphone and try again.',
        'network': 'Network error. Please check your connection and try again.',
        'aborted': 'Speech recognition was cancelled.',
        'language-not-supported': 'Language not supported. Please check your browser settings.'
      };
      
      return voiceErrors[error.error] || 'Voice recognition error. Please try again.';
    },
  
    // Handle AI service errors
    handleAiError(error) {
      logger.error('AI Error:', error);
      
      if (error.code === 'rate_limit_exceeded') {
        return 'Too many requests. Please wait a moment and try again.';
      }
      
      if (error.code === 'insufficient_quota') {
        return 'Service temporarily unavailable. Please try again later.';
      }
      
      return 'AI service error. Please try again.';
    },
  
    // Get user-friendly error message
    getUserFriendlyMessage(error) {
      const friendlyMessages = {
        [errorTypes.VALIDATION_ERROR]: 'Please check your input and try again.',
        [errorTypes.AUTHENTICATION_ERROR]: 'Please log in and try again.',
        [errorTypes.AUTHORIZATION_ERROR]: 'You don\'t have permission to perform this action.',
        [errorTypes.NOT_FOUND_ERROR]: 'The requested resource was not found.',
        [errorTypes.RATE_LIMIT_ERROR]: 'Too many requests. Please wait and try again.',
        [errorTypes.EXTERNAL_API_ERROR]: 'External service error. Please try again later.',
        [errorTypes.DATABASE_ERROR]: 'Database error. Please try again.',
        [errorTypes.VOICE_ERROR]: 'Voice recognition error. Please try again.',
        [errorTypes.AI_ERROR]: 'AI service error. Please try again.'
      };
  
      return friendlyMessages[error.type] || 'An unexpected error occurred. Please try again.';
    },
  
    // Log error to external service
    logError(error) {
      // In production, send to Sentry, LogRocket, or similar service
      const errorLog = {
        message: error.message,
        stack: error.stack,
        type: error.type,
        statusCode: error.statusCode,
        timestamp: error.timestamp,
        url: window.location.href,
        userAgent: navigator.userAgent,
        userId: this.getCurrentUserId() // Implement this based on your auth system
      };
  
      // Send to logging service
      logger.error('Error logged:', errorLog);
      
      // In production:
      // Sentry.captureException(error);
      // or similar logging service
    },
  
    getCurrentUserId() {
      // Get current user ID from your auth context
      return 'anonymous';
    }
  };
  