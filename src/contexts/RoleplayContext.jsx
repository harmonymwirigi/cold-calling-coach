// src/contexts/RoleplayContext.jsx
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { openAIService } from '../services/openaiService';
import { voiceService } from '../services/voiceService';
import { useAuth } from './AuthContext';
import logger from '../utils/logger';

const RoleplayContext = createContext();

export const RoleplayProvider = ({ children }) => {
  const [currentSession, setCurrentSession] = useState(null);
  const [callState, setCallState] = useState('idle'); // idle, dialing, connected, ended
  const [sessionResults, setSessionResults] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [lastSpeechTime, setLastSpeechTime] = useState(0);
  const silenceTimerRef = useRef(null);

  // Define endSession first since it's used by other functions
  const endSession = useCallback(async (reason = 'completed') => {
    if (!currentSession) return null;

    try {
      logger.log('🏁 Ending session:', reason);
      
      setCallState('ended');
      
      // Calculate session results
      const evaluations = currentSession.evaluations.filter(e => e);
      const passedEvaluations = evaluations.filter(e => e.passed);
      const averageScore = evaluations.length > 0 
        ? evaluations.reduce((sum, e) => sum + (e.overall_score || 0), 0) / evaluations.length 
        : 0;

      const sessionResult = {
        sessionId: currentSession.id,
        roleplayType: currentSession.roleplayType,
        mode: currentSession.mode,
        duration: Math.floor((new Date() - new Date(currentSession.startTime)) / 1000),
        reason,
        passed: passedEvaluations.length > 0 && reason !== 'silence_timeout',
        evaluations: evaluations,
        averageScore: averageScore,
        conversationHistory: currentSession.conversationHistory,
        endTime: new Date().toISOString()
      };

      // Generate coaching feedback
      if (evaluations.length > 0) {
        sessionResult.coaching = await openAIService.generateCoachingFeedback({
          roleplayType: currentSession.roleplayType,
          callsAttempted: 1,
          callsPassed: sessionResult.passed ? 1 : 0,
          averageScore: averageScore,
          commonIssues: evaluations.flatMap(e => e.issues || [])
        });
      }

      setSessionResults(sessionResult);
      logger.log('✅ Session ended successfully:', sessionResult);
      
      return sessionResult;
    } catch (error) {
      logger.error('❌ Error ending session:', error);
      return null;
    }
  }, [currentSession]);

  // Then define handleSilenceWarning and handleSilenceTimeout
  const handleSilenceWarning = useCallback((silenceSeconds) => {
    logger.log('Silence warning:', silenceSeconds);
    // Add any warning UI or sound here
  }, []);

  const handleSilenceTimeout = useCallback(async (reason) => {
    try {
      setIsProcessing(true);
      await endSession(reason);
      logger.log('Call ended due to silence:', reason);
    } catch (error) {
      logger.error('Error handling silence timeout:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [endSession]);

  // Then use them in useEffect
  useEffect(() => {
    voiceService.setSilenceCallbacks(
      handleSilenceWarning,
      handleSilenceTimeout
    );
  }, [handleSilenceWarning, handleSilenceTimeout]);

  useEffect(() => {
    if (isListening) {
      silenceTimerRef.current = setInterval(() => {
        const silenceSeconds = Math.floor((Date.now() - lastSpeechTime) / 1000);
        if (silenceSeconds === 10) {
          handleSilenceWarning(silenceSeconds);
        } else if (silenceSeconds >= 15) {
          handleSilenceTimeout();
        }
      }, 1000);
    }
    return () => {
      if (silenceTimerRef.current) {
        clearInterval(silenceTimerRef.current);
      }
    };
  }, [isListening, lastSpeechTime, handleSilenceWarning, handleSilenceTimeout]);

  const startRoleplaySession = useCallback(async (roleplayType, mode, options = {}) => {
    try {
      logger.log('🚀 Starting roleplay session:', { roleplayType, mode, options });
      
      // Reset services
      openAIService.resetConversation();
      voiceService.cleanup();

      // Create session data
      const sessionData = {
        id: Date.now().toString(),
        roleplayType,
        mode,
        character: options.character,
        startTime: new Date().toISOString(),
        callsAttempted: 0,
        callsPassed: 0,
        currentStage: 'greeting',
        conversationHistory: [],
        evaluations: [],
        usedObjections: new Set(),
        ...options
      };

      setCurrentSession(sessionData);
      setCallState('dialing');

      // Simulate dialing delay then connect
      setTimeout(async () => {
        setCallState('connected');
        
        // Start with prospect greeting - need to speak directly since session just started
        const greeting = "Hello?";
        logger.log('🎭 AI will now speak the greeting:', greeting);
        
        try {
          // Speak the greeting directly
          logger.log('🔊 Attempting to speak greeting...');
          await voiceService.speakText(greeting, {
            voiceId: 'Joanna',
            rate: 0.9,
            pitch: 1.0
          });
          logger.log('✅ Greeting spoken successfully');
        } catch (error) {
          logger.error('❌ Error speaking greeting:', error);
        }
        
        logger.log('✅ Roleplay session started successfully');
      }, 2000);

      return sessionData;
    } catch (error) {
      logger.error('❌ Error starting roleplay session:', error);
      throw error;
    }
  }, []);

  const handleUserResponse = useCallback(async (response) => {
    try {
      setIsProcessing(true);
      const result = await openAIService.getProspectResponse(response, {
        roleplayType: currentSession?.roleplayType,
        mode: currentSession?.mode
      });
      return result;
    } catch (error) {
      logger.error('Error processing user response:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [currentSession]);

  const handleProspectResponse = useCallback(async (response) => {
    if (!currentSession) return;

    try {
      logger.log('🎭 Prospect speaking:', response);
      
      // Speak the prospect's response
      logger.log('🔊 Attempting to speak with voice service...');
      const speechResult = await voiceService.speakText(response, {
        voiceId: 'Joanna', // Female US voice
        rate: 0.9,
        pitch: 1.0
      });
      
      logger.log('✅ Speech result:', speechResult);

      // Update session with prospect response
      const updatedSession = {
        ...currentSession,
        conversationHistory: [
          ...currentSession.conversationHistory,
          { speaker: 'prospect', content: response, timestamp: new Date().toISOString() }
        ]
      };

      setCurrentSession(updatedSession);

    } catch (error) {
      logger.error('❌ Error handling prospect response:', error);
      
      // Try a fallback approach - just update the session without speech
      const updatedSession = {
        ...currentSession,
        conversationHistory: [
          ...currentSession.conversationHistory,
          { speaker: 'prospect', content: response, timestamp: new Date().toISOString() }
        ]
      };
      setCurrentSession(updatedSession);
    }
  }, [currentSession]);

  const resetSession = useCallback(() => {
    setCurrentSession(null);
    setCallState('idle');
    setSessionResults(null);
    setIsProcessing(false);
    openAIService.resetConversation();
    voiceService.cleanup();
  }, []);

  const handleStart = useCallback(async () => {
    try {
      setIsProcessing(true);
      const session = await startRoleplaySession(currentSession?.roleplayType, currentSession?.mode);
      if (!session) {
        throw new Error('Failed to start session');
      }
      setIsListening(true);
      setLastSpeechTime(Date.now());
    } catch (error) {
      logger.error('Error starting roleplay:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [startRoleplaySession, currentSession?.roleplayType, currentSession?.mode]);

  const handleEnd = useCallback(async () => {
    try {
      setIsProcessing(true);
      await endSession();
    } catch (error) {
      logger.error('Error ending roleplay:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [endSession]);

  const value = {
    // State
    currentSession,
    callState,
    sessionResults,
    isProcessing,
    
    // Actions
    startRoleplaySession,
    handleUserResponse,
    endSession,
    resetSession,
    
    // Voice actions
    handleProspectResponse,
    handleSilenceWarning,
    handleSilenceTimeout,
    handleStart,
    handleEnd
  };

  return (
    <RoleplayContext.Provider value={value}>
      {children}
    </RoleplayContext.Provider>
  );
};

export const useRoleplay = () => {
  const context = useContext(RoleplayContext);
  if (!context) {
    throw new Error('useRoleplay must be used within a RoleplayProvider');
  }
  return context;
};

export default RoleplayProvider;