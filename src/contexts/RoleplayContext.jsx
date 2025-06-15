// src/contexts/RoleplayContext.jsx - FIXED VERSION WITH VOICE INTEGRATION
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { openAIService } from '../services/openaiService';
import { voiceService } from '../services/voiceService';
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
  
  // CRITICAL FIX: Voice integration refs
  const voiceInitializedRef = useRef(false);
  const conversationActiveRef = useRef(false);
  
  // Start a new roleplay session
  const startRoleplaySession = useCallback(async (roleplayType, mode, metadata = {}) => {
    try {
      logger.log('🎬 Starting roleplay session:', { roleplayType, mode, metadata });
      
      // CRITICAL FIX: Initialize services
      await initializeServices();
      
      // Create session object
      const session = {
        id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId: userProfile?.id,
        roleplayType,
        mode,
        metadata,
        startTime: new Date().toISOString(),
        character: metadata.character || getDefaultCharacter(),
        status: 'active'
      };
      
      sessionRef.current = session;
      conversationRef.current = [];
      evaluationsRef.current = [];
      startTimeRef.current = Date.now();
      
      setCurrentSession(session);
      setCallState('dialing');
      setSessionResults(null);
      
      // CRITICAL FIX: Start voice conversation
      await startVoiceConversation(session);
      
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

  // CRITICAL FIX: Initialize voice and AI services
  const initializeServices = useCallback(async () => {
    try {
      logger.log('🔧 Initializing roleplay services...');
      
      // Initialize OpenAI service
      await openAIService.initialize();
      openAIService.resetConversation();
      
      // Initialize Voice service
      await voiceService.initialize();
      
      voiceInitializedRef.current = true;
      logger.log('✅ Services initialized successfully');
      
    } catch (error) {
      logger.error('❌ Service initialization failed:', error);
      voiceInitializedRef.current = false;
      throw error;
    }
  }, []);

  // CRITICAL FIX: Start voice conversation flow
  const startVoiceConversation = useCallback(async (session) => {
    try {
      logger.log('🎤 Starting voice conversation');
      
      // Simulate dialing delay
      setTimeout(async () => {
        setCallState('connected');
        conversationActiveRef.current = true;
        
        // Start with AI greeting
        await handleAIGreeting(session);
        
        // CRITICAL FIX: Start continuous listening with callbacks
        voiceService.startContinuousListening(
          handleUserSpeech,
          handleSilenceTimeout
        );
        
      }, 2000);
      
    } catch (error) {
      logger.error('❌ Error starting voice conversation:', error);
      throw error;
    }
  }, []);

  // CRITICAL FIX: Handle AI greeting
  const handleAIGreeting = useCallback(async (session) => {
    try {
      const greetingMessage = generateInitialGreeting(session);
      
      // Add to conversation history
      conversationRef.current.push({
        speaker: 'ai',
        text: greetingMessage,
        timestamp: Date.now()
      });
      
      // Speak the greeting
      await voiceService.speakText(greetingMessage);
      
      logger.log('🗣️ AI greeting delivered:', greetingMessage);
      
    } catch (error) {
      logger.error('❌ Error with AI greeting:', error);
    }
  }, []);

  // CRITICAL FIX: Generate initial greeting based on roleplay type
  const generateInitialGreeting = useCallback((session) => {
    const character = session.character;
    
    switch (session.roleplayType) {
      case 'opener_practice':
        return `Hello, ${character.name} speaking.`;
      case 'pitch_practice':
        return `Hi, this is ${character.name}. I'll give you a few minutes - what's your pitch?`;
      case 'full_simulation':
        return `Hello, this is ${character.name}. Who is this?`;
      default:
        return `Hello, ${character.name} speaking.`;
    }
  }, []);

  // CRITICAL FIX: Handle user speech input
  const handleUserSpeech = useCallback(async (transcript, confidence) => {
    if (!currentSession || callState !== 'connected' || isProcessing) {
      logger.warn('Cannot process speech - invalid state');
      return;
    }

    try {
      setIsProcessing(true);
      logger.log('🗣️ Processing user speech:', transcript);

      // Add user input to conversation
      conversationRef.current.push({
        speaker: 'user',
        text: transcript,
        timestamp: Date.now()
      });

      // CRITICAL FIX: Get AI response using OpenAI service
      const aiResult = await openAIService.getProspectResponse(
        transcript,
        {
          roleplayType: currentSession.roleplayType,
          mode: currentSession.mode,
          character: currentSession.character
        },
        getCurrentConversationStage()
      );

      if (aiResult.success) {
        // Add AI response to conversation
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

        // CRITICAL FIX: Speak AI response
        await voiceService.speakText(aiResult.response);

        // Check if call should end
        if (aiResult.shouldHangUp) {
          logger.log('🔚 AI decided to hang up');
          setTimeout(() => {
            endSession('ai_hangup');
          }, 1000);
        }

        logger.log('✅ AI response delivered:', aiResult.response);
      } else {
        logger.error('❌ AI response failed:', aiResult.error);
        
        // Fallback response
        const fallbackResponse = "I'm sorry, could you repeat that?";
        await voiceService.speakText(fallbackResponse);
        
        conversationRef.current.push({
          speaker: 'ai',
          text: fallbackResponse,
          timestamp: Date.now()
        });
      }

    } catch (error) {
      logger.error('❌ Error processing user speech:', error);
      
      // Error fallback
      const errorResponse = "Sorry, I didn't catch that. Could you try again?";
      await voiceService.speakText(errorResponse);
      
    } finally {
      setIsProcessing(false);
    }
  }, [currentSession, callState, isProcessing]);

  // CRITICAL FIX: Handle silence timeout
  const handleSilenceTimeout = useCallback(async () => {
    if (!currentSession || callState !== 'connected' || isProcessing) {
      return;
    }

    logger.log('⏰ Handling silence timeout');
    
    const silenceResponse = "Hello? Are you still there?";
    
    conversationRef.current.push({
      speaker: 'ai',
      text: silenceResponse,
      timestamp: Date.now()
    });
    
    await voiceService.speakText(silenceResponse);
    
    // Give them another chance before hanging up
    setTimeout(() => {
      if (currentSession && callState === 'connected') {
        endSession('silence_timeout');
      }
    }, 10000);
  }, [currentSession, callState, isProcessing]);

  // Get current conversation stage
  const getCurrentConversationStage = useCallback(() => {
    const conversationLength = conversationRef.current.length;
    
    if (conversationLength <= 2) return 'greeting';
    if (conversationLength <= 6) return 'opener';
    if (conversationLength <= 10) return 'objection';
    if (conversationLength <= 14) return 'pitch';
    return 'closing';
  }, []);

  // Get default character
  const getDefaultCharacter = useCallback(() => {
    return {
      name: 'Sarah Mitchell',
      title: 'VP of Marketing',
      company: 'TechCorp Solutions',
      personality: 'professional, busy, skeptical'
    };
  }, []);
  
  // End the current session
  const endSession = useCallback(async (reason = 'completed') => {
    if (!currentSession) {
      logger.warn('No session to end');
      return null;
    }
    
    try {
      logger.log('🏁 Ending session:', reason);
      
      // CRITICAL FIX: Stop voice services
      voiceService.stopContinuousListening();
      conversationActiveRef.current = false;
      
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
    
    // Stop voice services
    voiceService.stopContinuousListening();
    conversationActiveRef.current = false;
    
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
      currentStage: getCurrentConversationStage()
    };
  }, [currentSession, getCurrentConversationStage]);

  // CRITICAL FIX: Manual user response method (for testing/fallback)
  const handleUserResponse = useCallback(async (userInput) => {
    return await handleUserSpeech(userInput, 1.0);
  }, [handleUserSpeech]);
  
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
    
    // Voice-specific actions
    handleUserSpeech,
    handleSilenceTimeout,
    
    // Session data (for debugging)
    conversation: conversationRef.current,
    evaluations: evaluationsRef.current,
    
    // Service states
    voiceInitialized: voiceInitializedRef.current,
    conversationActive: conversationActiveRef.current
  };
  
  return (
    <RoleplayContext.Provider value={value}>
      {children}
    </RoleplayContext.Provider>
  );
};