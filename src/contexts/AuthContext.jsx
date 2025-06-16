// src/contexts/AuthContext.jsx - Updated for Custom Email Verification
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

  // Add isAdmin function
  const isAdmin = () => {
    return userProfile?.is_admin === true;
  };

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          logger.error('Error getting session:', error);
        } else {
          setUser(session?.user ?? null);
          if (session?.user) {
            await loadUserProfile(session.user.id);
          }
        }
      } catch (error) {
        logger.error('Error in getInitialSession:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        logger.log('Auth state changed:', event, session?.user?.email);
        
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await loadUserProfile(session.user.id);
        } else {
          setUserProfile(null);
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId) => {
    try {
      logger.log('Loading user profile for:', userId);
      
      // First try to get from users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError) {
        logger.warn('Users table error:', userError.message, 'Code:', userError.code);
        
        // If table doesn't exist or access denied, fall back to auth metadata
        if (userError.code === 'PGRST116' || userError.code === '42P01' || userError.status === 406) {
          logger.log('Falling back to auth metadata...');
          
          const { data: { user }, error: authError } = await supabase.auth.getUser();
          if (authError) {
            logger.error('Error getting auth user:', authError);
            return;
          }

          if (user?.user_metadata) {
            const profileFromMetadata = {
              id: user.id,
              email: user.email,
              first_name: user.user_metadata.first_name,
              prospect_job_title: user.user_metadata.prospect_job_title,
              prospect_industry: user.user_metadata.prospect_industry,
              custom_behavior_notes: user.user_metadata.custom_behavior_notes
            };
            
            logger.log('Profile loaded from metadata:', profileFromMetadata);
            setUserProfile(profileFromMetadata);
          }
          return;
        } else {
          logger.error('Unexpected error loading user profile:', userError);
          return;
        }
      }

      if (userData) {
        logger.log('Profile loaded from users table:', userData);
        setUserProfile(userData);
      } else {
        logger.log('No user data found, falling back to auth metadata...');
        
        // Fallback to auth metadata
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) {
          logger.error('Error getting auth user:', authError);
          return;
        }

        if (user?.user_metadata) {
          setUserProfile({
            id: user.id,
            email: user.email,
            first_name: user.user_metadata.first_name,
            prospect_job_title: user.user_metadata.prospect_job_title,
            prospect_industry: user.user_metadata.prospect_industry,
            custom_behavior_notes: user.user_metadata.custom_behavior_notes
          });
        }
      }
    } catch (error) {
      logger.error('Error in loadUserProfile:', error);
      
      // Last resort: try to get basic info from auth
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserProfile({
            id: user.id,
            email: user.email,
            first_name: user.user_metadata?.first_name || 'User'
          });
        }
      } catch (fallbackError) {
        logger.error('Fallback profile load failed:', fallbackError);
      }
    }
  };

  const signUp = async (email, password, profileData) => {
    try {
      logger.log('Starting signup process for verified email:', email);
      
      // Try to sign up the user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: profileData.first_name,
            prospect_job_title: profileData.prospect_job_title,
            prospect_industry: profileData.prospect_industry,
            custom_behavior_notes: profileData.custom_behavior_notes || '',
            email_verified: true // Mark as verified since we verified it
          },
          // Don't send confirmation email since we already verified
          emailRedirectTo: undefined
        }
      });

      if (error) {
        logger.error('Signup error:', error);
        
        // Handle the "User already registered" error specifically
        if (error.message?.includes('User already registered')) {
          logger.log('User already exists, attempting to sign in...');
          
          // Try to sign in the existing user instead
          const signInResult = await signIn(email, password);
          
          if (signInResult.success) {
            // Successfully signed in existing user
            // Now make sure they have a profile in the users table
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await createUserProfile(user.id, {
                email: user.email,
                ...profileData
              });
            }
            
            return {
              success: true,
              user: signInResult.user,
              message: 'Signed in to existing account and updated profile'
            };
          } else {
            // Existing user but wrong password
            return {
              success: false,
              error: 'An account with this email already exists. Please use the login page or reset your password if you forgot it.'
            };
          }
        }
        
        return {
          success: false,
          error: error.message
        };
      }

      if (data.user) {
        logger.log('User created successfully');
        
        // Create user profile record
        await createUserProfile(data.user.id, {
          email: data.user.email,
          ...profileData,
          is_verified: true // Mark as verified
        });

        return {
          success: true,
          user: data.user,
          session: data.session
        };
      }

      return {
        success: false,
        error: 'Unexpected signup response'
      };

    } catch (error) {
      logger.error('Signup error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred during signup'
      };
    }
  };

  const createUserProfile = async (userId, profileData) => {
    try {
      logger.log('Creating user profile:', userId);
      
      const { error } = await supabase
        .from('users')
        .insert([{
          id: userId,
          email: profileData.email,
          first_name: profileData.first_name,
          prospect_job_title: profileData.prospect_job_title,
          prospect_industry: profileData.prospect_industry,
          custom_behavior_notes: profileData.custom_behavior_notes || '',
          is_verified: true, // Mark as verified since we verified the email
          created_at: new Date().toISOString()
        }]);

      if (error) {
        logger.warn('Could not create user profile in users table:', error.message);
        
        // If users table doesn't exist or access denied, just log and continue
        // The profile data is already stored in auth.user_metadata
        if (error.code === '42P01' || error.status === 406) {
          logger.log('Users table not accessible, profile data stored in auth metadata only');
        } else {
          logger.error('Unexpected error creating user profile:', error);
        }
      } else {
        logger.log('User profile created successfully in users table');
      }
    } catch (error) {
      logger.error('Error in createUserProfile:', error);
      // Don't throw - the user can still function with auth metadata
    }
  };

  const signIn = async (email, password) => {
    try {
      logger.log('Attempting to sign in:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        logger.error('Sign in error:', error);
        return {
          success: false,
          error: error.message
        };
      }

      if (data.user) {
        logger.log('Sign in successful');
        return {
          success: true,
          user: data.user
        };
      }

      return {
        success: false,
        error: 'Invalid credentials'
      };

    } catch (error) {
      logger.error('Sign in error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred during sign in'
      };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        logger.error('Sign out error:', error);
        return { success: false, error: error.message };
      }
      
      setUser(null);
      setUserProfile(null);
      return { success: true };
    } catch (error) {
      logger.error('Sign out error:', error);
      return { success: false, error: 'Failed to sign out' };
    }
  };

  const updateProfile = async (updates) => {
    try {
      if (!user) {
        return { success: false, error: 'No user logged in' };
      }

      logger.log('Updating user profile with:', updates);

      // Update auth metadata first (this always works)
      const { error: authError } = await supabase.auth.updateUser({
        data: updates
      });

      if (authError) {
        logger.error('Error updating auth metadata:', authError);
        return { success: false, error: 'Failed to update profile metadata' };
      }

      // Try to update users table if it exists
      try {
        const { error: profileError } = await supabase
          .from('users')
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        if (profileError) {
          logger.warn('Could not update users table:', profileError.message);
          
          // If table doesn't exist or access denied, that's okay
          if (profileError.code !== '42P01' && profileError.status !== 406) {
            logger.error('Unexpected error updating users table:', profileError);
          }
        } else {
          logger.log('Users table updated successfully');
        }
      } catch (tableError) {
        logger.warn('Users table update failed:', tableError);
        // Continue anyway - auth metadata was updated
      }

      // Reload profile to get latest data
      await loadUserProfile(user.id);

      return { success: true };
    } catch (error) {
      logger.error('Error updating profile:', error);
      return { success: false, error: 'Failed to update profile' };
    }
  };

  const resetPassword = async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      logger.error('Reset password error:', error);
      return { success: false, error: 'Failed to send reset email' };
    }
  };

  const value = {
    user,
    userProfile,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    resetPassword,
    isAdmin  // Add isAdmin to the context value
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};