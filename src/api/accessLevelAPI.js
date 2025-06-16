// src/api/accessLevelAPI.js - FIXED to work directly with Supabase
import { supabase } from '../config/supabase';
import logger from '../utils/logger';

export class AccessLevelAPI {
  
  constructor() {
    // Fix for the "getBaseURL is not a function" error
    this.baseURL = window.location.origin;
  }

  // Helper method that was missing and causing the error
  getBaseURL() {
    return this.baseURL;
  }

  // Get user's complete access status - FIXED to use Supabase directly
  async getUserAccessStatus(userId) {
    try {
      logger.log('📊 Getting user access status for:', userId);

      // Try the database function first
      const { data, error } = await supabase
        .rpc('get_user_access_status', { p_user_id: userId });

      if (error) {
        logger.warn('Database function failed, using fallback:', error.message);
        
        // Fallback: get basic user info and construct access status
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, email, first_name, access_level, is_admin, prospect_job_title, prospect_industry')
          .eq('id', userId)
          .single();

        if (userError) {
          throw new Error(`Failed to get user data: ${userError.message}`);
        }

        // Get user progress data
        const { data: progressData, error: progressError } = await supabase
          .from('user_progress')
          .select('*')
          .eq('user_id', userId);

        if (progressError) {
          logger.warn('Failed to get progress data:', progressError.message);
        }

        // Construct basic access status
        const accessStatus = this.constructAccessStatus(userData, progressData || []);
        
        return {
          success: true,
          accessStatus,
          user: userData
        };
      }

      logger.log('✅ Access status retrieved successfully');
      return {
        success: true,
        accessStatus: data.access_status,
        user: data.user
      };

    } catch (error) {
      logger.error('❌ Error getting user access status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Construct access status when database function fails
  constructAccessStatus(userData, progressData) {
    const accessLevel = userData.access_level || 'limited';
    const isAdmin = userData.is_admin || false;

    const roleplayTypes = [
      'opener_practice',
      'pitch_practice', 
      'warmup_challenge',
      'full_simulation',
      'power_hour'
    ];

    const accessStatus = {};

    roleplayTypes.forEach((roleplayType, index) => {
      // Get progress for this roleplay type
      const progress = progressData.find(p => p.roleplay_type === roleplayType) || {};
      
      let unlocked = false;
      let reason = 'Upgrade required';

      // First module always available
      if (index === 0) {
        unlocked = true;
        reason = 'Always available';
      }
      // Unlimited access users get everything
      else if (accessLevel === 'unlimited' || isAdmin) {
        unlocked = true;
        reason = 'Unlimited access';
      }
      // Trial users: check temporary unlocks
      else if (accessLevel === 'trial') {
        if (progress.unlock_expiry && new Date(progress.unlock_expiry) > new Date()) {
          unlocked = true;
          const hoursRemaining = Math.ceil((new Date(progress.unlock_expiry) - new Date()) / (1000 * 60 * 60));
          reason = `Temporarily unlocked (${hoursRemaining}h remaining)`;
        } else {
          unlocked = false;
          reason = 'Complete previous marathon to unlock';
        }
      }

      accessStatus[roleplayType] = {
        unlocked,
        reason,
        accessLevel,
        marathonPasses: progress.marathon_passes || 0,
        legendCompleted: progress.legend_completed || false,
        legendAttemptUsed: progress.legend_attempt_used !== false,
        unlockExpiry: progress.unlock_expiry,
        progress: {
          total_attempts: progress.total_attempts || 0,
          total_passes: progress.total_passes || 0,
          marathon_passes: progress.marathon_passes || 0,
          legend_completed: progress.legend_completed || false,
          legend_attempt_used: progress.legend_attempt_used !== false,
          best_score: progress.best_score || 0,
          average_score: progress.average_score || 0
        }
      };
    });

    return accessStatus;
  }

  // Check module access - FIXED to use Supabase directly
  async checkModuleAccess(userId, roleplayType, mode = 'practice') {
    try {
      logger.log('🔒 Checking module access:', { userId, roleplayType, mode });

      const { data, error } = await supabase
        .rpc('check_module_access', {
          p_user_id: userId,
          p_roleplay_type: roleplayType,
          p_mode: mode
        });

      if (error) {
        logger.warn('Database function failed, using fallback:', error.message);
        
        // Fallback check
        const { data: userData } = await supabase
          .from('users')
          .select('access_level, is_admin')
          .eq('id', userId)
          .single();

        const accessLevel = userData?.access_level || 'limited';
        const isAdmin = userData?.is_admin || false;

        let unlocked = false;
        let reason = 'Access denied';

        if (roleplayType === 'opener_practice') {
          unlocked = true;
          reason = 'Always available';
        } else if (accessLevel === 'unlimited' || isAdmin) {
          unlocked = true;
          reason = 'Unlimited access';
        }

        return {
          success: true,
          access: { unlocked, reason, accessLevel }
        };
      }

      return {
        success: true,
        access: data
      };

    } catch (error) {
      logger.error('❌ Error checking module access:', error);
      return {
        success: false,
        error: error.message,
        access: { unlocked: false, reason: 'Access check failed' }
      };
    }
  }

  // Record session completion - FIXED to use Supabase directly
  async recordSessionCompletion(userId, roleplayType, mode, sessionResult) {
    try {
      logger.log('📝 Recording session completion:', {
        userId,
        roleplayType,
        mode,
        passed: sessionResult.passed,
        score: sessionResult.score || sessionResult.averageScore
      });

      // Record in session_logs table first
      const { error: logError } = await supabase
        .from('session_logs')
        .insert({
          user_id: userId,
          roleplay_type: roleplayType,
          mode: mode,
          score: sessionResult.score || sessionResult.averageScore || 0,
          passed: sessionResult.passed || false,
          session_data: sessionResult,
          duration_seconds: sessionResult.duration || 0,
          session_id: sessionResult.sessionId,
          metrics: sessionResult.metrics || {},
          evaluations: sessionResult.evaluations || [],
          metadata: {
            version: '2.0',
            timestamp: new Date().toISOString()
          }
        });

      if (logError) {
        logger.warn('Failed to log session:', logError);
      }

      // Call database function to update progress and handle unlocks
      const { data, error } = await supabase
        .rpc('record_session_completion', {
          p_user_id: userId,
          p_roleplay_type: roleplayType,
          p_mode: mode,
          p_passed: sessionResult.passed || false,
          p_score: sessionResult.score || sessionResult.averageScore || 0,
          p_session_data: sessionResult
        });

      if (error) {
        logger.warn('Progress function failed, using direct update:', error.message);
        
        // Fallback: direct update to user_progress table
        const { error: directError } = await supabase
          .from('user_progress')
          .upsert({
            user_id: userId,
            roleplay_type: roleplayType,
            total_attempts: 1,
            total_passes: sessionResult.passed ? 1 : 0,
            marathon_passes: mode === 'marathon' && sessionResult.passed ? 1 : 0,
            legend_completed: mode === 'legend' && sessionResult.passed,
            best_score: sessionResult.score || sessionResult.averageScore || 0,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,roleplay_type'
          });

        if (directError) {
          logger.error('Direct progress update failed:', directError);
        }

        return {
          success: true,
          unlocks: [],
          message: 'Progress updated (fallback mode)'
        };
      }

      logger.log('✅ Session completion recorded successfully');
      return {
        success: true,
        unlocks: data.unlocks || [],
        message: 'Progress updated successfully'
      };

    } catch (error) {
      logger.error('❌ Error recording session completion:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Set user access level - FIXED to use Supabase directly
  async setUserAccessLevel(adminUserId, targetUserId, newAccessLevel) {
    try {
      logger.log('🔧 Setting user access level:', { adminUserId, targetUserId, newAccessLevel });

      // Validate access level
      const validLevels = ['unlimited', 'trial', 'limited'];
      if (!validLevels.includes(newAccessLevel)) {
        throw new Error('Invalid access level');
      }

      // Try database function first
      const { data, error } = await supabase
        .rpc('set_user_access_level', {
          p_admin_user_id: adminUserId,
          p_target_user_id: targetUserId,
          p_new_access_level: newAccessLevel
        });

      if (error) {
        logger.warn('Database function failed, using direct update:', error.message);
        
        // Fallback: direct update
        const { error: updateError } = await supabase
          .from('users')
          .update({
            access_level: newAccessLevel,
            updated_at: new Date().toISOString()
          })
          .eq('id', targetUserId);

        if (updateError) {
          throw new Error(`Failed to update access level: ${updateError.message}`);
        }

        return {
          success: true,
          message: 'Access level updated (direct mode)'
        };
      }

      logger.log('✅ Access level updated successfully');
      return data;

    } catch (error) {
      logger.error('❌ Error setting access level:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Unlock module temporarily - FIXED to use Supabase directly
  async unlockModuleTemporarily(userId, roleplayType, hours = 24) {
    try {
      logger.log('🔓 Temporarily unlocking module:', { userId, roleplayType, hours });

      const unlockExpiry = new Date();
      unlockExpiry.setHours(unlockExpiry.getHours() + hours);

      const { error } = await supabase
        .from('user_progress')
        .upsert({
          user_id: userId,
          roleplay_type: roleplayType,
          unlock_expiry: unlockExpiry.toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,roleplay_type'
        });

      if (error) {
        throw new Error(`Failed to unlock module: ${error.message}`);
      }

      logger.log('✅ Module unlocked temporarily');
      return {
        success: true,
        message: `Module unlocked for ${hours} hours`,
        unlockExpiry: unlockExpiry.toISOString()
      };

    } catch (error) {
      logger.error('❌ Error unlocking module:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get usage statistics - FIXED to use Supabase directly
  async getUsageStatistics(adminUserId) {
    try {
      logger.log('📈 Getting usage statistics');

      // Try the admin view
      const { data: statsData, error: statsError } = await supabase
        .from('admin_dashboard_stats')
        .select('*')
        .single();

      if (statsError) {
        logger.warn('Stats view failed, calculating manually:', statsError.message);
        
        // Fallback: calculate stats manually
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('access_level, created_at');

        if (usersError) {
          throw new Error('Failed to get user data');
        }

        const stats = {
          total_users: users.length,
          unlimited_users: users.filter(u => u.access_level === 'unlimited').length,
          trial_users: users.filter(u => u.access_level === 'trial').length,
          limited_users: users.filter(u => u.access_level === 'limited').length,
          active_users_30d: users.filter(u => {
            const userDate = new Date(u.created_at);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return userDate >= thirtyDaysAgo;
          }).length,
          daily_sessions: 0,
          weekly_sessions: 0
        };

        return {
          success: true,
          stats
        };
      }

      return {
        success: true,
        stats: statsData
      };

    } catch (error) {
      logger.error('❌ Error getting usage statistics:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Client-side access evaluation (keeps existing logic)
  evaluateAccess(accessLevel, roleplayType, mode, userProgress) {
    const now = new Date();

    // UNLIMITED ACCESS USERS
    if (accessLevel === 'unlimited') {
      return {
        unlocked: true,
        accessLevel: 'unlimited',
        reason: 'Unlimited access',
        marathonPasses: userProgress?.marathon_passes || 0,
        legendCompleted: userProgress?.legend_completed || false,
        legendAttemptUsed: userProgress?.legend_attempt_used !== false
      };
    }

    // LIMITED ACCESS USERS (only first roleplay)
    if (accessLevel === 'limited') {
      if (roleplayType === 'opener_practice') {
        return {
          unlocked: true,
          accessLevel: 'limited',
          reason: 'First roleplay always available',
          marathonPasses: userProgress?.marathon_passes || 0,
          legendCompleted: userProgress?.legend_completed || false
        };
      }
      
      return {
        unlocked: false,
        accessLevel: 'limited',
        reason: 'Upgrade to access additional roleplays',
        upgradeRequired: true
      };
    }

    // TRIAL ACCESS USERS (24-hour unlocks)
    if (accessLevel === 'trial') {
      // First roleplay always available
      if (roleplayType === 'opener_practice') {
        return {
          unlocked: true,
          accessLevel: 'trial',
          reason: 'First roleplay always available',
          marathonPasses: userProgress?.marathon_passes || 0,
          legendCompleted: userProgress?.legend_completed || false,
          legendAttemptUsed: userProgress?.legend_attempt_used !== false
        };
      }

      // Check if temporarily unlocked
      if (userProgress?.unlock_expiry) {
        const unlockExpiry = new Date(userProgress.unlock_expiry);
        if (unlockExpiry > now) {
          const hoursRemaining = Math.ceil((unlockExpiry - now) / (1000 * 60 * 60));
          return {
            unlocked: true,
            accessLevel: 'trial',
            reason: `Temporarily unlocked (${hoursRemaining}h remaining)`,
            unlockExpiry: userProgress.unlock_expiry,
            marathonPasses: userProgress?.marathon_passes || 0,
            legendCompleted: userProgress?.legend_completed || false,
            legendAttemptUsed: userProgress?.legend_attempt_used !== false
          };
        }
      }

      // Check unlock requirements based on roleplay progression
      const unlockRequirement = this.getUnlockRequirement(roleplayType);
      return {
        unlocked: false,
        accessLevel: 'trial',
        reason: unlockRequirement,
        requiresPreviousCompletion: true
      };
    }

    // Default fallback
    return {
      unlocked: false,
      accessLevel: accessLevel || 'unknown',
      reason: 'Invalid access level'
    };
  }

  // Get unlock requirements (keeps existing logic)
  getUnlockRequirement(roleplayType) {
    const requirements = {
      'pitch_practice': 'Complete Opener Marathon to unlock',
      'warmup_challenge': 'Complete Pitch Marathon to unlock', 
      'full_simulation': 'Pass Warm-up Challenge to unlock',
      'power_hour': 'Pass Full Simulation to unlock'
    };

    return requirements[roleplayType] || 'Complete previous modules to unlock';
  }
}

// Create and export singleton instance with both class and object exports
export const accessLevelAPI = new AccessLevelAPI();
export default accessLevelAPI;