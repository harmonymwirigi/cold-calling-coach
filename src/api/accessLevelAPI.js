// src/api/accessLevelAPI.js - CLIENT-SIDE SERVICE (calls serverless functions)
import logger from '../utils/logger';

export class AccessLevelAPI {
  
  // Base URL for API calls (adjust based on your deployment)
  static getBaseURL() {
    if (process.env.NODE_ENV === 'development') {
      return 'http://localhost:3000/api';
    }
    // For production, use your Vercel domain
    return '/api';
  }

  // Check user access for specific roleplay
  static async checkModuleAccess(userId, roleplayType, mode = 'practice') {
    try {
      logger.log('🔐 Checking module access:', { userId, roleplayType, mode });

      const response = await fetch(`${this.getBaseURL()}/check-module-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          roleplayType,
          mode
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to check module access');
      }

      logger.log('✅ Access check result:', data.access);
      return data;

    } catch (error) {
      logger.error('❌ Error checking module access:', error);
      return { 
        success: false, 
        error: error.message,
        access: { unlocked: false, reason: 'Access check failed' }
      };
    }
  }

  // Set user access level (admin only)
  static async setUserAccessLevel(adminUserId, targetUserId, newAccessLevel) {
    try {
      logger.log('🔧 Setting user access level:', { adminUserId, targetUserId, newAccessLevel });

      const response = await fetch(`${this.getBaseURL()}/set-user-access-level`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminUserId,
          targetUserId,
          newAccessLevel
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to set access level');
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

  // Unlock module temporarily (24 hours)
  static async unlockModuleTemporarily(userId, roleplayType, hours = 24) {
    try {
      logger.log('🔓 Temporarily unlocking module:', { userId, roleplayType, hours });

      const response = await fetch(`${this.getBaseURL()}/unlock-module-temporarily`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          roleplayType,
          hours
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to unlock module');
      }

      logger.log('✅ Module unlocked temporarily');
      return data;

    } catch (error) {
      logger.error('❌ Error unlocking module:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // Get user's complete access status
  static async getUserAccessStatus(userId) {
    try {
      logger.log('📊 Getting user access status:', userId);

      const response = await fetch(`${this.getBaseURL()}/get-user-access-status?userId=${encodeURIComponent(userId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to get access status');
      }

      return data;

    } catch (error) {
      logger.error('❌ Error getting user access status:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // Record session completion and handle unlocks
  static async recordSessionCompletion(userId, roleplayType, mode, sessionResult) {
    try {
      logger.log('📝 Recording session completion:', { userId, roleplayType, mode, passed: sessionResult.passed });

      const response = await fetch(`${this.getBaseURL()}/record-session-completion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          roleplayType,
          mode,
          passed: sessionResult.passed,
          score: sessionResult.averageScore,
          sessionData: sessionResult.sessionData || {},
          sessionId: sessionResult.sessionId,
          duration: sessionResult.duration,
          metrics: sessionResult.metrics,
          evaluations: sessionResult.evaluations
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to record session completion');
      }

      logger.log('✅ Session completion recorded');
      return data;

    } catch (error) {
      logger.error('❌ Error recording session completion:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // Get usage statistics for admin dashboard
  static async getUsageStatistics(adminUserId) {
    try {
      logger.log('📈 Getting usage statistics');

      const response = await fetch(`${this.getBaseURL()}/get-usage-statistics?adminUserId=${encodeURIComponent(adminUserId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to get usage statistics');
      }

      return data;

    } catch (error) {
      logger.error('❌ Error getting usage statistics:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // Evaluate access based on business rules (client-side helper)
  static evaluateAccess(accessLevel, roleplayType, mode, userProgress) {
    const now = new Date();

    // UNLIMITED ACCESS USERS
    if (accessLevel === 'unlimited') {
      return {
        unlocked: true,
        accessLevel: 'unlimited',
        reason: 'Unlimited access',
        marathonPasses: userProgress?.marathon_passes || 0,
        legendCompleted: userProgress?.legend_completed || false,
        legendAttemptUsed: userProgress?.legend_attempt_used || true
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
          legendAttemptUsed: userProgress?.legend_attempt_used || true
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
            legendAttemptUsed: userProgress?.legend_attempt_used || true
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

  // Get unlock requirements based on roleplay progression
  static getUnlockRequirement(roleplayType) {
    const requirements = {
      'pitch_practice': 'Complete Opener Marathon to unlock',
      'warmup_challenge': 'Complete Pitch Marathon to unlock', 
      'full_simulation': 'Pass Warm-up Challenge to unlock',
      'power_hour': 'Pass Full Simulation to unlock'
    };

    return requirements[roleplayType] || 'Complete previous modules to unlock';
  }

  // Handle progression unlocks based on business rules
  static async handleProgressionUnlocks(userId, completedRoleplayType, completedMode) {
    const unlocks = [];

    try {
      // Define unlock rules from specifications
      const unlockRules = {
        'opener_practice': {
          'marathon': ['pitch_practice'] // Marathon pass unlocks next module for 24h
        },
        'pitch_practice': {
          'marathon': ['warmup_challenge']
        },
        'warmup_challenge': {
          'practice': ['full_simulation'] // Practice pass unlocks next module
        },
        'full_simulation': {
          'practice': ['power_hour']
        }
      };

      const modulesToUnlock = unlockRules[completedRoleplayType]?.[completedMode];
      if (!modulesToUnlock) {
        return unlocks;
      }

      // Apply unlocks
      for (const moduleToUnlock of modulesToUnlock) {
        const unlockResult = await this.unlockModuleTemporarily(userId, moduleToUnlock, 24);
        
        if (unlockResult.success) {
          unlocks.push({
            module: moduleToUnlock,
            expiresAt: unlockResult.unlockExpiry,
            message: `${moduleToUnlock} unlocked for 24 hours!`
          });
        }
      }

      logger.log('🔓 Applied progression unlocks:', unlocks);

    } catch (error) {
      logger.error('❌ Error handling progression unlocks:', error);
    }

    return unlocks;
  }
}

// Export API functions for use in components
export const accessLevelAPI = {
  checkModuleAccess: AccessLevelAPI.checkModuleAccess,
  setUserAccessLevel: AccessLevelAPI.setUserAccessLevel,
  unlockModuleTemporarily: AccessLevelAPI.unlockModuleTemporarily,
  getUserAccessStatus: AccessLevelAPI.getUserAccessStatus,
  recordSessionCompletion: AccessLevelAPI.recordSessionCompletion,
  getUsageStatistics: AccessLevelAPI.getUsageStatistics,
  evaluateAccess: AccessLevelAPI.evaluateAccess,
  handleProgressionUnlocks: AccessLevelAPI.handleProgressionUnlocks
};

export default AccessLevelAPI;