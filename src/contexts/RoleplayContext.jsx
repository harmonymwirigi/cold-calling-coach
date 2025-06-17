// src/contexts/RoleplayContext.jsx - FIXED SESSION STARTUP FLOW
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useProgress } from './ProgressContext';
import { voiceService } from '../services/voiceService';
import { roleplayEngine } from '../services/roleplayEngine';
import { progressTracker } from '../services/progressTracker';
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
  const { loadProgressData } = useProgress();
  
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
  const [evaluations, setEvaluations] = useState([]);
  
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

  // Start roleplay session - FIXED FLOW
  const startRoleplaySession = useCallback(async (roleplayType, mode, metadata = {}) => {
    try {
      logger.log('🎬 [ROLEPLAY] Starting session:', { roleplayType, mode });
      
      // Reset flags and state
      isEndingSessionRef.current = false;
      updateCallState('idle');
      updateIsProcessing(false);
      
      // Clear previous state
      setConversationHistory([]);
      setSessionResults(null);
      setCurrentStage('greeting');
      setCallCount(0);
      setPassCount(0);
      setEvaluations([]);
      setCurrentMessage('');
      
      // Check access through progressTracker
      const accessCheck = await progressTracker.checkModuleAccess(userProfile?.id, roleplayType, mode);
      if (!accessCheck.allowed) {
        throw new Error(accessCheck.reason);
      }

      // Initialize voice service first
      logger.log('🔄 [ROLEPLAY] Initializing voice service...');
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
      updateCallState('dialing');
      
      logger.log('✅ [ROLEPLAY] Session initialized, starting greeting flow');
      
      // Start the greeting flow with proper delay
      setTimeout(async () => {
        if (isEndingSessionRef.current) {
          logger.log('⚠️ [ROLEPLAY] Session ended during startup');
          return;
        }
        
        try {
          updateCallState('connected');
          
          // Handle greeting stage - FIXED TO GET AI RESPONSE
          logger.log('🔄 [ROLEPLAY] Processing greeting...');
          const greetingResponse = await roleplayEngine.processUserInput('', {
            stage: 'greeting',
            isGreeting: true
          });

          if (greetingResponse.success && greetingResponse.response) {
            logger.log('✅ [ROLEPLAY] Greeting received:', greetingResponse.response);
            
            setCurrentMessage(greetingResponse.response);
            setCurrentStage(greetingResponse.stage || 'opener');
            
            // Add to conversation history
            const greetingEntry = {
              speaker: 'ai',
              message: greetingResponse.response,
              timestamp: Date.now()
            };
            
            setConversationHistory([greetingEntry]);
            
            // Speak the greeting
            try {
              logger.log('🗣️ [ROLEPLAY] Speaking greeting...');
              await voiceService.speakText(greetingResponse.response);
              logger.log('✅ [ROLEPLAY] Greeting spoken successfully');
              
              // FIXED: Voice conversation will be started by UnifiedPhoneInterface
              // after it detects the AI has finished speaking
              
            } catch (speakError) {
              logger.error('❌ [ROLEPLAY] Failed to speak greeting:', speakError);
            }
          } else {
            logger.error('❌ [ROLEPLAY] Failed to get greeting response');
            throw new Error('Failed to initialize conversation');
          }
        } catch (error) {
          logger.error('❌ [ROLEPLAY] Error in greeting flow:', error);
          throw error;
        }
        
      }, 2000); // 2 second delay for dialing state
      
      return session;
      
    } catch (error) {
      logger.error('❌ [ROLEPLAY] Error starting session:', error);
      updateCallState('idle');
      throw error;
    }
  }, [userProfile, updateCallState, updateIsProcessing]);

  // Handle user speech - SIMPLIFIED AND FIXED
  const handleUserSpeech = useCallback(async (transcript, confidence) => {
    logger.log('🗣️ [ROLEPLAY] ====== handleUserSpeech CALLED ======');
    logger.log('🗣️ [ROLEPLAY] Transcript:', transcript);
    logger.log('🗣️ [ROLEPLAY] Current state:', {
      hasSession: !!sessionRef.current,
      callState: callStateRef.current,
      isEnding: isEndingSessionRef.current,
      isProcessing: isProcessingRef.current
    });

    // Check preconditions
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
      
      setConversationHistory(prev => [...prev, userEntry]);

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
        sessionComplete: engineResult.sessionComplete
      });

      // Check if session ended during processing
      if (isEndingSessionRef.current) {
        logger.log('⚠️ [ROLEPLAY] Session ended during processing, aborting');
        return;
      }

      if (engineResult.success) {
        // Track evaluation if provided
        if (engineResult.evaluation) {
          setEvaluations(prev => [...prev, {
            stage: currentStage,
            userInput: transcript,
            evaluation: engineResult.evaluation,
            timestamp: Date.now()
          }]);
        }

        // Handle session completion
        if (engineResult.sessionComplete) {
          logger.log('🏁 [ROLEPLAY] Session completed by engine');
          await handleSessionCompletion(engineResult);
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
          
          setConversationHistory(prev => [...prev, aiEntry]);
          setCurrentMessage(engineResult.response);
          
          // Update current stage
          if (engineResult.stage) {
            setCurrentStage(engineResult.stage);
          }
        }

        // Speak AI response if provided and not hanging up
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
            // End session and record results
            setTimeout(() => {
              endSessionWithResults(engineResult);
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
    setEvaluations([]);
    
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

  // Handle session completion with proper score recording
  const handleSessionCompletion = useCallback(async (engineResult) => {
    try {
      logger.log('🏁 [ROLEPLAY] Handling session completion with score recording:', engineResult);

      if (!sessionRef.current) {
        logger.error('❌ [ROLEPLAY] No session reference for completion');
        return;
      }

      // Prepare session result data for scoring
      const sessionResultData = {
        sessionId: sessionRef.current.id,
        passed: engineResult.sessionPassed || false,
        averageScore: engineResult.metrics?.averageScore || 0,
        passedCalls: engineResult.metrics?.passedCalls || passCount,
        totalCalls: engineResult.metrics?.totalCalls || callCount,
        correctAnswers: engineResult.metrics?.correctAnswers,
        totalQuestions: engineResult.metrics?.totalQuestions,
        completed: true,
        duration: Math.floor((Date.now() - new Date(sessionRef.current.startedAt).getTime()) / 1000),
        evaluations: evaluations,
        metrics: engineResult.metrics || {}
      };

      logger.log('📊 [ROLEPLAY] Recording session with progressTracker:', sessionResultData);

      // Record session completion and handle unlocks through progressTracker
      const progressResult = await progressTracker.recordSessionCompletion(
        sessionRef.current.userId,
        sessionRef.current.roleplayType,
        sessionRef.current.mode,
        sessionResultData
      );

      logger.log('✅ [ROLEPLAY] Progress recorded:', progressResult);

      // Refresh progress data in context
      if (loadProgressData) {
        await loadProgressData();
      }

      // Set session results with unlock information
      setSessionResults({
        ...sessionResultData,
        unlocks: progressResult.unlocks || [],
        finalMessage: engineResult.response,
        progressMessage: progressResult.message
      });

      updateCallState('ended');

    } catch (error) {
      logger.error('❌ [ROLEPLAY] Error handling session completion:', error);
      
      // Set basic results even if progress recording failed
      setSessionResults({
        sessionId: sessionRef.current?.id,
        roleplayType: sessionRef.current?.roleplayType,
        mode: sessionRef.current?.mode,
        passed: engineResult.sessionPassed || false,
        metrics: engineResult.metrics || {},
        unlocks: [],
        finalMessage: engineResult.response || 'Session completed',
        progressMessage: 'Session completed (progress recording failed)'
      });

      updateCallState('ended');
    }
  }, [evaluations, callCount, passCount, loadProgressData, updateCallState]);

  // End session with results recording
  const endSessionWithResults = useCallback(async (engineResult) => {
    if (!sessionRef.current || isEndingSessionRef.current) {
      logger.log('⚠️ [ROLEPLAY] Session already ending or no session');
      return null;
    }

    try {
      logger.log('🏁 [ROLEPLAY] Ending session with results recording');
      
      // Set ending flag immediately
      isEndingSessionRef.current = true;
      
      // Stop voice service immediately
      logger.log('🔇 [ROLEPLAY] Stopping voice service immediately...');
      voiceService.stopConversation();
      voiceService.stopSpeaking();
      voiceService.stopListening();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Complete session through engine to get final results
      let sessionResults = null;
      
      try {
        sessionResults = await roleplayEngine.completeSession();
        
        if (sessionResults && sessionResults.success) {
          await handleSessionCompletion(sessionResults);
          return sessionResults;
        }
      } catch (engineError) {
        logger.warn('Engine completion failed:', engineError);
      }

      // Fallback: create basic results and record them
      const fallbackResults = {
        sessionId: sessionRef.current.id,
        passed: false,
        averageScore: evaluations.length > 0 
          ? evaluations.reduce((sum, e) => sum + (e.evaluation?.score || 0), 0) / evaluations.length
          : 0,
        passedCalls: passCount,
        totalCalls: callCount,
        completed: true,
        duration: Math.floor((Date.now() - new Date(sessionRef.current.startedAt).getTime()) / 1000),
        evaluations: evaluations
      };

      // Record fallback results
      const progressResult = await progressTracker.recordSessionCompletion(
        sessionRef.current.userId,
        sessionRef.current.roleplayType,
        sessionRef.current.mode,
        fallbackResults
      );

      // Refresh progress data
      if (loadProgressData) {
        await loadProgressData();
      }

      setSessionResults({
        ...fallbackResults,
        unlocks: progressResult.unlocks || [],
        finalMessage: 'Session ended',
        progressMessage: progressResult.message
      });

      updateCallState('ended');
      
      logger.log('✅ [ROLEPLAY] Session ended with results recorded');
      return fallbackResults;
      
    } catch (error) {
      logger.error('❌ [ROLEPLAY] Error ending session with results:', error);
      
      // Minimal fallback
      setSessionResults({
        sessionId: sessionRef.current?.id,
        roleplayType: sessionRef.current?.roleplayType,
        mode: sessionRef.current?.mode,
        passed: false,
        metrics: { averageScore: 0 },
        unlocks: [],
        finalMessage: 'Session ended',
        progressMessage: 'Session completed'
      });

      updateCallState('ended');
      return null;
    }
  }, [evaluations, callCount, passCount, handleSessionCompletion, loadProgressData, updateCallState]);

  // End session manually (original method for hangup button)
  const endSession = useCallback(async (reason = 'completed') => {
    if (!sessionRef.current || isEndingSessionRef.current) {
      logger.log('⚠️ [ROLEPLAY] Session already ending or no session');
      return null;
    }

    try {
      logger.log('🏁 [ROLEPLAY] Manual session end:', reason);
      
      // For manual ends (like hangup), we should still try to record progress
      return await endSessionWithResults({ 
        sessionPassed: false, 
        metrics: { averageScore: 0 },
        response: 'Session ended manually'
      });
      
    } catch (error) {
      logger.error('❌ [ROLEPLAY] Error in manual session end:', error);
      return null;
    }
  }, [endSessionWithResults]);

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
    setEvaluations([]);
    
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
      conversationLength: conversationHistory.length,
      evaluationsCount: evaluations.length
    };
  }, [callCount, passCount, currentStage, conversationHistory.length, evaluations.length]);

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
    evaluations,
    
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