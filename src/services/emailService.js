// src/services/emailService.js

const API_URL = process.env.NODE_ENV === 'production' 
  ? '' // Use relative URLs in production (same domain)
  : 'http://localhost:3001'; // Local development

export const emailService = {
  // Send verification code email - FIXED VERSION
  async sendVerificationEmail(email, firstName) {
    try {
      console.log('Sending verification email to:', email);
      
      const response = await fetch(`${API_URL}/api/send-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          firstName
          // Removed 'code' parameter - server generates its own
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Server response error:', data);
        throw new Error(data.message || data.error || 'Failed to send verification email');
      }

      console.log('Verification email sent successfully:', data);
      return { success: true, data };
    } catch (error) {
      console.error('Error sending verification email:', error);
      return { 
        success: false, 
        error: error.message || 'Network error occurred'
      };
    }
  },

  // Verify email code - NEW METHOD
  async verifyEmailCode(email, code) {
    try {
      console.log('Verifying email code for:', email);
      
      const response = await fetch(`${API_URL}/api/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          code
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Verification error:', data);
        throw new Error(data.message || data.error || 'Failed to verify code');
      }

      console.log('Email verified successfully:', data);
      return { success: true, data };
    } catch (error) {
      console.error('Error verifying email code:', error);
      return { 
        success: false, 
        error: error.message || 'Network error occurred'
      };
    }
  },

  // Test server connection
  async testConnection() {
    try {
      const response = await fetch(`${API_URL}/health`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error('Server health check failed');
      }

      console.log('Server connection test successful:', data);
      return { success: true, data };
    } catch (error) {
      console.error('Server connection test failed:', error);
      return { 
        success: false, 
        error: error.message || 'Cannot connect to server'
      };
    }
  },

  // Send welcome email
  async sendWelcomeEmail(email, firstName, profileData) {
    try {
      const response = await fetch(`${API_URL}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'welcome',
          email,
          firstName,
          profileData
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send welcome email');
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('Error sending welcome email:', error);
      return { success: false, error: error.message };
    }
  },

  // Send weekly progress report
  async sendProgressReport(email, firstName, progressData) {
    try {
      const response = await fetch(`${API_URL}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'progress_report',
          email,
          firstName,
          progressData
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send progress report');
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('Failed to send progress report:', error);
      return { success: false, error: error.message };
    }
  },

  // Send achievement notification
  async sendAchievementEmail(email, firstName, achievement) {
    try {
      const response = await fetch(`${API_URL}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'achievement',
          email,
          firstName,
          achievement
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send achievement email');
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('Failed to send achievement email:', error);
      return { success: false, error: error.message };
    }
  },

  // Send practice reminder
  async sendPracticeReminder(email, firstName, reminderData) {
    try {
      const response = await fetch(`${API_URL}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'practice_reminder',
          email,
          firstName,
          reminderData
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send practice reminder');
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('Failed to send practice reminder:', error);
      return { success: false, error: error.message };
    }
  },

  // Send upgrade notification
  async sendUpgradeNotification(email, firstName, upgradeInfo) {
    try {
      const response = await fetch(`${API_URL}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'upgrade',
          email,
          firstName,
          upgradeInfo
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send upgrade notification');
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('Failed to send upgrade notification:', error);
      return { success: false, error: error.message };
    }
  }
};

export default emailService;