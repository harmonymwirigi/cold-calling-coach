// src/services/progressTracker.js - COMPLETE PROGRESS TRACKING PER CLIENT SPECS
import { supabase } from '../config/supabase';
import logger from '../utils/logger';

export class ProgressTracker {
  constructor() {
    this.moduleDefinitions = this.initializeModuleDefinitions();
  }

  // Initialize module definitions per client specifications
  initializeModuleDefinitions() {
    return {
      'opener_practice': {
        name: 'Opener + Early Objections',
        order: 1,
        alwaysAvailable: true,
        modes: ['practice', 'marathon', 'legend'],
        passingCriteria: {
          practice: { averageScore: 3 },
          marathon: { passedCalls: 6, totalCalls: 10 },
          legend: { passedCalls: 6, totalCalls: 6 }
        },
        unlocks: {
          marathon: {
            modules: ['pitch_practice'],
            duration: 24, // hours
            grantsLegendAttempt: true
          }
        }
      },
      'pitch_practice': {
        name: 'Pitch + Objections + Close',
        order: 2,
        requiresUnlock: true,
        modes: ['practice', 'marathon', 'legend'],
        passingCriteria: {
          practice: { averageScore: 3 },
          marathon: { passedCalls: 6, totalCalls: 10 },
          legend: { passedCalls: 6, totalCalls: 6 }
        },
        unlocks: {
          marathon: {
            modules: ['warmup_challenge'],
            duration: 24,
            grantsLegendAttempt: true
          }
        }
      },
      'warmup_challenge': {
        name: 'Warm-up Challenge',
        order: 3,
        requiresUnlock: true,
        modes: ['practice'],
        passingCriteria: {
          practice: { correctAnswers: 18, totalQuestions: 25 }
        },
        unlocks: {
          practice: {
            modules: ['full_simulation'],
            duration: 24
          }
        }
      },
      'full_simulation': {
        name: 'Full Cold Call Simulation',
        order: 4,
        requiresUnlock: true,
        modes: ['practice'],
        passingCriteria: {
          practice: { averageScore: 3 }
        },
        unlocks: {
          practice: {
            modules: ['power_hour'],
            duration: 24
          }
        }
      },
      'power_hour': {
        name: 'Power Hour Challenge',
        order: 5,
        requiresUnlock: true,
        modes: ['practice'],
        passingCriteria: {
          practice: { completed: true } // Always passes, tracks meetings booked
        }
      }
    };
  }

  // Check if user can access a specific roleplay module
  async checkModuleAccess(userId, roleplayType, mode = 'practice') {
    try {
      logger.log('🔒 Checking module access:', { userId, roleplayType, mode });

      // Get user's current progress and access status
      const userProgress = await this.getUserProgress(userId);
      const moduleDefinition = this.moduleDefinitions[roleplayType];

      if (!moduleDefinition) {
        return {
          allowed: false,
          reason: 'Invalid roleplay type',
          accessInfo: {}
        };
      }

      // Check if module is always available
      if (moduleDefinition.alwaysAvailable) {
        return {
          allowed: true,
          reason: 'Always available',
          accessInfo: {
            accessLevel: userProgress.accessLevel,
            unlocked: true,
            permanent: true
          }
        };
      }

      // Check user access level
      if (userProgress.accessLevel === 'unlimited') {
        return {
          allowed: true,
          reason: 'Unlimited access',
          accessInfo: {
            accessLevel: 'unlimited',
            unlocked: true,
            permanent: true
          }
        };
      }

      // For non-unlimited users, check unlock status
      const moduleProgress = userProgress.modules[roleplayType];
      const now = new Date();

      // Check temporary unlock
      if (moduleProgress?.unlockExpiry) {
        const unlockExpiry = new Date(moduleProgress.unlockExpiry);
        if (unlockExpiry > now) {
          const hoursRemaining = Math.ceil((unlockExpiry - now) / (1000 * 60 * 60));
          return {
            allowed: true,
            reason: `Temporarily unlocked (${hoursRemaining}h remaining)`,
            accessInfo: {
              accessLevel: userProgress.accessLevel,
              unlocked: true,
              temporary: true,
              unlockExpiry: moduleProgress.unlockExpiry,
              hoursRemaining
            }
          };
        }
      }

      // Check legend mode access
      if (mode === 'legend') {
        if (!moduleProgress?.legendAttemptAvailable) {
          return {
            allowed: false,
            reason: 'Pass Marathon mode to unlock Legend attempt',
            accessInfo: {
              accessLevel: userProgress.accessLevel,
              unlocked: false,
              requiresMarathonPass: true
            }
          };
        }
      }

      // Module is locked
      const unlockRequirement = this.getUnlockRequirement(roleplayType);
      return {
        allowed: false,
        reason: unlockRequirement,
        accessInfo: {
          accessLevel: userProgress.accessLevel,
          unlocked: false,
          requiresUnlock: true,
          unlockRequirement
        }
      };

    } catch (error) {
      logger.error('❌ Error checking module access:', error);
      return {
        allowed: false,
        reason: 'Access check failed',
        accessInfo: {}
      };
    }
  }

  // Get comprehensive user progress
  async getUserProgress(userId) {
    try {
      // Get user basic info
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('access_level, is_admin')
        .eq('id', userId)
        .single();

      if (userError) {
        throw new Error(`Failed to get user data: ${userError.message}`);
      }

      // Get user progress for all modules
      const { data: progressData, error: progressError } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId);

      if (progressError) {
        logger.warn('Failed to get progress data:', progressError);
      }

      // Organize progress by module
      const modules = {};
      if (progressData) {
        progressData.forEach(progress => {
          modules[progress.roleplay_type] = {
            totalAttempts: progress.total_attempts || 0,
            totalPasses: progress.total_passes || 0,
            marathonPasses: progress.marathon_passes || 0,
            legendCompleted: progress.legend_completed || false,
            legendAttemptAvailable: !progress.legend_attempt_used,
            bestScore: progress.best_score || 0,
            averageScore: progress.average_score || 0,
            unlockExpiry: progress.unlock_expiry,
            lastAttempt: progress.updated_at
          };
        });
      }

      return {
        accessLevel: userData.access_level || 'limited',
        isAdmin: userData.is_admin || false,
        modules
      };

    } catch (error) {
      logger.error('❌ Error getting user progress:', error);
      return {
        accessLevel: 'limited',
        isAdmin: false,
        modules: {}
      };
    }
  }

  // Record session completion and handle unlocks
  async recordSessionCompletion(userId, roleplayType, mode, sessionResult) {
    try {
      logger.log('📝 Recording session completion:', {
        userId,
        roleplayType,
        mode,
        passed: sessionResult.passed,
        score: sessionResult.averageScore
      });

      // Determine if session passed based on criteria
      const moduleDefinition = this.moduleDefinitions[roleplayType];
      const passingCriteria = moduleDefinition?.passingCriteria?.[mode];
      
      let sessionPassed = false;
      if (passingCriteria) {
        sessionPassed = this.evaluateSessionPassed(sessionResult, passingCriteria);
      }

      // Update user progress in database
      await this.updateUserProgress(userId, roleplayType, mode, sessionResult, sessionPassed);

      // Handle unlocks if session passed
      let unlocks = [];
      if (sessionPassed && moduleDefinition.unlocks?.[mode]) {
        unlocks = await this.processUnlocks(userId, roleplayType, mode, moduleDefinition.unlocks[mode]);
      }

      // Log session in session_logs table
      await this.logSession(userId, roleplayType, mode, sessionResult, sessionPassed);

      return {
        success: true,
        sessionPassed,
        unlocks,
        message: sessionPassed ? 'Session completed successfully!' : 'Session completed. Keep practicing!'
      };

    } catch (error) {
      logger.error('❌ Error recording session completion:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Evaluate if session passed based on criteria
  evaluateSessionPassed(sessionResult, criteria) {
    // Check average score requirement
    if (criteria.averageScore && sessionResult.averageScore < criteria.averageScore) {
      return false;
    }

    // Check passed calls requirement (marathon/legend)
    if (criteria.passedCalls && sessionResult.passedCalls < criteria.passedCalls) {
      return false;
    }

    // Check correct answers requirement (warmup challenge)
    if (criteria.correctAnswers && sessionResult.correctAnswers < criteria.correctAnswers) {
      return false;
    }

    // Check completion requirement (power hour)
    if (criteria.completed && !sessionResult.completed) {
      return false;
    }

    return true;
  }

  // Update user progress in database
  async updateUserProgress(userId, roleplayType, mode, sessionResult, sessionPassed) {
    try {
      // Get current progress
      const { data: currentProgress, error: getError } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('roleplay_type', roleplayType)
        .single();

      let progressData = {
        user_id: userId,
        roleplay_type: roleplayType,
        total_attempts: 1,
        total_passes: sessionPassed ? 1 : 0,
        marathon_passes: (mode === 'marathon' && sessionPassed) ? 1 : 0,
        legend_completed: (mode === 'legend' && sessionPassed),
        best_score: sessionResult.averageScore || 0,
        average_score: sessionResult.averageScore || 0,
        updated_at: new Date().toISOString()
      };

      // Update existing progress
      if (currentProgress && !getError) {
        progressData = {
          ...progressData,
          total_attempts: (currentProgress.total_attempts || 0) + 1,
          total_passes: (currentProgress.total_passes || 0) + (sessionPassed ? 1 : 0),
          marathon_passes: mode === 'marathon' && sessionPassed 
            ? (currentProgress.marathon_passes || 0) + 1 
            : (currentProgress.marathon_passes || 0),
          legend_completed: (mode === 'legend' && sessionPassed) || currentProgress.legend_completed,
          best_score: Math.max(currentProgress.best_score || 0, sessionResult.averageScore || 0),
          average_score: this.calculateNewAverage(
            currentProgress.average_score || 0,
            currentProgress.total_attempts || 0,
            sessionResult.averageScore || 0
          )
        };

        // Reset legend attempt if marathon passed
        if (mode === 'marathon' && sessionPassed) {
          progressData.legend_attempt_used = false;
        }

        // Mark legend attempt as used if starting legend
        if (mode === 'legend') {
          progressData.legend_attempt_used = true;
        }
      }

      // Upsert progress
      const { error: upsertError } = await supabase
        .from('user_progress')
        .upsert(progressData, {
          onConflict: 'user_id,roleplay_type'
        });

      if (upsertError) {
        throw new Error(`Failed to update progress: ${upsertError.message}`);
      }

      logger.log('✅ User progress updated successfully');

    } catch (error) {
      logger.error('❌ Error updating user progress:', error);
      throw error;
    }
  }

  // Process unlocks when session passes
  async processUnlocks(userId, roleplayType, mode, unlockConfig) {
    try {
      const unlocks = [];
      const unlockExpiry = new Date();
      unlockExpiry.setHours(unlockExpiry.getHours() + unlockConfig.duration);

      // Unlock specified modules
      for (const moduleToUnlock of unlockConfig.modules) {
        const { error } = await supabase
          .from('user_progress')
          .upsert({
            user_id: userId,
            roleplay_type: moduleToUnlock,
            unlock_expiry: unlockExpiry.toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,roleplay_type'
          });

        if (error) {
          logger.warn(`Failed to unlock module ${moduleToUnlock}:`, error);
        } else {
          unlocks.push({
            module: moduleToUnlock,
            name: this.moduleDefinitions[moduleToUnlock]?.name || moduleToUnlock,
            duration: unlockConfig.duration,
            unlockExpiry: unlockExpiry.toISOString()
          });
        }
      }

      // Grant legend attempt if specified
      if (unlockConfig.grantsLegendAttempt) {
        const { error } = await supabase
          .from('user_progress')
          .update({
            legend_attempt_used: false,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('roleplay_type', roleplayType);

        if (!error) {
          unlocks.push({
            module: roleplayType,
            type: 'legend_attempt',
            name: 'Legend Mode Attempt',
            description: 'You can now attempt Legend Mode'
          });
        }
      }

      logger.log('🔓 Unlocks processed:', unlocks);
      return unlocks;

    } catch (error) {
      logger.error('❌ Error processing unlocks:', error);
      return [];
    }
  }

  // Log session in session_logs table
  async logSession(userId, roleplayType, mode, sessionResult, sessionPassed) {
    try {
      const sessionData = {
        user_id: userId,
        roleplay_type: roleplayType,
        mode: mode,
        score: sessionResult.averageScore || 0,
        passed: sessionPassed,
        session_data: {
          ...sessionResult,
          clientSpecsVersion: '1.0',
          timestamp: new Date().toISOString()
        },
        duration_seconds: sessionResult.duration || 0,
        session_id: sessionResult.sessionId || `session_${Date.now()}`,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('session_logs')
        .insert(sessionData);

      if (error) {
        logger.warn('Failed to log session:', error);
      }

    } catch (error) {
      logger.warn('Error logging session:', error);
    }
  }

  // Get unlock requirement message
  getUnlockRequirement(roleplayType) {
    const requirements = {
      'pitch_practice': 'Complete Opener Marathon (6/10 passes) to unlock',
      'warmup_challenge': 'Complete Pitch Marathon (6/10 passes) to unlock',
      'full_simulation': 'Pass Warm-up Challenge (18/25) to unlock',
      'power_hour': 'Pass Full Simulation to unlock'
    };

    return requirements[roleplayType] || 'Complete previous modules to unlock';
  }

  // Calculate new average score
  calculateNewAverage(currentAverage, totalAttempts, newScore) {
    if (totalAttempts === 0) return newScore;
    return ((currentAverage * totalAttempts) + newScore) / (totalAttempts + 1);
  }

  // Get user's overall statistics
  async getUserStats(userId) {
    try {
      const { data: sessions, error } = await supabase
        .from('session_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to get sessions: ${error.message}`);
      }

      const stats = {
        totalSessions: sessions.length,
        totalHours: sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / 3600,
        practicesCompleted: sessions.filter(s => s.mode === 'practice' && s.passed).length,
        marathonsCompleted: sessions.filter(s => s.mode === 'marathon' && s.passed).length,
        legendsCompleted: sessions.filter(s => s.mode === 'legend' && s.passed).length,
        averageScore: sessions.length > 0 
          ? sessions.reduce((sum, s) => sum + (s.score || 0), 0) / sessions.length 
          : 0
      };

      return stats;

    } catch (error) {
      logger.error('❌ Error getting user stats:', error);
      return {
        totalSessions: 0,
        totalHours: 0,
        practicesCompleted: 0,
        marathonsCompleted: 0,
        legendsCompleted: 0,
        averageScore: 0
      };
    }
  }

  // Get recent activity
  async getRecentActivity(userId, limit = 10) {
    try {
      const { data: sessions, error } = await supabase
        .from('session_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to get recent activity: ${error.message}`);
      }

      return sessions.map(session => ({
        id: session.id,
        roleplayType: session.roleplay_type,
        mode: session.mode,
        passed: session.passed,
        score: session.score,
        createdAt: session.created_at,
        timeAgo: this.getTimeAgo(session.created_at)
      }));

    } catch (error) {
      logger.error('❌ Error getting recent activity:', error);
      return [];
    }
  }

  // Helper function to calculate time ago
  getTimeAgo(dateString) {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 0) {
      return `${diffDays}d ago`;
    } else if (diffHours > 0) {
      return `${diffHours}h ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes}m ago`;
    } else {
      return 'Just now';
    }
  }

  // Admin function to manually unlock modules
  async unlockModuleTemporarily(adminUserId, targetUserId, roleplayType, hours = 24) {
    try {
      // Verify admin status
      const { data: adminData, error: adminError } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', adminUserId)
        .single();

      if (adminError || !adminData?.is_admin) {
        throw new Error('Insufficient permissions');
      }

      const unlockExpiry = new Date();
      unlockExpiry.setHours(unlockExpiry.getHours() + hours);

      const { error } = await supabase
        .from('user_progress')
        .upsert({
          user_id: targetUserId,
          roleplay_type: roleplayType,
          unlock_expiry: unlockExpiry.toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,roleplay_type'
        });

      if (error) {
        throw new Error(`Failed to unlock module: ${error.message}`);
      }

      return {
        success: true,
        message: `Module ${roleplayType} unlocked for ${hours} hours`,
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

  // Get all modules with access status for a user
  async getAllModulesWithAccess(userId) {
    try {
      const userProgress = await this.getUserProgress(userId);
      const modules = [];

      for (const [roleplayType, definition] of Object.entries(this.moduleDefinitions)) {
        const access = await this.checkModuleAccess(userId, roleplayType, 'practice');
        const progress = userProgress.modules[roleplayType] || {};

        modules.push({
          roleplayType,
          name: definition.name,
          order: definition.order,
          access,
          progress,
          modes: definition.modes || ['practice']
        });
      }

      return modules.sort((a, b) => a.order - b.order);

    } catch (error) {
      logger.error('❌ Error getting modules with access:', error);
      return [];
    }
  }
}

// Create and export singleton instance
export const progressTracker = new ProgressTracker();
export default progressTracker;