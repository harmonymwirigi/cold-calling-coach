// src/contexts/AuthContext.jsx - IMPROVED with better error handling
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
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
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Get initial session
    const getInitialSession = async () => {
      try {
        logger.log('🔄 Getting initial session...');
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          logger.error('Session error:', error);
        } else if (session?.user && mounted) {
          logger.log('✅ Found existing session for:', session.user.email);
          setUser(session.user);
          await loadUserProfile(session.user.id);
        } else {
          logger.log('ℹ️ No existing session found');
        }
      } catch (error) {
        logger.error('❌ Error getting initial session:', error);
      } finally {
        if (mounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        logger.log('🔄 Auth state changed:', event, session?.user?.email);
        
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await loadUserProfile(session.user.id);
        } else {
          setUserProfile(null);
        }
        
        if (!initialized) {
          setLoading(false);
          setInitialized(true);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [initialized]);

  const loadUserProfile = async (userId) => {
    try {
      logger.log('👤 Loading user profile for:', userId);
      
      // First try auth user metadata
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        logger.error('Auth user error:', authError);
        return;
      }

      // Set basic profile from auth metadata
      const basicProfile = {
        id: authUser.id,
        email: authUser.email,
        first_name: authUser.user_metadata?.first_name || 'User',
        prospect_job_title: authUser.user_metadata?.prospect_job_title,
        prospect_industry: authUser.user_metadata?.prospect_industry,
        custom_behavior_notes: authUser.user_metadata?.custom_behavior_notes,
        role: authUser.user_metadata?.role || 'user',
        access_level: authUser.user_metadata?.access_level || 'limited',
        is_admin: authUser.user_metadata?.role === 'admin'
      };

      setUserProfile(basicProfile);
      logger.log('✅ Basic profile loaded from auth metadata');

      // Try to enhance with database data (non-blocking)
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (!userError && userData) {
          // Merge database data with auth metadata
          const enhancedProfile = {
            ...basicProfile,
            ...userData,
            // Ensure critical fields from auth take precedence
            id: authUser.id,
            email: authUser.email
          };
          
          setUserProfile(enhancedProfile);
          logger.log('✅ Profile enhanced with database data');
        } else if (userError.code !== 'PGRST116') {
          // Only log if it's not a "no rows" error
          logger.warn('Database profile lookup warning:', userError.message);
        }
      } catch (dbError) {
        logger.warn('Database profile error (non-critical):', dbError.message);
        // Keep the basic profile from auth metadata
      }

    } catch (error) {
      logger.error('❌ Error loading user profile:', error);
      
      // Set minimal profile to prevent complete failure
      setUserProfile({
        id: userId,
        email: 'unknown@example.com',
        first_name: 'User',
        role: 'user',
        access_level: 'limited',
        is_admin: false
      });
    }
  };

  // Fixed authentication check functions
  const isAuthenticated = () => {
    return !loading && !!user && !!userProfile;
  };

  const isAdmin = () => {
    return isAuthenticated() && (
      userProfile?.role === 'admin' || 
      userProfile?.role === 'super_admin' ||
      userProfile?.is_admin === true
    );
  };

  const signUp = async (email, password, profileData) => {
    try {
      logger.log('📝 Starting signup for:', email);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: profileData.first_name,
            prospect_job_title: profileData.prospect_job_title,
            prospect_industry: profileData.prospect_industry,
            custom_behavior_notes: profileData.custom_behavior_notes || '',
            role: 'user',
            access_level: 'trial', // Start with trial access
            email_verified: true
          }
        }
      });

      if (error) {
        logger.error('Signup error:', error);
        
        if (error.message?.includes('User already registered')) {
          logger.log('User exists, attempting signin...');
          return await signIn(email, password);
        }
        
        return { success: false, error: error.message };
      }

      if (data.user) {
        logger.log('✅ User created successfully');
        
        // Try to create database profile (non-blocking)
        try {
          await createUserProfile(data.user.id, {
            email: data.user.email,
            ...profileData
          });
        } catch (profileError) {
          logger.warn('Profile creation warning:', profileError);
          // Don't fail signup if profile creation fails
        }

        return {
          success: true,
          user: data.user,
          session: data.session
        };
      }

      return { success: false, error: 'Unexpected signup response' };

    } catch (error) {
      logger.error('❌ Signup error:', error);
      return { success: false, error: 'Signup failed' };
    }
  };

  const createUserProfile = async (userId, profileData) => {
    try {
      logger.log('👤 Creating user profile for:', userId);
      
      const { error } = await supabase
        .from('users')
        .insert([{
          id: userId,
          email: profileData.email,
          first_name: profileData.first_name,
          prospect_job_title: profileData.prospect_job_title,
          prospect_industry: profileData.prospect_industry,
          custom_behavior_notes: profileData.custom_behavior_notes || '',
          role: 'user',
          access_level: 'trial',
          is_admin: false,
          is_verified: true,
          created_at: new Date().toISOString()
        }]);

      if (error && error.code !== '23505') { // Ignore duplicate key errors
        logger.warn('Profile creation warning:', error.message);
      } else {
        logger.log('✅ User profile created successfully');
      }
    } catch (error) {
      logger.warn('Profile creation error (non-critical):', error);
    }
  };

  const signIn = async (email, password) => {
    try {
      logger.log('🔑 Attempting signin for:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        logger.error('Signin error:', error);
        return { success: false, error: error.message };
      }

      if (data.user) {
        logger.log('✅ Signin successful');
        return { success: true, user: data.user };
      }

      return { success: false, error: 'Invalid credentials' };

    } catch (error) {
      logger.error('❌ Signin error:', error);
      return { success: false, error: 'Signin failed' };
    }
  };

  const signOut = async () => {
    try {
      logger.log('🚪 Signing out...');
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        logger.error('Signout error:', error);
        return { success: false, error: error.message };
      }
      
      setUser(null);
      setUserProfile(null);
      
      logger.log('✅ Signed out successfully');
      return { success: true };
    } catch (error) {
      logger.error('❌ Signout error:', error);
      return { success: false, error: 'Signout failed' };
    }
  };

  const updateProfile = async (updates) => {
    try {
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      logger.log('📝 Updating profile with:', Object.keys(updates));

      // Update auth metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: updates
      });

      if (authError) {
        logger.error('Auth update error:', authError);
        return { success: false, error: 'Failed to update auth data' };
      }

      // Try to update database (non-blocking)
      try {
        const { error: dbError } = await supabase
          .from('users')
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        if (dbError) {
          logger.warn('Database update warning:', dbError.message);
        }
      } catch (dbError) {
        logger.warn('Database update error (non-critical):', dbError);
      }

      // Reload profile
      await loadUserProfile(user.id);

      return { success: true };
    } catch (error) {
      logger.error('❌ Profile update error:', error);
      return { success: false, error: 'Update failed' };
    }
  };

  const resetPassword = async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      
      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      logger.error('Reset password error:', error);
      return { success: false, error: 'Reset failed' };
    }
  };

  const value = {
    user,
    userProfile,
    loading,
    initialized,
    isAuthenticated,
    isAdmin,
    signUp,
    signIn,
    signOut,
    updateProfile,
    resetPassword
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};