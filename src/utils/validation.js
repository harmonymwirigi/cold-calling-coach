// src/utils/validation.js

export const validation = {
    // Email validation
    isValidEmail(email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    },
  
    // Password validation
    isValidPassword(password) {
      return password && password.length >= 8;
    },
  
    // Name validation
    isValidName(name) {
      return name && name.length >= 2;
    },
  
    // Phone number validation
    isValidPhone(phone) {
      const phoneRegex = /^\+?[\d\s-()]{10,}$/;
      return phoneRegex.test(phone);
    },
  
    // URL validation
    isValidUrl(url) {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    },
  
    // Validate form data
    validateForm(formData, rules) {
      const errors = {};
      
      for (const [field, value] of Object.entries(formData)) {
        const fieldRules = rules[field];
        if (!fieldRules) continue;
  
        if (fieldRules.required && !value) {
          errors[field] = 'This field is required';
        } else if (value) {
          if (fieldRules.email && !this.isValidEmail(value)) {
            errors[field] = 'Invalid email format';
          }
          if (fieldRules.minLength && value.length < fieldRules.minLength) {
            errors[field] = `Must be at least ${fieldRules.minLength} characters`;
          }
          if (fieldRules.maxLength && value.length > fieldRules.maxLength) {
            errors[field] = `Must be no more than ${fieldRules.maxLength} characters`;
          }
          if (fieldRules.pattern && !fieldRules.pattern.test(value)) {
            errors[field] = fieldRules.message || 'Invalid format';
          }
        }
      }
  
      return {
        isValid: Object.keys(errors).length === 0,
        errors
      };
    },
  
    // Strong password validation
    isStrongPassword(password) {
      // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
      const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
      return strongRegex.test(password);
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
