// src/contexts/RoleplayContext.jsx - ENHANCED VERSION
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { openAIService } from '../services/openaiService';
import { supabase } from '../services/supabase';
import logger from '../utils/logger';

const RoleplayContext = createContext({});

export const useRoleplay = () => {
  const context = useContext(RoleplayContext);
  if (!context) {
    throw new Error('useRoleplay must be used within RoleplayProvider');
  }
  return context;
};

export const RoleplayProvider = ({ children }) => {
  const { userProfile } = useAuth();
  
  // Session state
  const [currentSession, setCurrentSession] = useState(null);
  const [callState, setCallState] = useState('idle'); // idle, dialing, connected, ended
  const [sessionResults, setSessionResults] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Session tracking
  const sessionRef = useRef(null);
  const conversationRef = useRef([]);
  const evaluationsRef = useRef([]);
  const startTimeRef = useRef(null);
  
  // Start a new roleplay session
  const startRoleplaySession = useCallback(async (roleplayType, mode, metadata = {}) => {
    try {
      logger.log('🎬 Starting roleplay session:', { roleplayType, mode, metadata });
      
      // Initialize OpenAI service if needed
      if (!openAIService.isInitialized) {
        await openAIService.initialize();
      }
      
      // Reset OpenAI conversation
      openAIService.resetConversation();
      
      // Create session object
      const session = {
        id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId: userProfile?.id,
        roleplayType,
        mode,
        metadata,
        startTime: new Date().toISOString(),
        character: metadata.character || null,
        status: 'active'
      };
      
      sessionRef.current = session;
      conversationRef.current = [];
      evaluationsRef.current = [];
      startTimeRef.current = Date.now();
      
      setCurrentSession(session);
      setCallState('dialing');
      setSessionResults(null);
      
      // Simulate dialing delay
      setTimeout(() => {
        setCallState('connected');
        logger.log('📞 Call connected');
      }, 2000);
      
      // Log session start in database
      if (userProfile?.id) {
        try {
          await supabase
            .from('session_logs')
            .insert({
              user_id: userProfile.id,
              roleplay_type: roleplayType,
              mode: mode,
              started_at: session.startTime,
              metadata: metadata
            });
        } catch (dbError) {
          logger.warn('Failed to log session start:', dbError);
        }
      }
      
      return session;
      
    } catch (error) {
      logger.error('❌ Error starting roleplay session:', error);
      throw error;
    }
  }, [userProfile]);
  
  // Handle user response during session
  const handleUserResponse = useCallback(async (userInput) => {
    if (!currentSession || callState !== 'connected') {
      logger.warn('Cannot handle response - no active session');
      return { success: false, error: 'No active session' };
    }
    
    try {
      setIsProcessing(true);
      
      // Get current conversation stage
      const conversationLength = conversationRef.current.length;
      const currentStage = conversationLength === 0 ? 'opener' : null;
      
      // Process with OpenAI
      const aiResult = await openAIService.getProspectResponse(
        userInput,
        {
          roleplayType: currentSession.roleplayType,
          mode: currentSession.mode,
          character: currentSession.metadata.character
        },
        currentStage
      );
      
      if (!aiResult.success) {
        throw new Error(aiResult.error || 'AI processing failed');
      }
      
      // Track conversation
      conversationRef.current.push({
        speaker: 'user',
        text: userInput,
        timestamp: Date.now()
      });
      
      conversationRef.current.push({
        speaker: 'ai',
        text: aiResult.response,
        timestamp: Date.now()
      });
      
      // Track evaluation if provided
      if (aiResult.evaluation) {
        evaluationsRef.current.push({
          stage: aiResult.stage,
          evaluation: aiResult.evaluation,
          timestamp: Date.now()
        });
      }
      
      // Check if call should end
      if (aiResult.shouldHangUp || aiResult.nextStage === 'hang_up') {
        logger.log('📞 AI decided to hang up');
        // Don't immediately end - let the UI handle it after speaking
      }
      
      return {
        success: true,
        response: aiResult.response,
        evaluation: aiResult.evaluation,
        stage: aiResult.stage,
        nextStage: aiResult.nextStage,
        shouldHangUp: aiResult.shouldHangUp
      };
      
    } catch (error) {
      logger.error('❌ Error handling user response:', error);
      return {
        success: false,
        error: error.message,
        response: "I'm sorry, could you repeat that?"
      };
    } finally {
      setIsProcessing(false);
    }
  }, [currentSession, callState]);
  
  // End the current session
  const endSession = useCallback(async (reason = 'completed') => {
    if (!currentSession) {
      logger.warn('No session to end');
      return null;
    }
    
    try {
      logger.log('🏁 Ending session:', reason);
      
      const endTime = Date.now();
      const duration = Math.floor((endTime - startTimeRef.current) / 1000);
      
      // Calculate results
      const totalEvaluations = evaluationsRef.current.length;
      const passedEvaluations = evaluationsRef.current.filter(e => e.evaluation?.passed).length;
      const overallPassed = passedEvaluations >= Math.ceil(totalEvaluations * 0.6); // 60% pass rate
      
      // Get coaching feedback
      const coachingFeedback = await openAIService.generateCoachingFeedback({
        roleplayType: currentSession.roleplayType,
        mode: currentSession.mode,
        evaluations: evaluationsRef.current,
        conversation: conversationRef.current,
        duration,
        passed: overallPassed
      });
      
      const results = {
        sessionId: currentSession.id,
        roleplayType: currentSession.roleplayType,
        mode: currentSession.mode,
        duration,
        reason,
        passed: overallPassed,
        evaluations: evaluationsRef.current,
        conversation: conversationRef.current,
        coaching: coachingFeedback,
        metrics: {
          totalStages: totalEvaluations,
          passedStages: passedEvaluations,
          passRate: totalEvaluations > 0 ? (passedEvaluations / totalEvaluations) : 0
        }
      };
      
      // Update session state
      setCallState('ended');
      setSessionResults(results);
      
      // Log session end in database
      if (userProfile?.id) {
        try {
          await supabase
            .from('session_logs')
            .insert({
              user_id: userProfile.id,
              session_id: currentSession.id,
              roleplay_type: currentSession.roleplayType,
              mode: currentSession.mode,
              started_at: currentSession.startTime,
              ended_at: new Date().toISOString(),
              duration,
              passed: overallPassed,
              reason,
              metrics: results.metrics,
              evaluations: evaluationsRef.current
            });
        } catch (dbError) {
          logger.warn('Failed to log session end:', dbError);
        }
      }
      
      return results;
      
    } catch (error) {
      logger.error('❌ Error ending session:', error);
      return null;
    }
  }, [currentSession, userProfile]);
  
  // Reset session
  const resetSession = useCallback(() => {
    logger.log('🔄 Resetting session');
    setCurrentSession(null);
    setCallState('idle');
    setSessionResults(null);
    setIsProcessing(false);
    sessionRef.current = null;
    conversationRef.current = [];
    evaluationsRef.current = [];
    startTimeRef.current = null;
    openAIService.resetConversation();
  }, []);
  
  // Get session statistics
  const getSessionStats = useCallback(() => {
    if (!currentSession) return null;
    
    const duration = startTimeRef.current ? 
      Math.floor((Date.now() - startTimeRef.current) / 1000) : 0;
    
    return {
      duration,
      exchanges: Math.floor(conversationRef.current.length / 2),
      evaluations: evaluationsRef.current.length,
      currentStage: openAIService.currentStage
    };
  }, [currentSession]);
  
  // Handle silence timeout
  const handleSilenceTimeout = useCallback(async () => {
    if (callState !== 'connected' || isProcessing) return;
    
    logger.log('⏱️ Handling silence timeout');
    
    // Let OpenAI handle the silence
    const silenceResult = await handleUserResponse('');
    
    return silenceResult;
  }, [callState, isProcessing, handleUserResponse]);
  
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
    getSessionStats,
    handleSilenceTimeout,
    
    // Session data (for debugging)
    conversation: conversationRef.current,
    evaluations: evaluationsRef.current
  };
  
  return (
    <RoleplayContext.Provider value={value}>
      {children}
    </RoleplayContext.Provider>
  );
};