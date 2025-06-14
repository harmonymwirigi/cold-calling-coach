// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService, userService } from '../services/supabase';
import logger from '../utils/logger';
const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize auth state
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setLoading(true);
      const session = await authService.getCurrentSession();
      
      if (session?.user) {
        setUser(session.user);
        // Load user profile
        const profileResult = await userService.getUserProfile(session.user.id);
        if (profileResult.success) {
          setUserProfile(profileResult.data);
        }
      }
    } catch (error) {
      logger.error('Error initializing auth:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Send verification code
  const sendVerificationCode = async (email, firstName) => {
    try {
      setError(null);
      logger.log('AuthContext: Sending verification code for:', email);
      
      const result = await authService.sendVerificationCode(email, firstName);
      
      if (result.success) {
        logger.log('AuthContext: Verification code sent successfully');
        return { success: true, message: result.message };
      } else {
        logger.error('AuthContext: Failed to send verification code:', result.error);
        setError(result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      logger.error('AuthContext: Send verification error:', error);
      const errorMessage = error.message || 'Failed to send verification code';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Verify email code
  const verifyEmailCode = async (email, code) => {
    try {
      setError(null);
      logger.log('AuthContext: Verifying email code for:', email);
      
      const result = await authService.verifyEmailCode(email, code);
      
      if (result.success) {
        logger.log('AuthContext: Email verification successful');
        return { success: true, message: result.message };
      } else {
        logger.error('AuthContext: Email verification failed:', result.error);
        setError(result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      logger.error('AuthContext: Verify email error:', error);
      const errorMessage = error.message || 'Failed to verify email code';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Sign up user - UPDATED TO ACCEPT PASSWORD
  const signUp = async (email, firstName, password, profileData) => {
    try {
      setError(null);
      setLoading(true);
      logger.log('AuthContext: Creating user account for:', email);
      
      const result = await authService.signUp(email, firstName, password, profileData);
      
      if (result.success) {
        logger.log('AuthContext: User account created successfully');
        setUser(result.user);
        
        // Load user profile
        const profileResult = await userService.getUserProfile(result.user.id);
        if (profileResult.success) {
          setUserProfile(profileResult.data);
        }
        
        return { success: true, user: result.user };
      } else {
        logger.error('AuthContext: User signup failed:', result.error);
        setError(result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      logger.error('AuthContext: Signup error:', error);
      const errorMessage = error.message || 'Failed to create account';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Sign in user
  const signIn = async (email, password) => {
    try {
      setError(null);
      setLoading(true);
      
      const result = await authService.signIn(email, password);
      
      if (result.success) {
        setUser(result.user);
        
        // Load user profile
        const profileResult = await userService.getUserProfile(result.user.id);
        if (profileResult.success) {
          setUserProfile(profileResult.data);
        }
        
        return { success: true, user: result.user };
      } else {
        setError(result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      logger.error('AuthContext: Sign in error:', error);
      const errorMessage = error.message || 'Failed to sign in';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Sign out user
  const signOut = async () => {
    try {
      setError(null);
      const result = await authService.signOut();
      
      if (result.success) {
        setUser(null);
        setUserProfile(null);
        return { success: true };
      } else {
        setError(result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      logger.error('AuthContext: Sign out error:', error);
      const errorMessage = error.message || 'Failed to sign out';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Update user profile
  const updateProfile = async (updates) => {
    try {
      setError(null);
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const result = await userService.updateUserProfile(user.id, updates);
      
      if (result.success) {
        setUserProfile(result.data);
        return { success: true, data: result.data };
      } else {
        setError(result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      logger.error('AuthContext: Update profile error:', error);
      const errorMessage = error.message || 'Failed to update profile';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Clear error
  const clearError = () => {
    setError(null);
  };

  // Get user progress
  const getUserProgress = async () => {
    try {
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const result = await userService.getUserProgress(user.id);
      return result;
    } catch (error) {
      logger.error('AuthContext: Get user progress error:', error);
      return { success: false, error: error.message };
    }
  };

  // Check authentication status
  const isAuthenticated = () => {
    return user !== null;
  };

  // Check if user is admin
  const isAdmin = () => {
    return userProfile?.role === 'admin' || userProfile?.email === process.env.REACT_APP_ADMIN_EMAIL;
  };

  const value = {
    // State
    user,
    userProfile,
    loading,
    error,
    
    // Auth methods
    sendVerificationCode,
    verifyEmailCode,
    signUp,
    signIn,
    signOut,
    updateProfile,
    
    // Utility methods
    clearError,
    getUserProgress,
    isAuthenticated,
    isAdmin,
    
    // For debugging
    initializeAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;