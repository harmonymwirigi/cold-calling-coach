// src/contexts/RoleplayContext.jsx - UPDATED WITH SCORE RECORDING & PROGRESSION
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useProgress } from './ProgressContext';
import { voiceService } from '../services/voiceService';
import { comprehensiveRoleplayEngine } from '../services/comprehensiveRoleplayEngine';
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
  const { updateProgress, canAccessRoleplay, loadProgressData } = useProgress();
  
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
  const [currentScore, setCurrentScore] = useState(0);
  const [evaluations, setEvaluations] = useState([]);
  
  // Use refs for state that needs to be current in callbacks
  const sessionRef = useRef(null);
  const isEndingSessionRef = useRef(false);
  const callStateRef = useRef('idle');
  const isProcessingRef = useRef(false);

  // Update refs whenever state changes
  const updateCallState = useCallback((newState) => {
    logger.log('🔄 [ROLEPLAY-CTX] Updating call state:', newState);
    callStateRef.current = newState;
    setCallState(newState);
  }, []);

  const updateIsProcessing = useCallback((newValue) => {
    logger.log('🔄 [ROLEPLAY-CTX] Updating isProcessing:', newValue);
    isProcessingRef.current = newValue;
    setIsProcessing(newValue);
  }, []);

  // Start roleplay session with comprehensive engine
  const startRoleplaySession = useCallback(async (roleplayType, mode, metadata = {}) => {
    try {
      logger.log('🎬 [ROLEPLAY-CTX] Starting session:', { roleplayType, mode });
      
      // Reset flags
      isEndingSessionRef.current = false;
      updateCallState('idle');
      updateIsProcessing(false);
      
      // Check access permissions
      const accessCheck = await canAccessRoleplay(roleplayType, mode);
      if (!accessCheck.allowed) {
        throw new Error(accessCheck.reason);
      }

      // Initialize voice service
      logger.log('🔄 [ROLEPLAY-CTX] Initializing voice service...');
      await voiceService.initialize();
      
      // Initialize comprehensive roleplay engine
      const engineResult = await comprehensiveRoleplayEngine.initializeSession(
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
      setCurrentScore(0);
      setEvaluations([]);
      updateCallState('dialing');
      
      logger.log('✅ [ROLEPLAY-CTX] Session initialized successfully');
      
      // Start the conversation flow
      setTimeout(async () => {
        if (isEndingSessionRef.current) {
          logger.log('⚠️ [ROLEPLAY-CTX] Session ended during startup');
          return;
        }
        
        logger.log('🔄 [ROLEPLAY-CTX] Setting call state to connected');
        updateCallState('connected');
        
        // Get AI's opening response from comprehensive engine
        const openingResponse = await comprehensiveRoleplayEngine.processUserInput('', {
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
            stage: 'greeting'
          };
          
          setConversationHistory([greetingEntry]);
          
          // Start voice conversation
          setTimeout(() => {
            logger.log('🎤 [ROLEPLAY-CTX] Starting voice conversation');
            const success = voiceService.startConversation(
              handleUserSpeech,
              handleVoiceError
            );
            logger.log('🎤 [ROLEPLAY-CTX] Voice conversation started:', success);
          }, 100);
          
          // Speak the greeting
          try {
            logger.log('🗣️ [ROLEPLAY-CTX] Speaking greeting:', openingResponse.response);
            await voiceService.speakText(openingResponse.response);
            logger.log('✅ [ROLEPLAY-CTX] Greeting spoken successfully');
          } catch (speakError) {
            logger.error('❌ [ROLEPLAY-CTX] Failed to speak greeting:', speakError);
          }
        }
        
      }, 2000);
      
      return session;
      
    } catch (error) {
      logger.error('❌ [ROLEPLAY-CTX] Error starting session:', error);
      throw error;
    }
  }, [userProfile, canAccessRoleplay, updateCallState, updateIsProcessing]);

  // Handle user speech with comprehensive engine integration
  const handleUserSpeech = useCallback(async (transcript, confidence) => {
    logger.log('🗣️ [ROLEPLAY-CTX] ====== handleUserSpeech CALLED ======');
    logger.log('🗣️ [ROLEPLAY-CTX] Transcript:', transcript);
    logger.log('🗣️ [ROLEPLAY-CTX] Current state:', {
      hasSession: !!sessionRef.current,
      callState: callStateRef.current,
      isEnding: isEndingSessionRef.current,
      isProcessing: isProcessingRef.current
    });

    // Use refs for current state
    if (!sessionRef.current) {
      logger.log('⚠️ [ROLEPLAY-CTX] No session, ignoring speech');
      return;
    }

    if (callStateRef.current !== 'connected') {
      logger.log('⚠️ [ROLEPLAY-CTX] Call not connected, ignoring speech');
      return;
    }

    if (isEndingSessionRef.current) {
      logger.log('⚠️ [ROLEPLAY-CTX] Session ending, ignoring speech');
      return;
    }

    if (isProcessingRef.current) {
      logger.log('⚠️ [ROLEPLAY-CTX] Already processing, ignoring speech');
      return;
    }

    try {
      logger.log('🔄 [ROLEPLAY-CTX] Setting isProcessing to TRUE');
      updateIsProcessing(true);

      // Add user input to conversation history
      const userEntry = {
        speaker: 'user',
        message: transcript,
        timestamp: Date.now(),
        confidence,
        stage: currentStage
      };
      
      setConversationHistory(prev => {
        const updated = [...prev, userEntry];
        logger.log('📝 [ROLEPLAY-CTX] Updated conversation history. Length:', updated.length);
        return updated;
      });

      logger.log('🤖 [ROLEPLAY-CTX] Processing user input with comprehensive engine...');
      
      // Process input through comprehensive roleplay engine
      const engineResult = await comprehensiveRoleplayEngine.processUserInput(transcript, {
        roleplayType: sessionRef.current.roleplayType,
        mode: sessionRef.current.mode,
        stage: currentStage,
        userProfile: sessionRef.current.userProfile,
        conversationHistory: conversationHistory
      });

      logger.log('🤖 [ROLEPLAY-CTX] Engine result received:', {
        success: engineResult.success,
        hasResponse: !!engineResult.response,
        shouldHangUp: engineResult.shouldHangUp,
        callPassed: engineResult.callPassed,
        sessionComplete: engineResult.sessionComplete,
        evaluation: engineResult.evaluation
      });

      // Check if session ended during processing
      if (isEndingSessionRef.current) {
        logger.log('⚠️ [ROLEPLAY-CTX] Session ended during processing, aborting');
        return;
      }

      if (engineResult.success) {
        // Update evaluations if provided
        if (engineResult.evaluation) {
          setEvaluations(prev => [...prev, {
            ...engineResult.evaluation,
            stage: currentStage,
            timestamp: Date.now(),
            userInput: transcript
          }]);
          
          // Update current score
          if (engineResult.evaluation.score) {
            setCurrentScore(engineResult.evaluation.score);
          }
        }

        // Handle session completion
        if (engineResult.sessionComplete) {
          logger.log('🏁 [ROLEPLAY-CTX] Session completed by engine');
          await handleSessionCompletion(engineResult);
          return;
        }

        // Handle call completion (for marathon/legend modes)
        if (engineResult.callResult) {
          logger.log('📞 [ROLEPLAY-CTX] Call completed:', engineResult.callResult);
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
            timestamp: Date.now(),
            stage: engineResult.stage || currentStage,
            evaluation: engineResult.evaluation
          };
          
          setConversationHistory(prev => {
            const updated = [...prev, aiEntry];
            logger.log('📝 [ROLEPLAY-CTX] Added AI response to history. Total length:', updated.length);
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
            logger.log('🗣️ [ROLEPLAY-CTX] Speaking AI response...');
            await voiceService.speakText(engineResult.response);
            logger.log('✅ [ROLEPLAY-CTX] AI response spoken successfully');
          } catch (speakError) {
            logger.error('❌ [ROLEPLAY-CTX] Failed to speak AI response:', speakError);
          }
        }

        // Handle hangup if required
        if (engineResult.shouldHangUp) {
          logger.log('🔚 [ROLEPLAY-CTX] Engine requests hangup');
          
          if (engineResult.nextCall) {
            // Start next call in marathon/legend mode
            setTimeout(() => {
              startNextCall();
            }, 2000);
          } else {
            // End session and record results
            setTimeout(async () => {
              await endSessionWithResults(engineResult);
            }, 2000);
          }
          return;
        }

      } else {
        logger.error('❌ [ROLEPLAY-CTX] Engine processing failed:', engineResult.error);
        
        // Emergency fallback
        if (!isEndingSessionRef.current) {
          const fallbackResponse = "Sorry, I had trouble understanding. Could you try again?";
          setCurrentMessage(fallbackResponse);
          
          try {
            await voiceService.speakText(fallbackResponse);
          } catch (speakError) {
            logger.error('❌ [ROLEPLAY-CTX] Failed to speak fallback:', speakError);
          }
        }
      }

    } catch (error) {
      logger.error('❌ [ROLEPLAY-CTX] Error processing user speech:', error);
      
      // Emergency recovery
      if (!isEndingSessionRef.current) {
        try {
          const errorResponse = "Sorry, something went wrong. Could you try again?";
          setCurrentMessage(errorResponse);
          await voiceService.speakText(errorResponse);
        } catch (recoveryError) {
          logger.error('❌ [ROLEPLAY-CTX] Recovery failed:', recoveryError);
        }
      }
    } finally {
      logger.log('🔄 [ROLEPLAY-CTX] Setting isProcessing to FALSE');
      updateIsProcessing(false);
      logger.log('🗣️ [ROLEPLAY-CTX] ====== handleUserSpeech COMPLETED ======');
    }
  }, [updateIsProcessing, currentStage, conversationHistory]);

  // Start next call in marathon/legend mode
  const startNextCall = useCallback(() => {
    logger.log('📞 [ROLEPLAY-CTX] Starting next call...');
    
    // Reset for next call
    setCurrentStage('greeting');
    setCurrentMessage('');
    setCurrentScore(0);
    
    // Don't clear evaluations - keep for session summary
    
    // Start with greeting
    setTimeout(async () => {
      const greetingResponse = await comprehensiveRoleplayEngine.processUserInput('', {
        isGreeting: true
      });

      if (greetingResponse.success && greetingResponse.response) {
        setCurrentMessage(greetingResponse.response);
        setCurrentStage(greetingResponse.stage || 'opener');
        
        const greetingEntry = {
          speaker: 'ai',
          message: greetingResponse.response,
          timestamp: Date.now(),
          stage: 'greeting',
          callNumber: callCount + 1
        };
        
        setConversationHistory(prev => [...prev, greetingEntry]);
        
        try {
          await voiceService.speakText(greetingResponse.response);
        } catch (error) {
          logger.error('Failed to speak greeting for next call:', error);
        }
      }
    }, 500);
  }, [callCount]);

  // Handle session completion with proper score recording
  const handleSessionCompletion = useCallback(async (engineResult) => {
    try {
      logger.log('🏁 [ROLEPLAY-CTX] Handling session completion:', engineResult);

      // Complete session through comprehensive engine
      const completionResult = await comprehensiveRoleplayEngine.completeSession(
        engineResult.sessionPassed,
        engineResult.metrics
      );

      if (completionResult.success) {
        // Update progress through progress context
        const progressResult = await updateProgress(sessionRef.current.roleplayType, {
          mode: sessionRef.current.mode,
          passed: engineResult.sessionPassed,
          averageScore: engineResult.metrics?.averageScore || currentScore,
          metrics: engineResult.metrics,
          evaluations: evaluations
        });

        // Reload progress data to reflect changes
        await loadProgressData();

        // Set session results with unlock information
        setSessionResults({
          sessionId: sessionRef.current?.id,
          roleplayType: sessionRef.current?.roleplayType,
          mode: sessionRef.current?.mode,
          passed: engineResult.sessionPassed,
          metrics: engineResult.metrics,
          unlocks: progressResult.unlocks || [],
          coaching: completionResult.coaching || [],
          finalMessage: engineResult.response,
          evaluations: evaluations,
          conversationHistory: conversationHistory
        });

        logger.log('✅ [ROLEPLAY-CTX] Session results set with unlocks:', progressResult.unlocks);
      }

      updateCallState('ended');

    } catch (error) {
      logger.error('❌ [ROLEPLAY-CTX] Error handling session completion:', error);
      
      // Fallback session results
      setSessionResults({
        sessionId: sessionRef.current?.id,
        roleplayType: sessionRef.current?.roleplayType,
        mode: sessionRef.current?.mode,
        passed: false,
        metrics: { totalCalls: callCount, passedCalls: passCount },
        unlocks: [],
        coaching: ['Keep practicing to improve your skills!'],
        finalMessage: 'Session completed.',
        evaluations: evaluations
      });
      
      updateCallState('ended');
    }
  }, [updateProgress, loadProgressData, currentScore, evaluations, conversationHistory, callCount, passCount]);

  // End session with results recording
  const endSessionWithResults = useCallback(async (engineResult) => {
    if (!sessionRef.current || isEndingSessionRef.current) {
      logger.log('⚠️ [ROLEPLAY-CTX] Session already ending or no session');
      return null;
    }

    try {
      logger.log('🏁 [ROLEPLAY-CTX] Ending session with results:', engineResult);
      
      // Set ending flag immediately
      isEndingSessionRef.current = true;
      
      // Stop voice service
      voiceService.stopConversation();
      voiceService.stopSpeaking();
      voiceService.stopListening();
      
      // Handle completion through comprehensive engine
      await handleSessionCompletion(engineResult);
      
      logger.log('✅ [ROLEPLAY-CTX] Session ended with proper results recording');
      
    } catch (error) {
      logger.error('❌ [ROLEPLAY-CTX] Error ending session with results:', error);
    }
  }, [handleSessionCompletion]);

  // Handle voice errors
  const handleVoiceError = useCallback((error) => {
    logger.error('🎤 [ROLEPLAY-CTX] Voice error:', error);
  }, []);

  // End session manually
  const endSession = useCallback(async (reason = 'completed') => {
    if (!sessionRef.current || isEndingSessionRef.current) {
      logger.log('⚠️ [ROLEPLAY-CTX] Session already ending or no session');
      return null;
    }

    try {
      logger.log('🏁 [ROLEPLAY-CTX] Ending session manually:', reason);
      
      // Set ending flag immediately
      isEndingSessionRef.current = true;
      
      // Stop voice service
      voiceService.stopConversation();
      voiceService.stopSpeaking();
      voiceService.stopListening();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Complete session through comprehensive engine
      const sessionPassed = reason === 'completed' && passCount > 0;
      const metrics = {
        totalCalls: callCount || 1,
        passedCalls: passCount,
        passRate: callCount > 0 ? Math.round((passCount / callCount) * 100) : 0,
        averageScore: currentScore || 2,
        evaluations: evaluations
      };

      const completionResult = await comprehensiveRoleplayEngine.completeSession(
        sessionPassed,
        metrics
      );

      // Update progress if session was completed successfully
      if (completionResult.success && sessionPassed) {
        const progressResult = await updateProgress(sessionRef.current.roleplayType, {
          mode: sessionRef.current.mode,
          passed: sessionPassed,
          averageScore: metrics.averageScore,
          metrics: metrics
        });

        // Reload progress to reflect changes
        await loadProgressData();
        
        completionResult.unlocks = progressResult.unlocks || [];
      }

      updateCallState('ended');
      setSessionResults(completionResult);
      
      logger.log('✅ [ROLEPLAY-CTX] Session ended manually with results');
      return completionResult;
      
    } catch (error) {
      logger.error('❌ [ROLEPLAY-CTX] Error ending session:', error);
      return null;
    }
  }, [callCount, passCount, currentScore, evaluations, updateProgress, loadProgressData, updateCallState]);

  // Reset session
  const resetSession = useCallback(() => {
    logger.log('🔄 [ROLEPLAY-CTX] Resetting session');
    
    isEndingSessionRef.current = true;
    
    // Stop voice service
    voiceService.stopConversation();
    voiceService.stopSpeaking();
    voiceService.stopListening();
    voiceService.cleanup();
    
    // Clean up comprehensive engine
    comprehensiveRoleplayEngine.cleanup();
    
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
    setCurrentScore(0);
    setEvaluations([]);
    
    sessionRef.current = null;
    isEndingSessionRef.current = false;
    
    logger.log('✅ [ROLEPLAY-CTX] Session reset complete');
  }, [updateCallState, updateIsProcessing]);

  // Get session stats
  const getSessionStats = useCallback(() => {
    if (!sessionRef.current) return null;
    
    return {
      callCount,
      passCount,
      currentStage,
      currentScore,
      conversationLength: conversationHistory.length,
      evaluations: evaluations.length,
      roleplayType: sessionRef.current.roleplayType,
      mode: sessionRef.current.mode
    };
  }, [callCount, passCount, currentStage, currentScore, conversationHistory.length, evaluations.length]);

  // Manual user response for testing
  const handleUserResponse = useCallback(async (userInput) => {
    logger.log('📝 [ROLEPLAY-CTX] Manual user response:', userInput);
    return await handleUserSpeech(userInput, 1.0);
  }, [handleUserSpeech]);

  // Get current evaluation
  const getCurrentEvaluation = useCallback(() => {
    return evaluations.length > 0 ? evaluations[evaluations.length - 1] : null;
  }, [evaluations]);

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
    currentScore,
    evaluations,
    
    // Actions
    startRoleplaySession,
    handleUserResponse,
    endSession,
    resetSession,
    getSessionStats,
    getCurrentEvaluation,
    
    // Voice service state
    voiceService
  };
  
  return (
    <RoleplayContext.Provider value={value}>
      {children}
    </RoleplayContext.Provider>
  );
};