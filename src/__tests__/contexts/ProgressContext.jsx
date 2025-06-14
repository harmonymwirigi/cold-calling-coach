// src/contexts/ProgressContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabase';

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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProgress();
      fetchSessions();
    }
  }, [user]);

  const fetchProgress = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      // Convert array to object for easy access
      const progressObj = {};
      data.forEach(item => {
        progressObj[item.roleplay_type] = item;
      });
      
      setProgress(progressObj);
    } catch (error) {
      console.error('Error fetching progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('session_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setSessions(data);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };

  const updateProgress = async (roleplayType, progressData) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_progress')
        .upsert({
          user_id: user.id,
          roleplay_type: roleplayType,
          ...progressData,
          last_completed: new Date().toISOString()
        });

      if (error) throw error;
      
      await fetchProgress();
      return { success: true };
    } catch (error) {
      console.error('Error updating progress:', error);
      return { success: false, error: error.message };
    }
  };

  const logSession = async (sessionData) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('session_logs')
        .insert({
          user_id: user.id,
          ...sessionData
        });

      if (error) throw error;
      
      await fetchSessions();
      return { success: true };
    } catch (error) {
      console.error('Error logging session:', error);
      return { success: false, error: error.message };
    }
  };

  const getRoleplayAccess = (roleplayType) => {
    const progressData = progress[roleplayType];
    
    // First roleplay is always available
    if (roleplayType === 'opener_practice') {
      return { unlocked: true, permanent: true };
    }

    if (!progressData) {
      return { unlocked: false, reason: 'Complete previous roleplay to unlock' };
    }

    // Check if unlocked temporarily
    if (progressData.unlock_expiry) {
      const expiryDate = new Date(progressData.unlock_expiry);
      const now = new Date();
      
      if (now < expiryDate) {
        const hoursLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60));
        return { 
          unlocked: true, 
          temporary: true, 
          hoursLeft 
        };
      }
    }

    return { unlocked: false, reason: 'Complete marathon mode to unlock' };
  };

  const value = {
    progress,
    sessions,
    loading,
    updateProgress,
    logSession,
    getRoleplayAccess,
    fetchProgress,
    fetchSessions
  };

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
};