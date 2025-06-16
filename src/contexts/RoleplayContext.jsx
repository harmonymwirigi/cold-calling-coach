// src/contexts/RoleplayContext.jsx - FIXED WITH COMPLETE OPENAI INTEGRATION
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useProgress } from './ProgressContext';
import { voiceService } from '../services/voiceService';
import { roleplayEngine } from '../services/roleplayEngine';
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

  // Start roleplay session with OpenAI integration
  const startRoleplaySession = useCallback(async (roleplayType, mode, metadata = {}) => {
    try {
      logger.log('🎬 [ROLEPLAY] Starting OpenAI-powered session:', { roleplayType, mode });
      
      // Reset flags
      isEndingSessionRef.current = false;
      updateCallState('idle');
      updateIsProcessing(false);
      
      // Check access first
      const accessCheck = await canAccessRoleplay(roleplayType, mode);
      if (!accessCheck.allowed) {
        throw new Error(accessCheck.reason);
      }

      // Initialize voice service
      logger.log('🔄 [ROLEPLAY] Initializing voice service...');
      await voiceService.initialize();
      
      // Initialize roleplay engine with OpenAI integration
      logger.log('🤖 [ROLEPLAY] Initializing OpenAI-powered roleplay engine...');
      const engineResult = await roleplayEngine.initializeSession(
        userProfile?.id,
        roleplayType,
        mode,
        userProfile
      );

      if (!engineResult.success) {
        throw new Error(engineResult.error || 'Failed to initialize OpenAI engine');
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
      
      logger.log('✅ [ROLEPLAY] OpenAI-powered session initialized successfully');
      
      // Start the conversation flow with OpenAI
      setTimeout(async () => {
        if (isEndingSessionRef.current) {
          logger.log('⚠️ [ROLEPLAY] Session ended during startup');
          return;
        }
        
        logger.log('🔄 [ROLEPLAY] Setting call state to connected');
        updateCallState('connected');
        
        // Get AI's opening message from OpenAI through engine
        logger.log('🤖 [ROLEPLAY] Getting OpenAI greeting...');
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
            timestamp: Date.now(),
            source: 'openai'
          };
          
          setConversationHistory([greetingEntry]);
          
          // Start voice conversation
          setTimeout(() => {
            logger.log('🎤 [ROLEPLAY] Starting voice conversation with OpenAI responses');
            const success = voiceService.startConversation(
              handleUserSpeech,
              handleVoiceError
            );
            logger.log('🎤 [ROLEPLAY] Voice conversation started:', success);
          }, 100);
          
          // Speak the OpenAI greeting
          try {
            logger.log('🗣️ [ROLEPLAY] Speaking OpenAI greeting:', openingResponse.response);
            await voiceService.speakText(openingResponse.response);
            logger.log('✅ [ROLEPLAY] OpenAI greeting spoken successfully');
          } catch (speakError) {
            logger.error('❌ [ROLEPLAY] Failed to speak OpenAI greeting:', speakError);
          }
        } else {
          logger.error('❌ [ROLEPLAY] Failed to get OpenAI greeting:', openingResponse);
          throw new Error('OpenAI greeting failed');
        }
        
      }, 2000);
      
      return session;
      
    } catch (error) {
      logger.error('❌ [ROLEPLAY] Error starting OpenAI session:', error);
      throw error;
    }
  }, [userProfile, canAccessRoleplay, updateCallState, updateIsProcessing]);

  // Handle user speech with complete OpenAI integration
  const handleUserSpeech = useCallback(async (transcript, confidence) => {
    logger.log('🗣️ [ROLEPLAY] ====== handleUserSpeech WITH OPENAI ======');
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

      logger.log('🤖 [ROLEPLAY] Processing user input with OpenAI engine...');
      
      // Process input through roleplay engine (which uses OpenAI)
      const engineResult = await roleplayEngine.processUserInput(transcript, {
        roleplayType: sessionRef.current.roleplayType,
        mode: sessionRef.current.mode,
        stage: currentStage,
        userProfile: sessionRef.current.userProfile
      });

      logger.log('🤖 [ROLEPLAY] OpenAI Engine result received:', {
        success: engineResult.success,
        hasResponse: !!engineResult.response,
        shouldHangUp: engineResult.shouldHangUp,
        callPassed: engineResult.callPassed,
        sessionComplete: engineResult.sessionComplete,
        source: 'openai_engine'
      });

      // Check if session ended during processing
      if (isEndingSessionRef.current) {
        logger.log('⚠️ [ROLEPLAY] Session ended during OpenAI processing, aborting');
        return;
      }

      if (engineResult.success) {
        // Handle session completion
        if (engineResult.sessionComplete) {
          logger.log('🏁 [ROLEPLAY] Session completed by OpenAI engine');
          handleSessionCompletion(engineResult);
          return;
        }

        // Handle call completion (for marathon/legend modes)
        if (engineResult.callResult) {
          logger.log('📞 [ROLEPLAY] Call completed by OpenAI:', engineResult.callResult);
          setCallCount(engineResult.callResult.callNumber);
          if (engineResult.callResult.passed) {
            setPassCount(prev => prev + 1);
          }
        }

        // Add AI response to conversation if provided (this is from OpenAI!)
        if (engineResult.response) {
          const aiEntry = {
            speaker: 'ai',
            message: engineResult.response,
            timestamp: Date.now(),
            source: 'openai'
          };
          
          setConversationHistory(prev => {
            const updated = [...prev, aiEntry];
            logger.log('📝 [ROLEPLAY] Added OpenAI response to history. Total length:', updated.length);
            return updated;
          });

          setCurrentMessage(engineResult.response);
          
          // Update current stage
          if (engineResult.stage) {
            setCurrentStage(engineResult.stage);
          }
        }

        // Speak AI response (this is OpenAI's response!)
        if (engineResult.response && !engineResult.shouldHangUp) {
          try {
            logger.log('🗣️ [ROLEPLAY] Speaking OpenAI response...');
            await voiceService.speakText(engineResult.response);
            logger.log('✅ [ROLEPLAY] OpenAI response spoken successfully');
          } catch (speakError) {
            logger.error('❌ [ROLEPLAY] Failed to speak OpenAI response:', speakError);
          }
        }

        // Handle hangup if required
        if (engineResult.shouldHangUp) {
          logger.log('🔚 [ROLEPLAY] OpenAI engine requests hangup');
          
          if (engineResult.nextCall) {
            // Start next call in marathon/legend mode (still using OpenAI)
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
        logger.error('❌ [ROLEPLAY] OpenAI engine processing failed:', engineResult.error);
        
        // Emergency fallback (but still try to use OpenAI if possible)
        if (!isEndingSessionRef.current) {
          const fallbackResponse = "Sorry, I had trouble understanding. Could you try again?";
          setCurrentMessage(fallbackResponse);
          
          const fallbackEntry = {
            speaker: 'ai',
            message: fallbackResponse,
            timestamp: Date.now(),
            source: 'fallback'
          };
          
          setConversationHistory(prev => [...prev, fallbackEntry]);
          
          try {
            await voiceService.speakText(fallbackResponse);
          } catch (speakError) {
            logger.error('❌ [ROLEPLAY] Failed to speak fallback:', speakError);
          }
        }
      }

    } catch (error) {
      logger.error('❌ [ROLEPLAY] Error processing user speech with OpenAI:', error);
      
      // Emergency recovery
      if (!isEndingSessionRef.current) {
        try {
          const errorResponse = "Sorry, something went wrong. Could you try again?";
          setCurrentMessage(errorResponse);
          
          const errorEntry = {
            speaker: 'ai',
            message: errorResponse,
            timestamp: Date.now(),
            source: 'error'
          };
          
          setConversationHistory(prev => [...prev, errorEntry]);
          await voiceService.speakText(errorResponse);
        } catch (recoveryError) {
          logger.error('❌ [ROLEPLAY] Recovery failed:', recoveryError);
        }
      }
    } finally {
      logger.log('🔄 [ROLEPLAY] Setting isProcessing to FALSE');
      updateIsProcessing(false);
      logger.log('🗣️ [ROLEPLAY] ====== handleUserSpeech WITH OPENAI COMPLETED ======');
    }
  }, [updateIsProcessing, currentStage]);

  // Start next call in marathon/legend mode (using OpenAI)
  const startNextCall = useCallback(async () => {
    logger.log('📞 [ROLEPLAY] Starting next call with OpenAI...');
    
    // Reset for next call
    setCurrentStage('greeting');
    setCurrentMessage('');
    
    // Clear conversation history for new call
    setConversationHistory([]);
    
    // Start with OpenAI greeting
    setTimeout(async () => {
      try {
        logger.log('🤖 [ROLEPLAY] Getting OpenAI greeting for next call...');
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
            timestamp: Date.now(),
            source: 'openai'
          };
          
          setConversationHistory([greetingEntry]);
          
          logger.log('🗣️ [ROLEPLAY] Speaking OpenAI greeting for next call...');
          await voiceService.speakText(greetingResponse.response);
          logger.log('✅ [ROLEPLAY] OpenAI greeting for next call spoken successfully');
        } else {
          logger.error('❌ [ROLEPLAY] Failed to get OpenAI greeting for next call');
        }
      } catch (error) {
        logger.error('❌ [ROLEPLAY] Error getting OpenAI greeting for next call:', error);
      }
    }, 500);
  }, []);

  // Handle session completion
  const handleSessionCompletion = useCallback(async (engineResult) => {
    try {
      logger.log('🏁 [ROLEPLAY] Handling OpenAI session completion:', engineResult);

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
        finalMessage: engineResult.response,
        openaiPowered: true
      });

      updateCallState('ended');

    } catch (error) {
      logger.error('❌ [ROLEPLAY] Error handling OpenAI session completion:', error);
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
      logger.log('🏁 [ROLEPLAY] Ending OpenAI session:', reason);
      
      // Set ending flag immediately
      isEndingSessionRef.current = true;
      
      // Stop voice service immediately
      logger.log('🔇 [ROLEPLAY] Stopping voice service immediately...');
      voiceService.stopConversation();
      voiceService.stopSpeaking();
      voiceService.stopListening();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get final results from OpenAI engine if available
      let sessionResults = null;
      
      try {
        logger.log('🤖 [ROLEPLAY] Completing OpenAI session...');
        sessionResults = await roleplayEngine.completeSession(reason === 'completed', null);
      } catch (engineError) {
        logger.warn('OpenAI engine completion failed:', engineError);
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
          unlocks: [],
          openaiPowered: true
        };
      }

      updateCallState('ended');
      setSessionResults(sessionResults);
      
      logger.log('✅ [ROLEPLAY] OpenAI session ended successfully');
      return sessionResults;
      
    } catch (error) {
      logger.error('❌ [ROLEPLAY] Error ending OpenAI session:', error);
      return null;
    }
  }, [callCount, passCount, updateCallState]);

  // Reset session
  const resetSession = useCallback(() => {
    logger.log('🔄 [ROLEPLAY] Resetting OpenAI session');
    
    isEndingSessionRef.current = true;
    
    // Stop voice service
    voiceService.stopConversation();
    voiceService.stopSpeaking();
    voiceService.stopListening();
    voiceService.cleanup();
    
    // Reset OpenAI engine
    roleplayEngine.reset();
    
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
    
    logger.log('✅ [ROLEPLAY] OpenAI session reset complete');
  }, [updateCallState, updateIsProcessing]);

  // Get session stats
  const getSessionStats = useCallback(() => {
    if (!sessionRef.current) return null;
    
    return {
      callCount,
      passCount,
      currentStage,
      conversationLength: conversationHistory.length,
      openaiPowered: true
    };
  }, [callCount, passCount, currentStage, conversationHistory.length]);

  // Manual user response for testing (also uses OpenAI)
  const handleUserResponse = useCallback(async (userInput) => {
    logger.log('📝 [ROLEPLAY] Manual user response (OpenAI):', userInput);
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
    voiceService,
    
    // OpenAI integration indicator
    openaiPowered: true
  };
  
  return (
    <RoleplayContext.Provider value={value}>
      {children}
    </RoleplayContext.Provider>
  );
};