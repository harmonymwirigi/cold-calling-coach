// src/utils/validators.js
export const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  
  export const validateName = (name) => {
    return name && name.trim().length >= 2;
  };
  
  export const validateVerificationCode = (code) => {
    return code && /^\d{6}$/.test(code);
  };