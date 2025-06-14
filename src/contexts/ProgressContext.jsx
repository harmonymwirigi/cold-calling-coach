// src/contexts/ProgressContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { userService, achievementService } from '../services/supabase';

const ProgressContext = createContext();

export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return context;
};

export const ProgressProvider = ({ children }) => {
  const { user } = useAuth();
  const [progress, setProgress] = useState({});
  const [sessions, setSessions] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load user progress when user changes
  useEffect(() => {
    if (user) {
      loadUserData();
    } else {
      // Clear data when user logs out
      setProgress({});
      setSessions([]);
      setAchievements([]);
      setLoading(false);
    }
  }, [user]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load progress, sessions, and achievements in parallel
      const [progressResult, sessionsResult, achievementsResult] = await Promise.all([
        userService.getUserProgress(user.id),
        userService.getUserSessions(user.id),
        achievementService.getUserAchievements(user.id)
      ]);

      if (progressResult.success) {
        setProgress(progressResult.data);
      } else {
        console.error('Failed to load progress:', progressResult.error);
      }

      if (sessionsResult.success) {
        setSessions(sessionsResult.data);
      } else {
        console.error('Failed to load sessions:', sessionsResult.error);
      }

      if (achievementsResult.success) {
        setAchievements(achievementsResult.data);
      } else {
        console.error('Failed to load achievements:', achievementsResult.error);
      }

    } catch (error) {
      console.error('Error loading user data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Update progress for a specific roleplay type
  const updateProgress = async (roleplayType, progressData) => {
    try {
      const result = await userService.updateUserProgress(user.id, roleplayType, progressData);
      
      if (result.success) {
        setProgress(prev => ({
          ...prev,
          [roleplayType]: result.data
        }));

        // Check for new achievements
        await checkAchievements();
        
        return { success: true, data: result.data };
      } else {
        console.error('Failed to update progress:', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error updating progress:', error);
      return { success: false, error: error.message };
    }
  };

  // Log a new session
  const logSession = async (sessionData) => {
    try {
      const result = await userService.logSession(user.id, {
        ...sessionData,
        created_at: new Date().toISOString()
      });

      if (result.success) {
        setSessions(prev => [result.data, ...prev]);
        return { success: true, data: result.data };
      } else {
        console.error('Failed to log session:', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error logging session:', error);
      return { success: false, error: error.message };
    }
  };

  // Check and award achievements
  const checkAchievements = async () => {
    try {
      const result = await achievementService.checkAchievements(user.id);
      
      if (result.success && result.newAchievements.length > 0) {
        // Reload achievements to get the latest
        const achievementsResult = await achievementService.getUserAchievements(user.id);
        if (achievementsResult.success) {
          setAchievements(achievementsResult.data);
        }
        
        return result.newAchievements;
      }
      
      return [];
    } catch (error) {
      console.error('Error checking achievements:', error);
      return [];
    }
  };

  // Get access info for a roleplay type
  const getRoleplayAccess = (roleplayType) => {
    const typeProgress = progress[roleplayType];
    
    if (!typeProgress) {
      // First roleplay is always unlocked
      return {
        unlocked: roleplayType === 'opener_practice',
        reason: roleplayType === 'opener_practice' ? 'Always available' : 'Complete previous module first',
        marathonPasses: 0,
        legendCompleted: false
      };
    }

    // Check if unlocked permanently or temporarily
    const hasUnlockExpiry = typeProgress.unlock_expiry && 
                           new Date(typeProgress.unlock_expiry) > new Date();
    
    return {
      unlocked: typeProgress.permanently_unlocked || hasUnlockExpiry || roleplayType === 'opener_practice',
      reason: typeProgress.permanently_unlocked ? 'Permanently unlocked' :
              hasUnlockExpiry ? `Unlocked until ${new Date(typeProgress.unlock_expiry).toLocaleDateString()}` :
              roleplayType === 'opener_practice' ? 'Always available' :
              'Complete previous Marathon to unlock',
      marathonPasses: typeProgress.marathon_passes || 0,
      legendCompleted: typeProgress.legend_completed || false,
      unlockExpiry: typeProgress.unlock_expiry
    };
  };

  // Get overall statistics
  const getOverallStats = () => {
    const totalSessions = sessions.length;
    const totalHours = sessions.reduce((sum, session) => 
      sum + (session.duration_seconds || 0), 0) / 3600;
    
    const passedSessions = sessions.filter(s => s.passed);
    const averageScore = sessions.length > 0 
      ? sessions.reduce((sum, s) => sum + (s.score || 0), 0) / sessions.length
      : 0;

    const practicesCompleted = Object.values(progress).filter(p => p.practice_completed).length;
    const marathonsCompleted = Object.values(progress).filter(p => (p.marathon_passes || 0) >= 6).length;
    const legendsCompleted = Object.values(progress).filter(p => p.legend_completed).length;

    return {
      totalSessions,
      totalHours: Math.round(totalHours * 10) / 10,
      passRate: totalSessions > 0 ? Math.round((passedSessions.length / totalSessions) * 100) : 0,
      averageScore: Math.round(averageScore * 10) / 10,
      practicesCompleted,
      marathonsCompleted,
      legendsCompleted,
      totalAchievements: achievements.length
    };
  };

  // Get recent activity
  const getRecentActivity = (limit = 5) => {
    return sessions
      .slice(0, limit)
      .map(session => ({
        ...session,
        timeAgo: getTimeAgo(session.created_at)
      }));
  };

  const getTimeAgo = (dateString) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const value = {
    // Data
    progress,
    sessions,
    achievements,
    loading,
    error,

    // Methods
    updateProgress,
    logSession,
    checkAchievements,
    getRoleplayAccess,
    getOverallStats,
    getRecentActivity,
    loadUserData
  };

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
};
