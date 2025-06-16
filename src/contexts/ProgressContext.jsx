// src/contexts/ProgressContext.jsx - UPDATED WITH FULL INTEGRATION
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { accessLevelAPI } from '../api/accessLevelAPI';
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

  // Load user progress data
  const loadProgressData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      logger.log('📊 Loading progress data for user:', user.id);

      // Load user access status (includes progress for all modules)
      const accessResult = await accessLevelAPI.getUserAccessStatus(user.id);
      
      if (!accessResult.success) {
        throw new Error(accessResult.error || 'Failed to load access status');
      }

      setAccessStatus(accessResult.accessStatus);

      // Extract progress data from access status
      const progressData = {};
      Object.keys(accessResult.accessStatus).forEach(roleplayType => {
        const moduleData = accessResult.accessStatus[roleplayType];
        if (moduleData.progress) {
          progressData[roleplayType] = moduleData.progress;
        }
      });
      setProgress(progressData);

      // Load session history
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
      }

      // Calculate overall stats
      calculateOverallStats(progressData, sessionData || []);

      logger.log('✅ Progress data loaded successfully');

    } catch (err) {
      logger.error('❌ Error loading progress data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Calculate overall statistics
  const calculateOverallStats = useCallback((progressData, sessionData) => {
    const stats = {
      totalSessions: sessionData.length,
      totalHours: Math.round(sessionData.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / 3600 * 10) / 10,
      practicesCompleted: 0,
      marathonsCompleted: 0,
      legendsCompleted: 0
    };

    // Count completions from progress data
    Object.values(progressData).forEach(progress => {
      stats.practicesCompleted += progress.total_passes || 0;
      stats.marathonsCompleted += progress.marathon_passes || 0;
      if (progress.legend_completed) {
        stats.legendsCompleted++;
      }
    });

    setOverallStats(stats);
  }, []);

  // Get roleplay access information
  const getRoleplayAccess = useCallback((roleplayType, mode = 'practice') => {
    const moduleAccess = accessStatus[roleplayType];
    if (!moduleAccess) {
      return {
        unlocked: false,
        reason: 'Module not found',
        marathonPasses: 0,
        legendCompleted: false
      };
    }

    const modeAccess = moduleAccess[mode];
    if (!modeAccess) {
      return {
        unlocked: false,
        reason: 'Mode not available',
        marathonPasses: 0,
        legendCompleted: false
      };
    }

    return {
      unlocked: modeAccess.unlocked,
      reason: modeAccess.reason,
      marathonPasses: modeAccess.marathonPasses || 0,
      legendCompleted: modeAccess.legendCompleted || false,
      legendAttemptUsed: modeAccess.legendAttemptUsed !== false,
      unlockExpiry: modeAccess.unlockExpiry,
      accessLevel: modeAccess.accessLevel
    };
  }, [accessStatus]);

  // Update progress after session completion
  const updateProgress = useCallback(async (roleplayType, sessionResult) => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      logger.log('📝 Updating progress:', { roleplayType, sessionResult });

      // Record session completion via API
      const result = await accessLevelAPI.recordSessionCompletion(
        user.id,
        roleplayType,
        sessionResult.mode || 'practice',
        sessionResult
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to update progress');
      }

      // Reload progress data to reflect changes
      await loadProgressData();

      // Return unlock information
      return {
        success: true,
        unlocks: result.unlocks || [],
        message: result.message
      };

    } catch (error) {
      logger.error('❌ Error updating progress:', error);
      throw error;
    }
  }, [user?.id, loadProgressData]);

  // Get recent activity for dashboard
  const getRecentActivity = useCallback(async () => {
    try {
      const recentSessions = sessions.slice(0, 10).map(session => ({
        id: session.id,
        roleplay_type: session.roleplay_type,
        mode: session.mode,
        passed: session.passed,
        score: session.score,
        created_at: session.created_at,
        timeAgo: getTimeAgo(session.created_at)
      }));

      return recentSessions;
    } catch (error) {
      logger.error('Error getting recent activity:', error);
      return [];
    }
  }, [sessions]);

  // Get overall statistics
  const getOverallStats = useCallback(() => {
    return overallStats;
  }, [overallStats]);

  // Check if user can access specific roleplay
  const canAccessRoleplay = useCallback(async (roleplayType, mode = 'practice') => {
    if (!user?.id) {
      return { allowed: false, reason: 'Not authenticated' };
    }

    try {
      const result = await accessLevelAPI.checkModuleAccess(user.id, roleplayType, mode);
      return {
        allowed: result.success && result.access.unlocked,
        reason: result.access?.reason || 'Access denied',
        accessInfo: result.access
      };
    } catch (error) {
      logger.error('Error checking roleplay access:', error);
      return { allowed: false, reason: 'Access check failed' };
    }
  }, [user?.id]);

  // Unlock module temporarily (admin function)
  const unlockModuleTemporarily = useCallback(async (roleplayType, hours = 24) => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      const result = await accessLevelAPI.unlockModuleTemporarily(user.id, roleplayType, hours);
      
      if (result.success) {
        // Reload progress to reflect changes
        await loadProgressData();
      }

      return result;
    } catch (error) {
      logger.error('Error unlocking module:', error);
      throw error;
    }
  }, [user?.id, loadProgressData]);

  // Get user access level
  const getUserAccessLevel = useCallback(() => {
    return userProfile?.access_level || 'limited';
  }, [userProfile]);

  // Helper function to format time ago
  const getTimeAgo = (dateString) => {
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
  };

  // Load data when user changes
  useEffect(() => {
    loadProgressData();
  }, [loadProgressData]);

  // Set up real-time subscriptions for progress updates
  useEffect(() => {
    if (!user?.id) return;

    logger.log('📡 Setting up real-time progress subscriptions');

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
          setSessions(prev => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      logger.log('📡 Cleaning up real-time subscriptions');
      supabase.removeChannel(progressSubscription);
      supabase.removeChannel(sessionSubscription);
    };
  }, [user?.id, loadProgressData]);

  const value = {
    // State
    loading,
    error,
    progress,
    sessions,
    accessStatus,
    overallStats,

    // Functions
    loadProgressData,
    getRoleplayAccess,
    updateProgress,
    getRecentActivity,
    getOverallStats,
    canAccessRoleplay,
    unlockModuleTemporarily,
    getUserAccessLevel,

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