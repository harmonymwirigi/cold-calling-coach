// src/contexts/ProgressContext.jsx - FIXED VERSION
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabase';
import logger from '../utils/logger';
import { getTimeAgo } from '../utils/formatters';

const ProgressContext = createContext({});

export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgress must be used within ProgressProvider');
  }
  return context;
};

export const ProgressProvider = ({ children }) => {
  const { userProfile, user } = useAuth();
  const [userProgress, setUserProgress] = useState({});
  const [loading, setLoading] = useState(true);

  // Roleplay configurations
  const roleplayConfigs = {
    opener_practice: {
      name: 'Opener Practice',
      description: 'Practice your cold call openings',
      requiredToUnlock: null,
      modes: ['practice', 'marathon', 'legend']
    },
    objection_practice: {
      name: 'Objection Handling',
      description: 'Master handling common objections',
      requiredToUnlock: 'opener_practice',
      modes: ['practice', 'marathon', 'legend']
    },
    closing_practice: {
      name: 'Closing Techniques',
      description: 'Learn to close deals effectively',
      requiredToUnlock: 'objection_practice',
      modes: ['practice', 'marathon', 'legend']
    }
  };

  // Load user progress
  const loadUserProgress = useCallback(async () => {
    if (!user?.id) {
      logger.log('No user ID, skipping progress load');
      return;
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        logger.error('Error loading progress:', error);
        return;
      }

      // Convert array to object for easy access
      const progressObj = {};
      if (data) {
        data.forEach(item => {
          progressObj[item.roleplay_type] = item;
        });
      }

      // Initialize missing roleplay types
      for (const roleplayType of Object.keys(roleplayConfigs)) {
        if (!progressObj[roleplayType]) {
          progressObj[roleplayType] = {
            user_id: user.id,
            roleplay_type: roleplayType,
            total_attempts: 0,
            total_passes: 0,
            marathon_passes: 0,
            legend_completed: false,
            legend_attempt_used: true,
            unlock_expiry: null
          };
        }
      }

      setUserProgress(progressObj);
      logger.log('✅ User progress loaded:', progressObj);

    } catch (error) {
      logger.error('Failed to load user progress:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Load progress on mount and user change
  useEffect(() => {
    loadUserProgress();
  }, [loadUserProgress]);

  // Update user progress - using database function
  const updateProgress = useCallback(async (roleplayType, updates) => {
    if (!user?.id) {
      logger.error('No user ID for progress update');
      return { success: false, error: 'Not authenticated' };
    }

    try {
      logger.log('📊 Updating progress:', { roleplayType, updates });

      // Use RPC call to the upsert function if it exists
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('upsert_user_progress', {
          p_user_id: user.id,
          p_roleplay_type: roleplayType,
          p_total_attempts: updates.total_attempts,
          p_total_passes: updates.total_passes,
          p_marathon_passes: updates.marathon_passes,
          p_legend_completed: updates.legend_completed,
          p_unlock_expiry: updates.unlock_expiry,
          p_legend_attempt_used: updates.legend_attempt_used
        });

      if (rpcError) {
        // Fallback to regular upsert if RPC doesn't exist
        logger.warn('RPC failed, using regular upsert:', rpcError);
        
        // Get current progress first
        const currentProgress = userProgress[roleplayType] || {
          total_attempts: 0,
          total_passes: 0,
          marathon_passes: 0
        };

        // Merge updates with current values
        const mergedData = {
          user_id: user.id,
          roleplay_type: roleplayType,
          total_attempts: currentProgress.total_attempts + (updates.total_attempts || 0),
          total_passes: currentProgress.total_passes + (updates.total_passes || 0),
          marathon_passes: updates.marathon_passes !== undefined ? 
            updates.marathon_passes : currentProgress.marathon_passes,
          legend_completed: updates.legend_completed !== undefined ? 
            updates.legend_completed : currentProgress.legend_completed,
          legend_attempt_used: updates.legend_attempt_used !== undefined ? 
            updates.legend_attempt_used : currentProgress.legend_attempt_used,
          unlock_expiry: updates.unlock_expiry || currentProgress.unlock_expiry,
          updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
          .from('user_progress')
          .upsert(mergedData, {
            onConflict: 'user_id,roleplay_type'
          })
          .select()
          .single();

        if (error) throw error;

        // Update local state
        setUserProgress(prev => ({
          ...prev,
          [roleplayType]: data
        }));
      }

      // Reload progress to ensure consistency
      await loadUserProgress();
      
      logger.log('✅ Progress updated successfully');
      return { success: true };

    } catch (error) {
      logger.error('Failed to update progress:', error.message);
      return { success: false, error: error.message };
    }
  }, [user?.id, userProgress, loadUserProgress]);

  // Get roleplay access status
  const getRoleplayAccess = useCallback((roleplayType) => {
    const config = roleplayConfigs[roleplayType];
    if (!config) {
      return { unlocked: false, reason: 'Unknown roleplay type' };
    }

    // First roleplay is always unlocked
    if (!config.requiredToUnlock) {
      return { 
        unlocked: true,
        ...userProgress[roleplayType]
      };
    }

    // Check if prerequisite is completed
    const prerequisite = userProgress[config.requiredToUnlock];
    if (!prerequisite || prerequisite.total_passes === 0) {
      return { 
        unlocked: false, 
        reason: `Complete ${roleplayConfigs[config.requiredToUnlock].name} first`,
        ...userProgress[roleplayType]
      };
    }

    // Check if has active unlock
    const progress = userProgress[roleplayType];
    if (progress?.unlock_expiry) {
      const expiryDate = new Date(progress.unlock_expiry);
      if (expiryDate > new Date()) {
        return { 
          unlocked: true,
          temporaryUnlock: true,
          expiresAt: expiryDate,
          ...progress
        };
      }
    }

    return { 
      unlocked: true,
      ...progress
    };
  }, [userProgress]);

  // Get overall statistics
  const getOverallStats = useCallback(() => {
    const stats = {
      totalAttempts: 0,
      totalPasses: 0,
      marathonPasses: 0,
      legendsCompleted: 0,
      averagePassRate: 0
    };

    Object.values(userProgress).forEach(progress => {
      stats.totalAttempts += progress.total_attempts || 0;
      stats.totalPasses += progress.total_passes || 0;
      stats.marathonPasses += progress.marathon_passes || 0;
      if (progress.legend_completed) {
        stats.legendsCompleted += 1;
      }
    });

    if (stats.totalAttempts > 0) {
      stats.averagePassRate = (stats.totalPasses / stats.totalAttempts) * 100;
    }

    return stats;
  }, [userProgress]);

  // Get recent activity
  const getRecentActivity = useCallback(async () => {
    if (!user?.id) return [];

    try {
      const { data, error } = await supabase
        .from('session_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      return data.map(session => ({
        roleplay_type: session.roleplay_type,
        mode: session.mode,
        score: session.final_score,
        passed: session.passed,
        timeAgo: getTimeAgo(session.created_at)
      }));
    } catch (error) {
      logger.error('Error getting recent activity:', error);
      return [];
    }
  }, [user?.id]);

  // Unlock next module (for 24 hours)
  const unlockNextModule = useCallback(async (currentModule) => {
    const moduleOrder = ['opener_practice', 'objection_practice', 'closing_practice'];
    const currentIndex = moduleOrder.indexOf(currentModule);
    
    if (currentIndex === -1 || currentIndex === moduleOrder.length - 1) {
      return { success: false, error: 'No next module' };
    }

    const nextModule = moduleOrder[currentIndex + 1];
    const unlockExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    return await updateProgress(nextModule, {
      unlock_expiry: unlockExpiry
    });
  }, [updateProgress]);

  const value = {
    userProgress,
    loading,
    updateProgress,
    getRoleplayAccess,
    getOverallStats,
    getRecentActivity,
    unlockNextModule,
    reloadProgress: loadUserProgress,
    roleplayConfigs
  };

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
};