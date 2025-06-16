// src/config/api.js
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

export const API_ENDPOINTS = {
  SEND_VERIFICATION: `${API_BASE_URL}/api/send-verification`,
  VERIFY_EMAIL: `${API_BASE_URL}/api/verify-email`,
  HEALTH_CHECK: `${API_BASE_URL}/health`,
  TEST_DB: `${API_BASE_URL}/api/test-db`
};

// API helper functions
export const apiHelpers = {
  // Send verification code
  sendVerificationCode: async (email, firstName) => {
    try {
      const response = await fetch(API_ENDPOINTS.SEND_VERIFICATION, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          firstName
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || 'Failed to send verification code');
      }

      return {
        success: true,
        message: result.message
      };
    } catch (error) {
      console.error('Send verification error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send verification code'
      };
    }
  },

  // Verify email code
  verifyEmailCode: async (email, code) => {
    try {
      const response = await fetch(API_ENDPOINTS.VERIFY_EMAIL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          code
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || 'Failed to verify code');
      }

      return {
        success: true,
        message: result.message
      };
    } catch (error) {
      console.error('Verify code error:', error);
      return {
        success: false,
        error: error.message || 'Failed to verify code'
      };
    }
  },

  // Health check
  healthCheck: async () => {
    try {
      const response = await fetch(API_ENDPOINTS.HEALTH_CHECK);
      const result = await response.json();
      return { success: response.ok, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Test database connection
  testDatabase: async () => {
    try {
      const response = await fetch(API_ENDPOINTS.TEST_DB);
      const result = await response.json();
      return { success: response.ok, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

export default API_ENDPOINTS;