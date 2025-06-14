// src/contexts/RoleplayContext.jsx
import React, { createContext, useContext, useState } from 'react';

const RoleplayContext = createContext();

export const useRoleplay = () => {
  const context = useContext(RoleplayContext);
  if (!context) {
    throw new Error('useRoleplay must be used within a RoleplayProvider');
  }
  return context;
};

export const RoleplayProvider = ({ children }) => {
  const [currentSession, setCurrentSession] = useState(null);
  const [sessionHistory, setSessionHistory] = useState([]);

  const startSession = (roleplayType, mode, userContext) => {
    const session = {
      id: Date.now().toString(),
      roleplayType,
      mode,
      userContext,
      startTime: new Date(),
      calls: [],
      status: 'active'
    };
    
    setCurrentSession(session);
    return session;
  };

  const endSession = (results) => {
    if (!currentSession) return;

    const completedSession = {
      ...currentSession,
      endTime: new Date(),
      results,
      status: 'completed'
    };

    setSessionHistory(prev => [completedSession, ...prev]);
    setCurrentSession(null);
    
    return completedSession;
  };

  const addCallToSession = (callData) => {
    if (!currentSession) return;

    setCurrentSession(prev => ({
      ...prev,
      calls: [...prev.calls, callData]
    }));
  };

  const value = {
    currentSession,
    sessionHistory,
    startSession,
    endSession,
    addCallToSession
  };

  return (
    <RoleplayContext.Provider value={value}>
      {children}
    </RoleplayContext.Provider>
  );
};