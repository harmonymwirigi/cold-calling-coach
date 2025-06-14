// src/contexts/ProgressContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';

const ProgressContext = createContext();

export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return context;
};

export const ProgressProvider = ({ children }) => {
  const { userProfile } = useAuth();
  const [progress, setProgress] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Roleplay configuration following the detailed instructions
  const roleplayConfig = {
    opener_practice: {
      title: "Opener + Early Objections",
      description: "Master your opening and handle immediate pushback",
      unlockRequirement: null, // Always available
      modes: ['practice', 'marathon', 'legend']
    },
    pitch_practice: {
      title: "Pitch + Objections + Close", 
      description: "Deliver compelling pitches and close for meetings",
      unlockRequirement: 'opener_practice_marathon_pass',
      modes: ['practice', 'marathon', 'legend']
    },
    warmup_challenge: {
      title: "Warm-up Challenge",
      description: "25 rapid-fire questions to test your skills",
      unlockRequirement: 'pitch_practice_marathon_pass',
      modes: ['practice']
    },
    full_simulation: {
      title: "Full Cold Call Simulation",
      description: "Complete call from start to finish", 
      unlockRequirement: 'warmup_challenge_pass',
      modes: ['practice']
    },
    power_hour: {
      title: "Power Hour Challenge",
      description: "20 consecutive calls - ultimate test",
      unlockRequirement: 'full_simulation_pass',
      modes: ['practice']
    }
  };

  // Load user progress from database
  useEffect(() => {
    if (userProfile?.id) {
      loadUserProgress();
    }
  }, [userProfile]);

  const loadUserProgress = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('📊 Loading user progress...');

      const { data, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userProfile.id);

      if (error) {
        throw error;
      }

      // Convert array to object keyed by roleplay_type
      const progressMap = {};
      data.forEach(item => {
        progressMap[item.roleplay_type] = item;
      });

      setProgress(progressMap);
      console.log('✅ Progress loaded:', progressMap);

    } catch (error) {
      console.error('❌ Error loading progress:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Get access information for a specific roleplay
  const getRoleplayAccess = (roleplayType) => {
    const config = roleplayConfig[roleplayType];
    if (!config) {
      return { unlocked: false, reason: 'Invalid roleplay type' };
    }

    const userProgress = progress[roleplayType] || {};
    
    // First module (opener_practice) is always unlocked
    if (roleplayType === 'opener_practice') {
      return {
        unlocked: true,
        reason: 'Always available',
        marathonPasses: userProgress.marathon_passes || 0,
        legendCompleted: userProgress.legend_completed || false,
        legendAttemptUsed: userProgress.legend_attempt_used || false,
        unlockExpiry: userProgress.unlock_expiry ? new Date(userProgress.unlock_expiry) : null
      };
    }

    // Check unlock requirements for other modules
    const unlockStatus = checkUnlockRequirement(config.unlockRequirement);
    
    if (!unlockStatus.unlocked) {
      return unlockStatus;
    }

    // Check if access has expired (24-hour unlock window)
    const unlockExpiry = userProgress.unlock_expiry ? new Date(userProgress.unlock_expiry) : null;
    const hasTimeLimit = unlockExpiry && new Date() < unlockExpiry;
    const hasExpired = unlockExpiry && new Date() >= unlockExpiry;

    if (hasExpired) {
      return {
        unlocked: false,
        reason: 'Access expired. Complete previous Marathon again to unlock.'
      };
    }

    return {
      unlocked: true,
      reason: hasTimeLimit ? `Unlocked until ${unlockExpiry.toLocaleString()}` : 'Permanently unlocked',
      marathonPasses: userProgress.marathon_passes || 0,
      legendCompleted: userProgress.legend_completed || false,
      legendAttemptUsed: userProgress.legend_attempt_used !== false, // Default to true
      unlockExpiry: unlockExpiry
    };
  };

  // Check if unlock requirement is met
  const checkUnlockRequirement = (requirement) => {
    let openerProgress, pitchProgress, warmupProgress, fullSimProgress;

    switch (requirement) {
      case 'opener_practice_marathon_pass':
        openerProgress = progress.opener_practice;
        if (!openerProgress || (openerProgress.marathon_passes || 0) < 6) {
          return {
            unlocked: false,
            reason: 'Complete Opener Practice Marathon (6/10 passes) to unlock'
          };
        }
        return { unlocked: true, reason: 'Unlocked by Opener Marathon' };

      case 'pitch_practice_marathon_pass':
        pitchProgress = progress.pitch_practice;
        if (!pitchProgress || (pitchProgress.marathon_passes || 0) < 6) {
          return {
            unlocked: false,
            reason: 'Complete Pitch Practice Marathon (6/10 passes) to unlock'
          };
        }
        return { unlocked: true, reason: 'Unlocked by Pitch Marathon' };

      case 'warmup_challenge_pass':
        warmupProgress = progress.warmup_challenge;
        if (!warmupProgress || (warmupProgress.total_passes || 0) < 1) {
          return {
            unlocked: false,
            reason: 'Complete Warm-up Challenge (18/25 score) to unlock'
          };
        }
        return { unlocked: true, reason: 'Unlocked by Warm-up Challenge' };

      case 'full_simulation_pass':
        fullSimProgress = progress.full_simulation;
        if (!fullSimProgress || (fullSimProgress.total_passes || 0) < 1) {
          return {
            unlocked: false,
            reason: 'Complete Full Simulation once to unlock'
          };
        }
        return { unlocked: true, reason: 'Unlocked by Full Simulation' };

      default:
        return { unlocked: false, reason: 'Unknown requirement' };
    }
  };

  // Update user progress
  const updateProgress = async (roleplayType, updates) => {
    try {
      console.log('📈 Updating progress:', { roleplayType, updates });

      const { data, error } = await supabase
        .from('user_progress')
        .upsert({
          user_id: userProfile.id,
          roleplay_type: roleplayType,
          updated_at: new Date().toISOString(),
          ...updates
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Update local state
      setProgress(prev => ({
        ...prev,
        [roleplayType]: data
      }));

      console.log('✅ Progress updated:', data);
      return data;

    } catch (error) {
      console.error('❌ Error updating progress:', error);
      throw error;
    }
  };

  // Log a session
  const logSession = async (sessionData) => {
    try {
      console.log('📝 Logging session:', sessionData);

      const { data, error } = await supabase
        .from('session_logs')
        .insert({
          user_id: userProfile.id,
          roleplay_type: sessionData.roleplayType,
          mode: sessionData.mode,
          duration: sessionData.duration,
          passed: sessionData.passed,
          score: sessionData.averageScore,
          evaluation: sessionData.evaluations || null,
          conversation_history: sessionData.conversationHistory || null,
          coaching: sessionData.coaching || null
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log('✅ Session logged:', data.id);
      return data;

    } catch (error) {
      console.error('❌ Error logging session:', error);
      throw error;
    }
  };

  // Get overall statistics
  const getOverallStats = () => {
    const stats = {
      totalSessions: 0,
      totalHours: 0,
      practicesCompleted: 0,
      marathonsCompleted: 0,
      legendsCompleted: 0
    };

    Object.values(progress).forEach(roleplayProgress => {
      stats.totalSessions += roleplayProgress.total_attempts || 0;
      stats.practicesCompleted += roleplayProgress.total_passes || 0;
      if ((roleplayProgress.marathon_passes || 0) >= 6) {
        stats.marathonsCompleted += 1;
      }
      if (roleplayProgress.legend_completed) {
        stats.legendsCompleted += 1;
      }
    });

    // Estimate hours (rough calculation: 3 minutes average per session)
    stats.totalHours = Math.round((stats.totalSessions * 3) / 60 * 10) / 10;

    return stats;
  };

  // Get recent activity
  const getRecentActivity = () => {
    const recentSessions = [];
    
    Object.entries(progress).forEach(([roleplayType, data]) => {
      if (data.last_completed) {
        recentSessions.push({
          roleplay_type: roleplayType,
          mode: 'practice', // Default since we don't track mode in progress table
          score: 3, // Default score
          passed: (data.total_passes || 0) > 0,
          timeAgo: getTimeAgo(new Date(data.last_completed))
        });
      }
    });

    return recentSessions
      .sort((a, b) => new Date(b.last_completed) - new Date(a.last_completed))
      .slice(0, 5);
  };

  // Helper function to calculate time ago
  const getTimeAgo = (date) => {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return `${diffMins} min ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  };

  // Get available roleplays with access info
  const getAvailableRoleplays = () => {
    return Object.entries(roleplayConfig).map(([type, config]) => ({
      type,
      ...config,
      access: getRoleplayAccess(type),
      progress: progress[type] || {
        total_attempts: 0,
        total_passes: 0,
        marathon_passes: 0,
        legend_completed: false,
        legend_attempt_used: true
      }
    }));
  };

  // Handle marathon completion
  const handleMarathonCompletion = async (roleplayType, passes) => {
    const updates = {
      marathon_passes: passes
    };

    // If marathon passed (6+ passes), unlock next module for 24 hours
    if (passes >= 6) {
      const nextModule = getNextModule(roleplayType);
      if (nextModule) {
        updates.unlock_expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      }
      
      // Reset legend attempt flag
      updates.legend_attempt_used = false;
    }

    return await updateProgress(roleplayType, updates);
  };

  // Get next module in sequence
  const getNextModule = (currentType) => {
    const sequence = ['opener_practice', 'pitch_practice', 'warmup_challenge', 'full_simulation', 'power_hour'];
    const currentIndex = sequence.indexOf(currentType);
    return currentIndex >= 0 && currentIndex < sequence.length - 1 ? sequence[currentIndex + 1] : null;
  };

  const value = {
    // State
    progress,
    loading,
    error,
    roleplayConfig,

    // Methods
    getRoleplayAccess,
    updateProgress,
    logSession,
    getOverallStats,
    getRecentActivity,
    getAvailableRoleplays,
    handleMarathonCompletion,
    loadUserProgress,

    // Helper methods
    checkUnlockRequirement,
    getNextModule
  };

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
};

export default ProgressProvider;