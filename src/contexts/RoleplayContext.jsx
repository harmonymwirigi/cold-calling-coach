// src/contexts/RoleplayContext.jsx - UPDATED WITH ENGINE INTEGRATION
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useProgress } from './ProgressContext';
import { voiceService } from '../services/voiceService';
import { roleplayEngine } from '../services/roleplayEngine';
import { supabase } from '../config/supabase';
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
  const { updateProgress, canAccessRoleplay } = useProgress();
  
  // Session state
  const [currentSession, setCurrentSession] = useState(null);
  const [callState, setCallState] = useState('idle');
  const [sessionResults, setSessionResults] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [currentStage, setCurrentStage] = useState('greeting');
  const [callCount, setCallCount] = useState(0);
  const [passCount, setPassCount] = useState(0);
  
  // Use refs for state that needs to be current in callbacks
  const sessionRef = useRef(null);
  const isEndingSessionRef = useRef(false);
  const callStateRef = useRef('idle');
  const isProcessingRef = useRef(false);

  // Update refs whenever state changes
  const updateCallState = useCallback((newState) => {
    logger.log('🔄 [ROLEPLAY] Updating call state:', newState);
    callStateRef.current = newState;
    setCallState(newState);
  }, []);

  const updateIsProcessing = useCallback((newValue) => {
    logger.log('🔄 [ROLEPLAY] Updating isProcessing:', newValue);
    isProcessingRef.current = newValue;
    setIsProcessing(newValue);
  }, []);

  // Start roleplay session with proper access checking and engine integration
  const startRoleplaySession = useCallback(async (roleplayType, mode, metadata = {}) => {
    try {
      logger.log('🎬 [ROLEPLAY] Starting session:', { roleplayType, mode });
      
      // Reset flags
      isEndingSessionRef.current = false;
      updateCallState('idle');
      updateIsProcessing(false);
      
      // Check access first
      const accessCheck = await canAccessRoleplay(roleplayType, mode);
      if (!accessCheck.allowed) {
        throw new Error(accessCheck.reason);
      }

      // Initialize services
      logger.log('🔄 [ROLEPLAY] Initializing services...');
      await voiceService.initialize();
      
      // Initialize roleplay engine
      const engineResult = await roleplayEngine.initializeSession(
        userProfile?.id,
        roleplayType,
        mode,
        userProfile
      );

      if (!engineResult.success) {
        throw new Error(engineResult.error);
      }

      const session = engineResult.session;
      
      // Set session state
      sessionRef.current = session;
      setCurrentSession(session);
      setConversationHistory([]);
      setSessionResults(null);
      setCurrentStage('greeting');
      setCallCount(0);
      setPassCount(0);
      updateCallState('dialing');
      
      logger.log('✅ [ROLEPLAY] Session initialized successfully');
      
      // Start the conversation flow after delay
      setTimeout(async () => {
        if (isEndingSessionRef.current) {
          logger.log('⚠️ [ROLEPLAY] Session ended during startup');
          return;
        }
        
        logger.log('🔄 [ROLEPLAY] Setting call state to connected');
        updateCallState('connected');
        
        // Get AI's opening message from engine
        const openingResponse = await roleplayEngine.processUserInput('', {
          stage: 'greeting',
          isGreeting: true
        });

        if (openingResponse.success && openingResponse.response) {
          setCurrentMessage(openingResponse.response);
          setCurrentStage(openingResponse.stage || 'opener');
          
          // Add to conversation history
          const greetingEntry = {
            speaker: 'ai',
            message: openingResponse.response,
            timestamp: Date.now()
          };
          
          setConversationHistory([greetingEntry]);
          
          // Start voice conversation
          setTimeout(() => {
            logger.log('🎤 [ROLEPLAY] Starting voice conversation');
            const success = voiceService.startConversation(
              handleUserSpeech,
              handleVoiceError
            );
            logger.log('🎤 [ROLEPLAY] Voice conversation started:', success);
          }, 100);
          
          // Speak the greeting
          try {
            logger.log('🗣️ [ROLEPLAY] Speaking greeting:', openingResponse.response);
            await voiceService.speakText(openingResponse.response);
            logger.log('✅ [ROLEPLAY] Greeting spoken successfully');
          } catch (speakError) {
            logger.error('❌ [ROLEPLAY] Failed to speak greeting:', speakError);
          }
        }
        
      }, 2000);
      
      return session;
      
    } catch (error) {
      logger.error('❌ [ROLEPLAY] Error starting session:', error);
      throw error;
    }
  }, [userProfile, canAccessRoleplay, updateCallState, updateIsProcessing]);

  // Handle user speech with engine integration
  const handleUserSpeech = useCallback(async (transcript, confidence) => {
    logger.log('🗣️ [ROLEPLAY] ====== handleUserSpeech CALLED ======');
    logger.log('🗣️ [ROLEPLAY] Transcript:', transcript);
    logger.log('🗣️ [ROLEPLAY] Current state:', {
      hasSession: !!sessionRef.current,
      callState: callStateRef.current,
      isEnding: isEndingSessionRef.current,
      isProcessing: isProcessingRef.current
    });

    // Use refs for current state
    if (!sessionRef.current) {
      logger.log('⚠️ [ROLEPLAY] No session, ignoring speech');
      return;
    }

    if (callStateRef.current !== 'connected') {
      logger.log('⚠️ [ROLEPLAY] Call not connected, ignoring speech');
      return;
    }

    if (isEndingSessionRef.current) {
      logger.log('⚠️ [ROLEPLAY] Session ending, ignoring speech');
      return;
    }

    if (isProcessingRef.current) {
      logger.log('⚠️ [ROLEPLAY] Already processing, ignoring speech');
      return;
    }

    try {
      logger.log('🔄 [ROLEPLAY] Setting isProcessing to TRUE');
      updateIsProcessing(true);

      // Add user input to conversation history
      const userEntry = {
        speaker: 'user',
        message: transcript,
        timestamp: Date.now()
      };
      
      setConversationHistory(prev => {
        const updated = [...prev, userEntry];
        logger.log('📝 [ROLEPLAY] Updated conversation history. Length:', updated.length);
        return updated;
      });

      logger.log('🤖 [ROLEPLAY] Processing user input with engine...');
      
      // Process input through roleplay engine
      const engineResult = await roleplayEngine.processUserInput(transcript, {
        roleplayType: sessionRef.current.roleplayType,
        mode: sessionRef.current.mode,
        stage: currentStage,
        userProfile: sessionRef.current.userProfile
      });

      logger.log('🤖 [ROLEPLAY] Engine result received:', {
        success: engineResult.success,
        hasResponse: !!engineResult.response,
        shouldHangUp: engineResult.shouldHangUp,
        callPassed: engineResult.callPassed,
        sessionComplete: engineResult.sessionComplete
      });

      // Check if session ended during processing
      if (isEndingSessionRef.current) {
        logger.log('⚠️ [ROLEPLAY] Session ended during processing, aborting');
        return;
      }

      if (engineResult.success) {
        // Handle session completion
        if (engineResult.sessionComplete) {
          logger.log('🏁 [ROLEPLAY] Session completed by engine');
          handleSessionCompletion(engineResult);
          return;
        }

        // Handle call completion (for marathon/legend modes)
        if (engineResult.callResult) {
          logger.log('📞 [ROLEPLAY] Call completed:', engineResult.callResult);
          setCallCount(engineResult.callResult.callNumber);
          if (engineResult.callResult.passed) {
            setPassCount(prev => prev + 1);
          }
        }

        // Add AI response to conversation if provided
        if (engineResult.response) {
          const aiEntry = {
            speaker: 'ai',
            message: engineResult.response,
            timestamp: Date.now()
          };
          
          setConversationHistory(prev => {
            const updated = [...prev, aiEntry];
            logger.log('📝 [ROLEPLAY] Added AI response to history. Total length:', updated.length);
            return updated;
          });

          setCurrentMessage(engineResult.response);
          
          // Update current stage
          if (engineResult.stage) {
            setCurrentStage(engineResult.stage);
          }
        }

        // Speak AI response
        if (engineResult.response && !engineResult.shouldHangUp) {
          try {
            logger.log('🗣️ [ROLEPLAY] Speaking AI response...');
            await voiceService.speakText(engineResult.response);
            logger.log('✅ [ROLEPLAY] AI response spoken successfully');
          } catch (speakError) {
            logger.error('❌ [ROLEPLAY] Failed to speak AI response:', speakError);
          }
        }

        // Handle hangup if required
        if (engineResult.shouldHangUp) {
          logger.log('🔚 [ROLEPLAY] Engine requests hangup');
          
          if (engineResult.nextCall) {
            // Start next call in marathon/legend mode
            setTimeout(() => {
              startNextCall();
            }, 2000);
          } else {
            // End session
            setTimeout(() => {
              endSession(engineResult.reason || 'completed');
            }, 2000);
          }
          return;
        }

      } else {
        logger.error('❌ [ROLEPLAY] Engine processing failed:', engineResult.error);
        
        // Emergency fallback
        if (!isEndingSessionRef.current) {
          const fallbackResponse = "Sorry, I had trouble understanding. Could you try again?";
          setCurrentMessage(fallbackResponse);
          
          try {
            await voiceService.speakText(fallbackResponse);
          } catch (speakError) {
            logger.error('❌ [ROLEPLAY] Failed to speak fallback:', speakError);
          }
        }
      }

    } catch (error) {
      logger.error('❌ [ROLEPLAY] Error processing user speech:', error);
      
      // Emergency recovery
      if (!isEndingSessionRef.current) {
        try {
          const errorResponse = "Sorry, something went wrong. Could you try again?";
          setCurrentMessage(errorResponse);
          await voiceService.speakText(errorResponse);
        } catch (recoveryError) {
          logger.error('❌ [ROLEPLAY] Recovery failed:', recoveryError);
        }
      }
    } finally {
      logger.log('🔄 [ROLEPLAY] Setting isProcessing to FALSE');
      updateIsProcessing(false);
      logger.log('🗣️ [ROLEPLAY] ====== handleUserSpeech COMPLETED ======');
    }
  }, [updateIsProcessing, currentStage]);

  // Start next call in marathon/legend mode
  const startNextCall = useCallback(() => {
    logger.log('📞 [ROLEPLAY] Starting next call...');
    
    // Reset for next call
    setCurrentStage('greeting');
    setCurrentMessage('');
    
    // Clear conversation history for new call
    setConversationHistory([]);
    
    // Start with greeting
    setTimeout(async () => {
      const greetingResponse = await roleplayEngine.processUserInput('', {
        stage: 'greeting',
        isGreeting: true
      });

      if (greetingResponse.success && greetingResponse.response) {
        setCurrentMessage(greetingResponse.response);
        setCurrentStage(greetingResponse.stage || 'opener');
        
        const greetingEntry = {
          speaker: 'ai',
          message: greetingResponse.response,
          timestamp: Date.now()
        };
        
        setConversationHistory([greetingEntry]);
        
        try {
          await voiceService.speakText(greetingResponse.response);
        } catch (error) {
          logger.error('Failed to speak greeting for next call:', error);
        }
      }
    }, 500);
  }, []);

  // Handle session completion
  const handleSessionCompletion = useCallback(async (engineResult) => {
    try {
      logger.log('🏁 [ROLEPLAY] Handling session completion:', engineResult);

      // Update progress
      if (sessionRef.current && engineResult.metrics) {
        const progressResult = await updateProgress(sessionRef.current.roleplayType, {
          mode: sessionRef.current.mode,
          passed: engineResult.sessionPassed,
          averageScore: engineResult.metrics.averageScore,
          metrics: engineResult.metrics
        });

        // Add unlock information to result
        engineResult.unlocks = progressResult.unlocks || [];
      }

      // Set session results
      setSessionResults({
        sessionId: sessionRef.current?.id,
        roleplayType: sessionRef.current?.roleplayType,
        mode: sessionRef.current?.mode,
        passed: engineResult.sessionPassed,
        metrics: engineResult.metrics,
        unlocks: engineResult.unlocks || [],
        finalMessage: engineResult.response
      });

      updateCallState('ended');

    } catch (error) {
      logger.error('❌ [ROLEPLAY] Error handling session completion:', error);
    }
  }, [updateProgress]);

  // Handle voice errors
  const handleVoiceError = useCallback((error) => {
    logger.error('🎤 [ROLEPLAY] Voice error:', error);
  }, []);

  // End session manually
  const endSession = useCallback(async (reason = 'completed') => {
    if (!sessionRef.current || isEndingSessionRef.current) {
      logger.log('⚠️ [ROLEPLAY] Session already ending or no session');
      return null;
    }

    try {
      logger.log('🏁 [ROLEPLAY] Ending session:', reason);
      
      // Set ending flag immediately
      isEndingSessionRef.current = true;
      
      // Stop voice service immediately
      logger.log('🔇 [ROLEPLAY] Stopping voice service immediately...');
      voiceService.stopConversation();
      voiceService.stopSpeaking();
      voiceService.stopListening();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get final results from engine if available
      let sessionResults = null;
      
      try {
        // Try to complete the session through the engine
        sessionResults = await roleplayEngine.completeSession(reason === 'completed', null);
      } catch (engineError) {
        logger.warn('Engine completion failed:', engineError);
      }

      // Set basic results if engine didn't provide them
      if (!sessionResults) {
        sessionResults = {
          sessionId: sessionRef.current.id,
          roleplayType: sessionRef.current.roleplayType,
          mode: sessionRef.current.mode,
          passed: false,
          metrics: {
            totalCalls: callCount,
            passedCalls: passCount,
            passRate: callCount > 0 ? Math.round((passCount / callCount) * 100) : 0,
            averageScore: 60
          },
          unlocks: []
        };
      }

      updateCallState('ended');
      setSessionResults(sessionResults);
      
      logger.log('✅ [ROLEPLAY] Session ended successfully');
      return sessionResults;
      
    } catch (error) {
      logger.error('❌ [ROLEPLAY] Error ending session:', error);
      return null;
    }
  }, [callCount, passCount, updateCallState]);

  // Reset session
  const resetSession = useCallback(() => {
    logger.log('🔄 [ROLEPLAY] Resetting session');
    
    isEndingSessionRef.current = true;
    
    // Stop voice service
    voiceService.stopConversation();
    voiceService.stopSpeaking();
    voiceService.stopListening();
    voiceService.cleanup();
    
    // Reset state
    setCurrentSession(null);
    updateCallState('idle');
    setSessionResults(null);
    updateIsProcessing(false);
    setCurrentMessage('');
    setConversationHistory([]);
    setCurrentStage('greeting');
    setCallCount(0);
    setPassCount(0);
    
    sessionRef.current = null;
    isEndingSessionRef.current = false;
    
    logger.log('✅ [ROLEPLAY] Session reset complete');
  }, [updateCallState, updateIsProcessing]);

  // Get session stats
  const getSessionStats = useCallback(() => {
    if (!sessionRef.current) return null;
    
    return {
      callCount,
      passCount,
      currentStage,
      conversationLength: conversationHistory.length
    };
  }, [callCount, passCount, currentStage, conversationHistory.length]);

  // Manual user response for testing
  const handleUserResponse = useCallback(async (userInput) => {
    logger.log('📝 [ROLEPLAY] Manual user response:', userInput);
    return await handleUserSpeech(userInput, 1.0);
  }, [handleUserSpeech]);

  const value = {
    // State
    currentSession,
    callState,
    sessionResults,
    isProcessing,
    currentMessage,
    conversationHistory,
    currentStage,
    callCount,
    passCount,
    
    // Actions
    startRoleplaySession,
    handleUserResponse,
    endSession,
    resetSession,
    getSessionStats,
    
    // Voice service state
    voiceService
  };
  
  return (
    <RoleplayContext.Provider value={value}>
      {children}
    </RoleplayContext.Provider>
  );
};