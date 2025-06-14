// src/contexts/RoleplayContext.jsx
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { openAIService } from '../services/openaiService';
import { voiceService } from '../services/voiceService';
import logger from '../utils/logger';

const RoleplayContext = createContext();

export const RoleplayProvider = ({ children }) => {
  const [currentSession, setCurrentSession] = useState(null);
  const [callState, setCallState] = useState('idle'); // idle, dialing, connected, ended
  const [sessionResults, setSessionResults] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [lastSpeechTime, setLastSpeechTime] = useState(0);
  const [voiceError, setVoiceError] = useState(null);
  const silenceTimerRef = useRef(null);
  const initializationRef = useRef(false);

  // Safely initialize voice service
  const initializeVoiceService = useCallback(async () => {
    if (initializationRef.current) return true;
    
    try {
      logger.log('🎤 Initializing voice service from context...');
      
      // Check if voiceService exists and has initialize method
      if (!voiceService || typeof voiceService.initialize !== 'function') {
        throw new Error('Voice service not available');
      }

      await voiceService.initialize();
      initializationRef.current = true;
      setVoiceError(null);
      logger.log('✅ Voice service initialized successfully');
      return true;
    } catch (error) {
      logger.error('❌ Voice service initialization failed:', error);
      setVoiceError(error.message);
      return false;
    }
  }, []);

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
        try {
          sessionResult.coaching = await openAIService.generateCoachingFeedback({
            roleplayType: currentSession.roleplayType,
            callsAttempted: 1,
            callsPassed: sessionResult.passed ? 1 : 0,
            averageScore: averageScore,
            commonIssues: evaluations.flatMap(e => e.issues || [])
          });
        } catch (coachingError) {
          logger.error('Failed to generate coaching feedback:', coachingError);
          // Continue without coaching feedback
        }
      }

      setSessionResults(sessionResult);
      logger.log('✅ Session ended successfully:', sessionResult);
      
      return sessionResult;
    } catch (error) {
      logger.error('❌ Error ending session:', error);
      return null;
    }
  }, [currentSession]);

  // Handle silence warning with voice service safety checks
  const handleSilenceWarning = useCallback((silenceSeconds) => {
    logger.log('Silence warning:', silenceSeconds);
    // Add any warning UI or sound here if needed
  }, []);

  // Handle silence timeout with voice service safety checks
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

  // Set up voice service callbacks with safety checks
  useEffect(() => {
    const setupVoiceCallbacks = async () => {
      try {
        // Check if voice service is available and initialized
        if (voiceService && typeof voiceService.setSilenceCallbacks === 'function') {
          voiceService.setSilenceCallbacks(
            handleSilenceWarning,
            handleSilenceTimeout
          );
        }
      } catch (error) {
        logger.error('Error setting up voice callbacks:', error);
      }
    };

    setupVoiceCallbacks();
  }, [handleSilenceWarning, handleSilenceTimeout]);

  // Local silence timer as backup
  useEffect(() => {
    if (isListening) {
      silenceTimerRef.current = setInterval(() => {
        const silenceSeconds = Math.floor((Date.now() - lastSpeechTime) / 1000);
        if (silenceSeconds === 10) {
          handleSilenceWarning(silenceSeconds);
        } else if (silenceSeconds >= 15) {
          handleSilenceTimeout('silence_timeout');
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
      if (openAIService && typeof openAIService.resetConversation === 'function') {
        openAIService.resetConversation();
      }
      
      // Safely cleanup voice service
      if (voiceService && typeof voiceService.cleanup === 'function') {
        voiceService.cleanup();
      }

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
        
        // Start with prospect greeting
        const greeting = "Hello?";
        logger.log('🎭 AI will now speak the greeting:', greeting);
        
        try {
          // Initialize voice service before speaking
          const voiceInitialized = await initializeVoiceService();
          
          if (voiceInitialized && voiceService && typeof voiceService.speakText === 'function') {
            logger.log('🔊 Attempting to speak greeting...');
            await voiceService.speakText(greeting, {
              voiceId: 'Joanna',
              rate: 0.9,
              pitch: 1.0
            });
            logger.log('✅ Greeting spoken successfully');
          } else {
            logger.warn('⚠️ Voice service not available, skipping greeting speech');
          }
        } catch (error) {
          logger.error('❌ Error speaking greeting:', error);
          setVoiceError('Voice service error: ' + error.message);
        }
        
        logger.log('✅ Roleplay session started successfully');
      }, 2000);

      return sessionData;
    } catch (error) {
      logger.error('❌ Error starting roleplay session:', error);
      throw error;
    }
  }, [initializeVoiceService]);

  const handleUserResponse = useCallback(async (response) => {
    try {
      setIsProcessing(true);
      
      // Check if openAI service is available
      if (!openAIService || typeof openAIService.getProspectResponse !== 'function') {
        throw new Error('OpenAI service not available');
      }
      
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
      
      // Speak the prospect's response with error handling
      let speechResult = null;
      try {
        const voiceInitialized = await initializeVoiceService();
        
        if (voiceInitialized && voiceService && typeof voiceService.speakText === 'function') {
          logger.log('🔊 Attempting to speak with voice service...');
          speechResult = await voiceService.speakText(response, {
            voiceId: 'Joanna', // Female US voice
            rate: 0.9,
            pitch: 1.0
          });
          logger.log('✅ Speech completed:', speechResult);
        } else {
          logger.warn('⚠️ Voice service not available for prospect response');
          speechResult = { success: false, error: 'Voice service not available' };
        }
      } catch (speechError) {
        logger.error('❌ Error speaking prospect response:', speechError);
        setVoiceError('Speech error: ' + speechError.message);
        speechResult = { success: false, error: speechError.message };
      }
      
      // Update conversation history regardless of speech success
      setCurrentSession(prev => ({
        ...prev,
        conversationHistory: [
          ...prev.conversationHistory,
          { role: 'prospect', content: response }
        ]
      }));
      
      return speechResult;
    } catch (error) {
      logger.error('❌ Error handling prospect response:', error);
      throw error;
    }
  }, [currentSession, initializeVoiceService]);

  const resetSession = useCallback(() => {
    setCurrentSession(null);
    setCallState('idle');
    setSessionResults(null);
    setIsProcessing(false);
    setVoiceError(null);
    
    // Safely reset services
    if (openAIService && typeof openAIService.resetConversation === 'function') {
      openAIService.resetConversation();
    }
    
    if (voiceService && typeof voiceService.cleanup === 'function') {
      voiceService.cleanup();
    }
    
    initializationRef.current = false;
  }, []);

  const handleStart = useCallback(async () => {
    try {
      setIsProcessing(true);
      setVoiceError(null);
      
      const session = await startRoleplaySession(currentSession?.roleplayType, currentSession?.mode);
      if (!session) {
        throw new Error('Failed to start session');
      }
      setIsListening(true);
      setLastSpeechTime(Date.now());
    } catch (error) {
      logger.error('Error starting roleplay:', error);
      setVoiceError('Failed to start: ' + error.message);
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
    isListening,
    voiceError,
    
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
    handleEnd,
    
    // Utility
    initializeVoiceService
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