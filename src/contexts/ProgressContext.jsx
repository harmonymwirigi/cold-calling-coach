// src/contexts/ProgressContext.jsx - UPDATED FOR CLIENT SPECIFICATIONS
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { progressUnlockAPI } from '../api/progressUnlockAPI';
import { supabase } from '../config/supabase';
import logger from '../utils/logger';

const ProgressContext = createContext({});

export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgress must be used within ProgressProvider');
  }
  return context;
};

export const ProgressProvider = ({ children }) => {
  const { user, userProfile } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({});
  const [sessions, setSessions] = useState([]);
  const [accessStatus, setAccessStatus] = useState({});
  const [overallStats, setOverallStats] = useState({
    totalSessions: 0,
    totalHours: 0,
    practicesCompleted: 0,
    marathonsCompleted: 0,
    legendsCompleted: 0
  });

  // Load user progress data using new API
  const loadProgressData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      logger.log('📊 [PROGRESS-CTX] Loading progress data for user:', user.id);

      // Load user access status using new API
      const accessResult = await progressUnlockAPI.getUserAccessStatus(user.id);
      
      if (!accessResult || !accessResult.success) {
        logger.warn('Access API failed, using fallback data:', accessResult?.error);
        
        // Create fallback access status
        const fallbackAccessStatus = createFallbackAccessStatus(userProfile);
        setAccessStatus(fallbackAccessStatus);
        setProgress({});
        setSessions([]);
        calculateOverallStats({}, []);
        return;
      }

      // Safely handle accessStatus
      const safeAccessStatus = accessResult.accessStatus || {};
      setAccessStatus(safeAccessStatus);

      // Extract progress data safely
      const progressData = {};
      if (safeAccessStatus && typeof safeAccessStatus === 'object') {
        Object.keys(safeAccessStatus).forEach(roleplayType => {
          const moduleData = safeAccessStatus[roleplayType];
          if (moduleData && moduleData.progress) {
            progressData[roleplayType] = moduleData.progress;
          }
        });
      }
      setProgress(progressData);

      // Load session history with error handling
      try {
        const { data: sessionData, error: sessionError } = await supabase
          .from('session_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (sessionError) {
          logger.warn('Failed to load sessions:', sessionError);
          setSessions([]);
        } else {
          setSessions(sessionData || []);
          calculateOverallStats(progressData, sessionData || []);
        }
      } catch (sessionErr) {
        logger.warn('Session loading error:', sessionErr);
        setSessions([]);
        calculateOverallStats(progressData, []);
      }

      logger.log('✅ [PROGRESS-CTX] Progress data loaded successfully');

    } catch (err) {
      logger.error('❌ [PROGRESS-CTX] Error loading progress data:', err);
      setError(err.message);
      
      // Set fallback data to prevent crashes
      const fallbackAccessStatus = createFallbackAccessStatus(userProfile);
      setAccessStatus(fallbackAccessStatus);
      setProgress({});
      setSessions([]);
      calculateOverallStats({}, []);
    } finally {
      setLoading(false);
    }
  }, [user?.id, userProfile]);

  // Create fallback access status when API fails
  const createFallbackAccessStatus = useCallback((profile) => {
    const accessLevel = profile?.access_level || 'limited';
    const isAdmin = profile?.is_admin || false;

    const roleplayTypes = [
      'opener_practice',
      'pitch_practice', 
      'warmup_challenge',
      'full_simulation',
      'power_hour'
    ];

    const fallbackStatus = {};

    roleplayTypes.forEach((roleplayType, index) => {
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
        reason = accessLevel === 'unlimited' ? 'Unlimited access' : 'Admin access';
      }
      // Trial users get first module only by default
      else if (accessLevel === 'trial') {
        unlocked = false;
        reason = this.getUnlockRequirement(roleplayType);
      }
      // Limited users get first module only
      else {
        unlocked = false;
        reason = 'Upgrade to access additional modules';
      }

      fallbackStatus[roleplayType] = {
        unlocked,
        reason,
        accessLevel,
        marathonPasses: 0,
        legendCompleted: false,
        legendAttemptUsed: true,
        progress: {
          total_attempts: 0,
          total_passes: 0,
          marathon_passes: 0,
          legend_completed: false,
          legend_attempt_used: true,
          best_score: 0,
          average_score: 0
        }
      };
    });

    return fallbackStatus;
  }, []);

  // Get unlock requirements per client specifications
  const getUnlockRequirement = useCallback((roleplayType) => {
    const requirements = {
      pitch_practice: 'Complete Opener Marathon (6/10 passes) to unlock',
      warmup_challenge: 'Complete Pitch Marathon (6/10 passes) to unlock',
      full_simulation: 'Pass Warm-up Challenge (18/25) to unlock',
      power_hour: 'Complete Full Simulation to unlock'
    };

    return requirements[roleplayType] || 'Complete previous modules to unlock';
  }, []);

  // Calculate overall statistics with null-safety
  const calculateOverallStats = useCallback((progressData = {}, sessionData = []) => {
    const stats = {
      totalSessions: Array.isArray(sessionData) ? sessionData.length : 0,
      totalHours: Array.isArray(sessionData) 
        ? Math.round(sessionData.reduce((sum, s) => sum + (s?.duration_seconds || 0), 0) / 3600 * 10) / 10
        : 0,
      practicesCompleted: 0,
      marathonsCompleted: 0,
      legendsCompleted: 0
    };

    // Count completions from progress data safely
    if (progressData && typeof progressData === 'object') {
      Object.values(progressData).forEach(progress => {
        if (progress && typeof progress === 'object') {
          stats.practicesCompleted += progress.total_passes || 0;
          stats.marathonsCompleted += progress.marathon_passes || 0;
          if (progress.legend_completed) {
            stats.legendsCompleted++;
          }
        }
      });
    }

    setOverallStats(stats);
  }, []);

  // Get roleplay access information using new API
  const getRoleplayAccess = useCallback((roleplayType, mode = 'practice') => {
    if (!accessStatus || typeof accessStatus !== 'object') {
      return {
        unlocked: roleplayType === 'opener_practice', // First module always available
        reason: roleplayType === 'opener_practice' ? 'Always available' : 'Loading access info...',
        marathonPasses: 0,
        legendCompleted: false,
        accessLevel: 'limited'
      };
    }

    const moduleAccess = accessStatus[roleplayType];
    if (!moduleAccess || typeof moduleAccess !== 'object') {
      return {
        unlocked: roleplayType === 'opener_practice',
        reason: roleplayType === 'opener_practice' ? 'Always available' : 'Module not found',
        marathonPasses: 0,
        legendCompleted: false,
        accessLevel: 'limited'
      };
    }

    // Special handling for legend mode per client specifications
    if (mode === 'legend') {
      if (moduleAccess.legendAttemptUsed) {
        return {
          ...moduleAccess,
          unlocked: false,
          reason: 'Legend attempt used. Pass Marathon again for another chance.'
        };
      }
      
      if ((moduleAccess.marathonPasses || 0) < 6) {
        return {
          ...moduleAccess,
          unlocked: false,
          reason: 'Need 6 Marathon passes to unlock Legend mode.'
        };
      }
    }

    return moduleAccess;
  }, [accessStatus]);

  // Update progress after session completion using new API
  const updateProgress = useCallback(async (roleplayType, sessionResult) => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      logger.log('📝 [PROGRESS-CTX] Updating progress:', { roleplayType, sessionResult });

      // Record session completion via new API
      const result = await progressUnlockAPI.recordSessionCompletion(
        user.id,
        roleplayType,
        sessionResult.mode || 'practice',
        sessionResult
      );

      if (!result || !result.success) {
        logger.warn('Progress update failed:', result?.error);
        // Still return success to not break user experience
        return {
          success: true,
          unlocks: [],
          message: 'Session completed (progress update pending)'
        };
      }

      // Reload progress data to reflect changes
      await loadProgressData();

      // Return unlock information per client specifications
      return {
        success: true,
        unlocks: result.unlocks || [],
        message: result.message || 'Progress updated successfully'
      };

    } catch (error) {
      logger.error('❌ [PROGRESS-CTX] Error updating progress:', error);
      // Don't throw - return partial success to maintain user experience
      return {
        success: true,
        unlocks: [],
        message: 'Session completed (progress update failed)'
      };
    }
  }, [user?.id, loadProgressData]);

  // Get recent activity for dashboard
  const getRecentActivity = useCallback(async () => {
    try {
      if (!Array.isArray(sessions)) {
        return [];
      }

      const recentSessions = sessions.slice(0, 10).map(session => ({
        id: session?.id || 'unknown',
        roleplay_type: session?.roleplay_type || 'unknown',
        mode: session?.mode || 'practice',
        passed: session?.passed || false,
        score: session?.score || 0,
        created_at: session?.created_at || new Date().toISOString(),
        timeAgo: getTimeAgo(session?.created_at || new Date().toISOString())
      }));

      return recentSessions;
    } catch (error) {
      logger.error('Error getting recent activity:', error);
      return [];
    }
  }, [sessions]);

  // Get overall statistics
  const getOverallStats = useCallback(() => {
    return overallStats || {
      totalSessions: 0,
      totalHours: 0,
      practicesCompleted: 0,
      marathonsCompleted: 0,
      legendsCompleted: 0
    };
  }, [overallStats]);

  // Check if user can access specific roleplay using new API
  const canAccessRoleplay = useCallback(async (roleplayType, mode = 'practice') => {
    if (!user?.id) {
      return { allowed: false, reason: 'Not authenticated' };
    }

    try {
      const result = await progressUnlockAPI.checkModuleAccess(user.id, roleplayType, mode);
      return {
        allowed: result?.success && result?.access?.unlocked,
        reason: result?.access?.reason || 'Access denied',
        accessInfo: result?.access || {}
      };
    } catch (error) {
      logger.error('Error checking roleplay access:', error);
      // Fallback: allow first module
      return { 
        allowed: roleplayType === 'opener_practice', 
        reason: roleplayType === 'opener_practice' ? 'Always available' : 'Access check failed'
      };
    }
  }, [user?.id]);

  // Unlock module temporarily (admin function)
  const unlockModuleTemporarily = useCallback(async (roleplayType, hours = 24) => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      const result = await progressUnlockAPI.unlockModuleTemporarily(user.id, roleplayType, hours);
      
      if (result?.success) {
        // Reload progress to reflect changes
        await loadProgressData();
      }

      return result || { success: false, error: 'Unknown error' };
    } catch (error) {
      logger.error('Error unlocking module:', error);
      throw error;
    }
  }, [user?.id, loadProgressData]);

  // Get user access level safely
  const getUserAccessLevel = useCallback(() => {
    return userProfile?.access_level || 'limited';
  }, [userProfile]);

  // Get module display names per client specifications
  const getModuleDisplayName = useCallback((roleplayType) => {
    const names = {
      opener_practice: 'Opener + Early Objections',
      pitch_practice: 'Pitch + Objections + Close',
      warmup_challenge: 'Warm-up Challenge',
      full_simulation: 'Full Cold Call Simulation',
      power_hour: 'Power Hour Challenge'
    };

    return names[roleplayType] || roleplayType;
  }, []);

  // Get unlock status with time remaining
  const getUnlockStatus = useCallback((roleplayType) => {
    const moduleAccess = accessStatus[roleplayType];
    if (!moduleAccess) return null;

    if (!moduleAccess.unlockExpiry) return null;

    const now = new Date();
    const unlockExpiry = new Date(moduleAccess.unlockExpiry);
    
    if (unlockExpiry <= now) {
      return { expired: true };
    }

    const hoursRemaining = Math.ceil((unlockExpiry - now) / (1000 * 60 * 60));
    const minutesRemaining = Math.ceil((unlockExpiry - now) / (1000 * 60));

    return {
      active: true,
      hoursRemaining,
      minutesRemaining,
      expiresAt: unlockExpiry.toISOString()
    };
  }, [accessStatus]);

  // Helper function to format time ago
  const getTimeAgo = (dateString) => {
    try {
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
    } catch (error) {
      return 'Recently';
    }
  };

  // Load data when user changes
  useEffect(() => {
    if (user?.id) {
      loadProgressData();
    }
  }, [user?.id, loadProgressData]);

  // Set up real-time subscriptions for progress updates
  useEffect(() => {
    if (!user?.id) return;

    logger.log('📡 [PROGRESS-CTX] Setting up real-time progress subscriptions');

    const subscriptions = [];

    try {
      // Subscribe to user progress changes
      const progressSubscription = supabase
        .channel('progress_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_progress',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            logger.log('📡 Progress update received:', payload);
            // Reload progress data when changes occur
            loadProgressData();
          }
        )
        .subscribe();

      subscriptions.push(progressSubscription);

      // Subscribe to session log changes
      const sessionSubscription = supabase
        .channel('session_changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'session_logs',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            logger.log('📡 New session logged:', payload);
            // Add new session to local state
            if (payload?.new) {
              setSessions(prev => Array.isArray(prev) ? [payload.new, ...prev] : [payload.new]);
            }
          }
        )
        .subscribe();

      subscriptions.push(sessionSubscription);
    } catch (error) {
      logger.warn('Failed to set up real-time subscriptions:', error);
    }

    return () => {
      logger.log('📡 Cleaning up real-time subscriptions');
      subscriptions.forEach(sub => {
        try {
          supabase.removeChannel(sub);
        } catch (error) {
          logger.warn('Error removing subscription:', error);
        }
      });
    };
  }, [user?.id, loadProgressData]);

  const value = {
    // State
    loading,
    error,
    progress: progress || {},
    sessions: sessions || [],
    accessStatus: accessStatus || {},
    overallStats: overallStats || {},

    // Functions
    loadProgressData,
    getRoleplayAccess,
    updateProgress,
    getRecentActivity,
    getOverallStats,
    canAccessRoleplay,
    unlockModuleTemporarily,
    getUserAccessLevel,
    getModuleDisplayName,
    getUnlockStatus,

    // Computed values
    userAccessLevel: getUserAccessLevel(),
    isUnlimitedUser: getUserAccessLevel() === 'unlimited',
    isTrialUser: getUserAccessLevel() === 'trial',
    isLimitedUser: getUserAccessLevel() === 'limited'
  };

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
};

export default ProgressProvider;