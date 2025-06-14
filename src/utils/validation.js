
// src/utils/validation.js
export const validation = {
    // Email validation
    isValidEmail(email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    },
  
    // Phone number validation
    isValidPhone(phone) {
      const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
      return phoneRegex.test(phone);
    },
  
    // Strong password validation
    isStrongPassword(password) {
      // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
      const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
      return strongRegex.test(password);
    },
  
    // Name validation
    isValidName(name) {
      return name && name.trim().length >= 2 && name.trim().length <= 50;
    },
  
    // Sanitize input
    sanitizeInput(input) {
      if (typeof input !== 'string') return input;
      
      return input
        .trim()
        .replace(/[<>]/g, '') // Remove potential HTML
        .slice(0, 1000); // Limit length
    },
  
    // Validate roleplay data
    validateRoleplayData(data) {
      const errors = [];
      
      if (!data.roleplay_type) {
        errors.push('Roleplay type is required');
      }
      
      if (!data.mode) {
        errors.push('Mode is required');
      }
      
      if (data.calls_attempted < 0) {
        errors.push('Calls attempted must be non-negative');
      }
      
      if (data.calls_passed > data.calls_attempted) {
        errors.push('Calls passed cannot exceed calls attempted');
      }
      
      return errors;
    }
  };