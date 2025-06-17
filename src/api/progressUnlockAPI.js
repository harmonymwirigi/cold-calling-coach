// src/api/progressUnlockAPI.js - CLIENT SPECIFICATIONS UNLOCK SYSTEM
import { supabase } from '../config/supabase';
import logger from '../utils/logger';

export class ProgressUnlockAPI {
  constructor() {
    this.moduleProgression = {
      opener_practice: {
        unlocks: 'pitch_practice',
        marathonUnlockThreshold: 6, // 6/10 passes
        legendRequirement: 'perfect' // 6/6 passes
      },
      pitch_practice: {
        unlocks: 'warmup_challenge',
        marathonUnlockThreshold: 6,
        legendRequirement: 'perfect'
      },
      warmup_challenge: {
        unlocks: 'full_simulation',
        passingScore: 18, // 18/25 correct
        type: 'quickfire'
      },
      full_simulation: {
        unlocks: 'power_hour',
        practiceUnlock: true // Pass once to unlock
      },
      power_hour: {
        unlocks: null, // Final module
        type: 'endurance'
      }
    };
  }

  // Record session completion with exact client specifications
  async recordSessionCompletion(userId, roleplayType, mode, sessionResult) {
    try {
      logger.log('📝 [PROGRESS-API] Recording session:', {
        userId,
        roleplayType,
        mode,
        passed: sessionResult.passed,
        score: sessionResult.averageScore
      });

      // Get current progress
      const currentProgress = await this.getCurrentProgress(userId, roleplayType);
      
      // Calculate new progress values
      const newProgress = this.calculateNewProgress(currentProgress, mode, sessionResult);
      
      // Update progress in database
      await this.updateProgressInDatabase(userId, roleplayType, newProgress);
      
      // Handle unlocks based on client specifications
      const unlocks = await this.handleUnlocks(userId, roleplayType, mode, newProgress, sessionResult);
      
      // Record in session logs
      await this.recordInSessionLogs(userId, roleplayType, mode, sessionResult);
      
      logger.log('✅ [PROGRESS-API] Session recorded successfully');
      
      return {
        success: true,
        unlocks,
        newProgress,
        message: this.generateProgressMessage(mode, sessionResult, unlocks)
      };

    } catch (error) {
      logger.error('❌ [PROGRESS-API] Error recording session:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get current progress for a user and roleplay type
  async getCurrentProgress(userId, roleplayType) {
    try {
      const { data, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('roleplay_type', roleplayType)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found is okay
        throw error;
      }

      return data || {
        user_id: userId,
        roleplay_type: roleplayType,
        total_attempts: 0,
        total_passes: 0,
        marathon_passes: 0,
        legend_completed: false,
        legend_attempt_used: true,
        best_score: 0,
        average_score: 0,
        unlock_expiry: null
      };
    } catch (error) {
      logger.error('❌ [PROGRESS-API] Error getting current progress:', error);
      throw error;
    }
  }

  // Calculate new progress values based on session result
  calculateNewProgress(currentProgress, mode, sessionResult) {
    const newProgress = { ...currentProgress };
    
    // Update attempt and pass counts
    newProgress.total_attempts = (currentProgress.total_attempts || 0) + 1;
    if (sessionResult.passed) {
      newProgress.total_passes = (currentProgress.total_passes || 0) + 1;
    }
    
    // Update mode-specific progress
    if (mode === 'marathon' && sessionResult.passed) {
      newProgress.marathon_passes = (currentProgress.marathon_passes || 0) + 1;
      // Reset legend attempt when marathon is passed per client specs
      newProgress.legend_attempt_used = false;
    }
    
    if (mode === 'legend') {
      newProgress.legend_attempt_used = true;
      if (sessionResult.passed) {
        newProgress.legend_completed = true;
      }
    }
    
    // Update scores
    if (sessionResult.averageScore) {
      newProgress.best_score = Math.max(currentProgress.best_score || 0, sessionResult.averageScore);
      
      // Calculate running average
      const totalSessions = newProgress.total_attempts;
      const currentAvg = currentProgress.average_score || 0;
      newProgress.average_score = ((currentAvg * (totalSessions - 1)) + sessionResult.averageScore) / totalSessions;
    }
    
    newProgress.updated_at = new Date().toISOString();
    
    return newProgress;
  }

  // Update progress in database
  async updateProgressInDatabase(userId, roleplayType, progressData) {
    try {
      const { error } = await supabase
        .from('user_progress')
        .upsert(progressData, {
          onConflict: 'user_id,roleplay_type'
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      logger.error('❌ [PROGRESS-API] Error updating progress in database:', error);
      throw error;
    }
  }

  // Handle unlocks according to client specifications
  async handleUnlocks(userId, roleplayType, mode, newProgress, sessionResult) {
    const unlocks = [];
    const moduleConfig = this.moduleProgression[roleplayType];
    
    if (!moduleConfig || !moduleConfig.unlocks) {
      return unlocks; // No unlocks for this module
    }

    try {
      // Check unlock conditions based on module type and mode
      let shouldUnlock = false;
      let unlockDuration = null;
      let unlockReason = '';

      switch (roleplayType) {
        case 'opener_practice':
        case 'pitch_practice':
          if (mode === 'marathon' && this.checkMarathonPass(newProgress, moduleConfig)) {
            shouldUnlock = true;
            unlockDuration = 24; // 24 hours per client specs
            unlockReason = `Marathon passed (${newProgress.marathon_passes} total)`;
          }
          break;

        case 'warmup_challenge':
          if (sessionResult.passed && sessionResult.metrics?.correctAnswers >= moduleConfig.passingScore) {
            shouldUnlock = true;
            unlockDuration = 24; // 24 hours per client specs
            unlockReason = `Warm-up challenge passed (${sessionResult.metrics.correctAnswers}/25)`;
          }
          break;

        case 'full_simulation':
          if (sessionResult.passed) {
            shouldUnlock = true;
            unlockDuration = 24; // 24 hours per client specs
            unlockReason = 'Full simulation completed';
          }
          break;
      }

      if (shouldUnlock) {
        const unlockResult = await this.unlockModule(
          userId, 
          moduleConfig.unlocks, 
          unlockDuration, 
          unlockReason
        );
        
        if (unlockResult.success) {
          unlocks.push(unlockResult.unlock);
        }
      }

    } catch (error) {
      logger.error('❌ [PROGRESS-API] Error handling unlocks:', error);
    }

    return unlocks;
  }

  // Check if marathon passes threshold per client specs
  checkMarathonPass(progress, moduleConfig) {
    // Client spec: ≥ 6/10 calls passed in marathon mode unlocks next module
    return progress.marathon_passes >= moduleConfig.marathonUnlockThreshold;
  }

  // Unlock a module with expiry time
  async unlockModule(userId, moduleToUnlock, hours, reason) {
    try {
      const unlockExpiry = new Date();
      unlockExpiry.setHours(unlockExpiry.getHours() + hours);

      // Get or create progress entry for the module to unlock
      const currentModuleProgress = await this.getCurrentProgress(userId, moduleToUnlock);
      
      const unlockData = {
        ...currentModuleProgress,
        unlock_expiry: unlockExpiry.toISOString(),
        updated_at: new Date().toISOString()
      };

      await this.updateProgressInDatabase(userId, moduleToUnlock, unlockData);

      const unlock = {
        module: moduleToUnlock,
        duration: `${hours} hours`,
        reason,
        expiresAt: unlockExpiry.toISOString()
      };

      logger.log('🔓 [PROGRESS-API] Module unlocked:', unlock);

      return {
        success: true,
        unlock
      };

    } catch (error) {
      logger.error('❌ [PROGRESS-API] Error unlocking module:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Record session in logs
  async recordInSessionLogs(userId, roleplayType, mode, sessionResult) {
    try {
      const logData = {
        user_id: userId,
        roleplay_type: roleplayType,
        mode: mode,
        passed: sessionResult.passed,
        score: sessionResult.averageScore || 0,
        session_data: sessionResult,
        duration_seconds: sessionResult.duration || 0,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('session_logs')
        .insert(logData);

      if (error) {
        logger.warn('Failed to record session log:', error);
      }
    } catch (error) {
      logger.warn('Error recording session log:', error);
    }
  }

  // Generate progress message per client specifications
  generateProgressMessage(mode, sessionResult, unlocks) {
    if (!sessionResult.passed) {
      return this.getFailureMessage(mode, sessionResult);
    }

    if (unlocks.length > 0) {
      return this.getUnlockMessage(mode, sessionResult, unlocks);
    }

    return this.getPassMessage(mode, sessionResult);
  }

  getFailureMessage(mode, sessionResult) {
    const messages = {
      practice: "Keep practicing to improve your skills. Try again when you're ready!",
      marathon: `You completed all calls and scored ${sessionResult.metrics?.passedCalls || 0}/${sessionResult.metrics?.totalCalls || 10}. Keep practicing—the more reps you get, the easier it becomes. Ready to try Marathon again?`,
      legend: "Legend attempt over this time. To earn another shot, just pass Marathon again. Meanwhile, keep practicing your skills!"
    };

    return messages[mode] || messages.practice;
  }

  getUnlockMessage(mode, sessionResult, unlocks) {
    const unlock = unlocks[0];
    const moduleName = this.getModuleDisplayName(unlock.module);

    if (mode === 'marathon') {
      return `Nice work—you passed ${sessionResult.metrics?.passedCalls || 6} out of ${sessionResult.metrics?.totalCalls || 10}! You've unlocked ${moduleName} and earned one shot at Legend Mode. Want to go for Legend now or continue practicing?`;
    }

    return `Congratulations! You've unlocked ${moduleName} for the next ${unlock.duration}. Great job completing this challenge!`;
  }

  getPassMessage(mode, sessionResult) {
    const messages = {
      practice: "Great job! You passed this roleplay. Keep practicing to master your skills.",
      marathon: "Well done! You've completed the marathon successfully.",
      legend: "Wow—perfect score! That's legendary. Very few reps pull this off, so enjoy the bragging rights!"
    };

    return messages[mode] || messages.practice;
  }

  // Get user's current access status for all modules
  async getUserAccessStatus(userId) {
    try {
      logger.log('📊 [PROGRESS-API] Getting user access status for:', userId);

      // Get user info
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email, first_name, access_level, is_admin')
        .eq('id', userId)
        .single();

      if (userError) {
        throw userError;
      }

      // Get all progress data
      const { data: progressData, error: progressError } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId);

      if (progressError) {
        logger.warn('Failed to get progress data:', progressError);
      }

      // Build access status for each module
      const accessStatus = {};
      const moduleTypes = Object.keys(this.moduleProgression);

      moduleTypes.forEach(moduleType => {
        const progress = progressData?.find(p => p.roleplay_type === moduleType) || {};
        accessStatus[moduleType] = this.evaluateModuleAccess(userData, moduleType, progress);
      });

      return {
        success: true,
        accessStatus,
        user: userData
      };

    } catch (error) {
      logger.error('❌ [PROGRESS-API] Error getting user access status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Evaluate access for a specific module
  evaluateModuleAccess(userData, moduleType, progress) {
    const accessLevel = userData.access_level || 'limited';
    const isAdmin = userData.is_admin || false;
    const now = new Date();

    let unlocked = false;
    let reason = 'Complete previous requirements to unlock';

    // Admin and unlimited users get everything
    if (isAdmin || accessLevel === 'unlimited') {
      unlocked = true;
      reason = isAdmin ? 'Admin access' : 'Unlimited access';
    }
    // First module always available
    else if (moduleType === 'opener_practice') {
      unlocked = true;
      reason = 'Always available';
    }
    // Check temporary unlocks for trial users
    else if (accessLevel === 'trial' && progress.unlock_expiry) {
      const unlockExpiry = new Date(progress.unlock_expiry);
      if (unlockExpiry > now) {
        unlocked = true;
        const hoursRemaining = Math.ceil((unlockExpiry - now) / (1000 * 60 * 60));
        reason = `Temporarily unlocked (${hoursRemaining}h remaining)`;
      } else {
        reason = this.getUnlockRequirement(moduleType);
      }
    }
    // Limited users only get first module
    else if (accessLevel === 'limited') {
      reason = 'Upgrade to access additional modules';
    }
    // Trial users need to unlock through progression
    else {
      reason = this.getUnlockRequirement(moduleType);
    }

    return {
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
  }

  // Get unlock requirements for modules per client specs
  getUnlockRequirement(moduleType) {
    const requirements = {
      pitch_practice: 'Complete Opener Marathon (6/10 passes) to unlock',
      warmup_challenge: 'Complete Pitch Marathon (6/10 passes) to unlock',
      full_simulation: 'Pass Warm-up Challenge (18/25) to unlock',
      power_hour: 'Complete Full Simulation to unlock'
    };

    return requirements[moduleType] || 'Complete previous modules to unlock';
  }

  // Get display name for modules
  getModuleDisplayName(moduleType) {
    const names = {
      opener_practice: 'Opener + Early Objections',
      pitch_practice: 'Pitch + Objections + Close',
      warmup_challenge: 'Warm-up Challenge',
      full_simulation: 'Full Cold Call Simulation',
      power_hour: 'Power Hour Challenge'
    };

    return names[moduleType] || moduleType;
  }

  // Check if user can access a specific roleplay mode
  async checkModuleAccess(userId, roleplayType, mode = 'practice') {
    try {
      const accessStatus = await this.getUserAccessStatus(userId);
      
      if (!accessStatus.success) {
        return {
          success: false,
          error: accessStatus.error,
          access: { unlocked: false, reason: 'Access check failed' }
        };
      }

      const moduleAccess = accessStatus.accessStatus[roleplayType];
      
      if (!moduleAccess) {
        return {
          success: false,
          access: { unlocked: false, reason: 'Module not found' }
        };
      }

      // Additional checks for legend mode
      if (mode === 'legend') {
        if (moduleAccess.legendAttemptUsed) {
          return {
            success: true,
            access: { 
              unlocked: false, 
              reason: 'Legend attempt already used. Pass Marathon again for another chance.' 
            }
          };
        }
        
        if (moduleAccess.marathonPasses < 6) {
          return {
            success: true,
            access: { 
              unlocked: false, 
              reason: 'Need at least 6 Marathon passes to unlock Legend mode.' 
            }
          };
        }
      }

      return {
        success: true,
        access: moduleAccess
      };

    } catch (error) {
      logger.error('❌ [PROGRESS-API] Error checking module access:', error);
      return {
        success: false,
        error: error.message,
        access: { unlocked: false, reason: 'Access check failed' }
      };
    }
  }

  // Manually unlock module temporarily (admin function)
  async unlockModuleTemporarily(userId, roleplayType, hours = 24) {
    try {
      const result = await this.unlockModule(userId, roleplayType, hours, 'Manual unlock');
      return result;
    } catch (error) {
      logger.error('❌ [PROGRESS-API] Error unlocking module temporarily:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
export const progressUnlockAPI = new ProgressUnlockAPI();
export default progressUnlockAPI;