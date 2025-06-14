// src/services/supabase.js - FIXED SIGNUP FLOW
import { createClient } from '@supabase/supabase-js';
import { emailService } from './emailService';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Authentication Service
export const authService = {
  // Send verification code - Same as before
  async sendVerificationCode(email, firstName) {
    try {
      console.log('Starting verification process for:', email);

      if (!email || !firstName) {
        throw new Error('Email and first name are required');
      }

      const connectionTest = await emailService.testConnection();
      if (!connectionTest.success) {
        throw new Error('Cannot connect to email server. Please try again.');
      }

      const emailResult = await emailService.sendVerificationEmail(email, firstName);
      
      if (!emailResult.success) {
        throw new Error(emailResult.error || 'Failed to send verification email');
      }

      console.log('Verification email sent successfully');
      return { success: true, message: 'Verification code sent to your email' };
    } catch (error) {
      console.error('Error sending verification code:', error);
      return { success: false, error: error.message };
    }
  },

  // Verify email code - Same as before
  async verifyEmailCode(email, code) {
    try {
      console.log('Verifying email code for:', email);

      if (!email || !code) {
        throw new Error('Email and verification code are required');
      }

      const verificationResult = await emailService.verifyEmailCode(email, code);
      
      if (!verificationResult.success) {
        throw new Error(verificationResult.error || 'Invalid verification code');
      }

      console.log('Email verification successful');
      return { success: true, message: 'Email verified successfully' };
    } catch (error) {
      console.error('Error verifying code:', error);
      return { success: false, error: error.message };
    }
  },

// Create user account - UPDATED TO USE REAL PASSWORD
// Create user account - UPDATED TO USE REAL PASSWORD
async signUp(email, firstName, password, profileData) {
  try {
    console.log('Creating user account for:', email);

    // Validate inputs first
    if (!email || !firstName || !password || !profileData) {
      throw new Error('Email, first name, password, and profile data are required');
    }

    // Extract profile data with different variable names to avoid conflicts
    const jobTitle = profileData.prospectJobTitle;
    const industry = profileData.prospectIndustry; 
    const behaviorNotes = profileData.customBehaviorNotes;
    
    if (!jobTitle || !industry) {
      throw new Error('Job title and industry are required');
    }

    // Validate password
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }
    
    console.log('Creating Supabase auth user with provided password...');
    
    // Create auth user with the user's actual password
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password, // Use the user's password instead of random one
      options: {
        data: {
          first_name: firstName
        },
        emailRedirectTo: undefined // Disable email confirmation redirect
      }
    });

    if (authError) {
      console.error('Auth signup error:', authError);
      
      // Handle specific auth errors
      if (authError.message.includes('already registered')) {
        throw new Error('An account with this email already exists. Please try signing in instead.');
      }
      
      if (authError.message.includes('weak password')) {
        throw new Error('Password is too weak. Please use a stronger password with letters and numbers.');
      }
      
      throw new Error('Failed to create account: ' + authError.message);
    }

    if (!authData.user) {
      throw new Error('Account creation failed - no user returned from Supabase');
    }

    console.log('✅ Auth user created successfully:', authData.user.id);
    
    // Wait a moment to ensure auth user is fully created
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify the auth user exists before creating profile
    console.log('Verifying auth user exists...');
    const { data: authUser, error: getUserError } = await supabase.auth.getUser();
    
    if (getUserError) {
      console.error('Error verifying auth user:', getUserError);
      throw new Error('Failed to verify user creation');
    }

    console.log('✅ Auth user verified, creating profile...');

    // Create user profile with the verified auth user ID
    const userProfileData = {
      id: authData.user.id,
      email,
      first_name: firstName,
      prospect_job_title: jobTitle,
      prospect_industry: industry,
      custom_behavior_notes: behaviorNotes || '',
      is_verified: true,
      created_at: new Date().toISOString()
    };

    console.log('Profile insert data:', userProfileData);

    const { data: createdProfile, error: profileError } = await supabase
      .from('users')
      .insert(userProfileData)
      .select()
      .single();

    if (profileError) {
      console.error('Profile creation error:', profileError);
      
      // Try to clean up auth user if profile creation fails
      try {
        await supabase.auth.signOut();
      } catch (cleanupError) {
        console.error('Failed to cleanup auth user:', cleanupError);
      }
      
      // Provide specific error messages
      if (profileError.code === '23503') {
        throw new Error('Failed to create user profile: Authentication user not found. Please try again.');
      } else if (profileError.code === '23505') {
        throw new Error('A user with this email already exists. Please try signing in instead.');
      } else {
        throw new Error('Failed to create user profile: ' + profileError.message);
      }
    }

    console.log('✅ User profile created successfully');

    // Initialize user progress for all roleplay types
    console.log('Initializing user progress...');
    const roleplayTypes = [
      'opener_practice', 'opener_marathon', 'opener_legend',
      'pitch_practice', 'pitch_marathon', 'pitch_legend',
      'warmup_challenge', 'full_simulation', 'power_hour'
    ];

    const progressInserts = roleplayTypes.map(type => ({
      user_id: authData.user.id,
      roleplay_type: type,
      marathon_passes: 0,
      total_attempts: 0,
      total_passes: 0,
      created_at: new Date().toISOString()
    }));

    const { error: progressError } = await supabase
      .from('user_progress')
      .insert(progressInserts);

    if (progressError) {
      console.error('Progress initialization error:', progressError);
      // Don't fail the signup for this - it's not critical
      console.log('⚠️  Progress initialization failed, but continuing...');
    } else {
      console.log('✅ User progress initialized');
    }

    // Send welcome email (non-blocking)
    console.log('Sending welcome email...');
    emailService.sendWelcomeEmail(email, firstName, profileData)
      .then(() => console.log('✅ Welcome email sent'))
      .catch(error => console.error('❌ Welcome email failed:', error));

    console.log('🎉 User account created successfully');
    return { success: true, user: authData.user, profile: createdProfile };
  } catch (error) {
    console.error('Error creating user account:', error);
    return { success: false, error: error.message };
  }
},
  // Sign in user
  async signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      return { success: true, user: data.user };
    } catch (error) {
      console.error('Error signing in:', error);
      return { success: false, error: error.message };
    }
  },

  // Sign out user
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error signing out:', error);
      return { success: false, error: error.message };
    }
  },

  // Get current session
  async getCurrentSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      return session;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  },

  // Get current user
  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }
};

// User Service - Same as before
export const userService = {
  // Get user profile
  async getUserProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error getting user profile:', error);
      return { success: false, error: error.message };
    }
  },

  // Update user profile
  async updateUserProfile(userId, updates) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error updating user profile:', error);
      return { success: false, error: error.message };
    }
  },

  // Get user progress
  async getUserProgress(userId) {
    try {
      const { data, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;
      
      // Convert to object for easy access
      const progressObj = {};
      data.forEach(item => {
        progressObj[item.roleplay_type] = item;
      });

      return { success: true, data: progressObj };
    } catch (error) {
      console.error('Error getting user progress:', error);
      return { success: false, error: error.message };
    }
  },

  // Update user progress
  async updateUserProgress(userId, roleplayType, progressData) {
    try {
      const { data, error } = await supabase
        .from('user_progress')
        .upsert({
          user_id: userId,
          roleplay_type: roleplayType,
          ...progressData,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error updating user progress:', error);
      return { success: false, error: error.message };
    }
  },

  // Get user sessions
  async getUserSessions(userId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('session_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error getting user sessions:', error);
      return { success: false, error: error.message };
    }
  },

  // Log session
  async logSession(userId, sessionData) {
    try {
      const { data, error } = await supabase
        .from('session_logs')
        .insert({
          user_id: userId,
          ...sessionData
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error logging session:', error);
      return { success: false, error: error.message };
    }
  }
};

// Achievement Service - Same as before
export const achievementService = {
  // Check and award achievements
  async checkAchievements(userId) {
    try {
      // Get user progress and sessions
      const [progressResult, sessionsResult] = await Promise.all([
        userService.getUserProgress(userId),
        userService.getUserSessions(userId, 100)
      ]);

      if (!progressResult.success || !sessionsResult.success) {
        throw new Error('Failed to get user data for achievement check');
      }

      const progress = progressResult.data;
      const sessions = sessionsResult.data;

      const newAchievements = [];

      // Check for first call achievement
      if (sessions.length >= 1) {
        const hasAchievement = await this.hasAchievement(userId, 'first_call');
        if (!hasAchievement) {
          await this.awardAchievement(userId, 'first_call', { first_session: sessions[0] });
          newAchievements.push('first_call');
        }
      }

      // Check for marathon master achievement
      const marathonPasses = Object.values(progress).reduce((sum, p) => sum + (p.marathon_passes || 0), 0);
      if (marathonPasses >= 1) {
        const hasAchievement = await this.hasAchievement(userId, 'marathon_master');
        if (!hasAchievement) {
          await this.awardAchievement(userId, 'marathon_master', { total_marathon_passes: marathonPasses });
          newAchievements.push('marathon_master');
        }
      }

      // Check for legend status achievement
      const legendCompleted = Object.values(progress).some(p => p.legend_completed);
      if (legendCompleted) {
        const hasAchievement = await this.hasAchievement(userId, 'legend_status');
        if (!hasAchievement) {
          await this.awardAchievement(userId, 'legend_status', { legend_achieved: true });
          newAchievements.push('legend_status');
        }
      }

      // Check for consistency achievement (7+ sessions in last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentSessions = sessions.filter(s => new Date(s.created_at) > sevenDaysAgo);
      
      if (recentSessions.length >= 7) {
        const hasAchievement = await this.hasAchievement(userId, 'consistency_king');
        if (!hasAchievement) {
          await this.awardAchievement(userId, 'consistency_king', { 
            sessions_last_7_days: recentSessions.length 
          });
          newAchievements.push('consistency_king');
        }
      }

      return { success: true, newAchievements };
    } catch (error) {
      console.error('Error checking achievements:', error);
      return { success: false, error: error.message };
    }
  },

  // Check if user has specific achievement
  async hasAchievement(userId, achievementId) {
    try {
      const { data, error } = await supabase
        .from('user_achievements')
        .select('id')
        .eq('user_id', userId)
        .eq('achievement_id', achievementId)
        .limit(1);

      if (error) throw error;
      return data.length > 0;
    } catch (error) {
      console.error('Error checking achievement:', error);
      return false;
    }
  },

  // Award achievement to user
  async awardAchievement(userId, achievementId, achievementData = {}) {
    try {
      const { data, error } = await supabase
        .from('user_achievements')
        .insert({
          user_id: userId,
          achievement_id: achievementId,
          achievement_data: achievementData
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error awarding achievement:', error);
      return { success: false, error: error.message };
    }
  },

  // Get user achievements
  async getUserAchievements(userId) {
    try {
      const { data, error } = await supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', userId)
        .order('earned_at', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error getting user achievements:', error);
      return { success: false, error: error.message };
    }
  }
};

// Real-time subscriptions
export const subscriptionService = {
  // Subscribe to user progress updates
  subscribeToUserProgress(userId, callback) {
    return supabase
      .channel('user_progress_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_progress',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe();
  },

  // Subscribe to session updates
  subscribeToUserSessions(userId, callback) {
    return supabase
      .channel('user_sessions_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'session_logs',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe();
  },

  // Unsubscribe from channel
  unsubscribe(subscription) {
    return supabase.removeChannel(subscription);
  }
};

export default {
  supabase,
  authService,
  userService,
  achievementService,
  subscriptionService
};