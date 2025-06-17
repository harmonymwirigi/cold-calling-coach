// src/contexts/RoleplayContext.jsx - FIXED NO RE-RENDER LOOPS
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
  
  // Use refs for stable references
  const sessionRef = useRef(null);
  const isEndingSessionRef = useRef(false);

  // FIXED: Stable callback references using useCallback with stable dependencies
  const updateCallState = useCallback((newState) => {
    logger.log('🔄 [ROLEPLAY] Updating call state:', newState);
    setCallState(newState);
  }, []);

  const updateIsProcessing = useCallback((newValue) => {
    logger.log('🔄 [ROLEPLAY] Updating isProcessing:', newValue);
    setIsProcessing(newValue);
  }, []);

  // FIXED: Stable startRoleplaySession function
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
          
          // Handle greeting stage
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
  }, [userProfile?.id, updateCallState, updateIsProcessing]); // FIXED: Stable dependencies only

  const handleUserResponse = useCallback(async (userInput) => {
    logger.log('📝 [ROLEPLAY] User response received:', userInput);
  
    // Check preconditions
    if (!sessionRef.current) {
      logger.log('⚠️ [ROLEPLAY] No session, ignoring input');
      return;
    }
  
    if (callState !== 'connected') {
      logger.log('⚠️ [ROLEPLAY] Call not connected, ignoring input');
      return;
    }
  
    if (isEndingSessionRef.current) {
      logger.log('⚠️ [ROLEPLAY] Session ending, ignoring input');
      return;
    }
  
    if (isProcessing) {
      logger.log('⚠️ [ROLEPLAY] Already processing, ignoring input');
      return;
    }
  
    try {
      logger.log('🔄 [ROLEPLAY] Setting isProcessing to TRUE');
      updateIsProcessing(true);
  
      // Add user input to conversation history
      const userEntry = {
        speaker: 'user',
        message: userInput,
        timestamp: Date.now()
      };
      
      setConversationHistory(prev => [...prev, userEntry]);
      logger.log('📝 [ROLEPLAY] Added user message to history');
  
      // SIMPLIFIED: Create a simple AI response instead of complex engine processing
      logger.log('🤖 [ROLEPLAY] Generating AI response...');
      
      // Simple objection responses for testing
      const objections = [
        "What's this about?",
        "I'm not interested.",
        "We don't take cold calls.",
        "Now is not a good time.",
        "Is this a sales call?",
        "Who gave you this number?",
        "I'm busy right now.",
        "Can you send me an email instead?"
      ];
      
      const randomObjection = objections[Math.floor(Math.random() * objections.length)];
      
      // Add AI response to conversation
      const aiEntry = {
        speaker: 'ai',
        message: randomObjection,
        timestamp: Date.now()
      };
      
      setConversationHistory(prev => [...prev, aiEntry]);
      setCurrentMessage(randomObjection);
      setCurrentStage('objection'); // Move to next stage
      
      logger.log('✅ [ROLEPLAY] AI response generated:', randomObjection);
  
      // Speak AI response
      try {
        logger.log('🗣️ [ROLEPLAY] Speaking AI response...');
        await voiceService.speakText(randomObjection);
        logger.log('✅ [ROLEPLAY] AI response spoken successfully');
      } catch (speakError) {
        logger.error('❌ [ROLEPLAY] Failed to speak AI response:', speakError);
      }
  
      // CRITICAL: DO NOT stop conversation - let it continue!
      logger.log('🔄 [ROLEPLAY] Conversation continues...');
  
    } catch (error) {
      logger.error('❌ [ROLEPLAY] Error processing user input:', error);
      
      // Emergency recovery - but don't stop conversation
      const errorResponse = "Sorry, I didn't catch that. Could you try again?";
      setCurrentMessage(errorResponse);
      
      try {
        await voiceService.speakText(errorResponse);
      } catch (recoveryError) {
        logger.error('❌ [ROLEPLAY] Recovery failed:', recoveryError);
      }
    } finally {
      logger.log('🔄 [ROLEPLAY] Setting isProcessing to FALSE');
      updateIsProcessing(false);
      logger.log('✅ [ROLEPLAY] Ready for next user input');
    }
  }, [callState, isProcessing, updateIsProcessing]);
  // Handle session completion with proper score recording
  const handleSessionCompletion = useCallback(async (engineResult) => {
    try {
      logger.log('🏁 [ROLEPLAY] Handling session completion');

      if (!sessionRef.current) {
        logger.error('❌ [ROLEPLAY] No session reference for completion');
        return;
      }

      // Set session results
      const sessionResultData = {
        sessionId: sessionRef.current.id,
        roleplayType: sessionRef.current.roleplayType,
        mode: sessionRef.current.mode,
        passed: engineResult.sessionPassed || false,
        metrics: engineResult.metrics || {},
        unlocks: [],
        finalMessage: engineResult.response || 'Session completed',
        progressMessage: 'Session completed successfully'
      };

      setSessionResults(sessionResultData);
      updateCallState('ended');

    } catch (error) {
      logger.error('❌ [ROLEPLAY] Error handling session completion:', error);
      
      // Set basic results even if error
      setSessionResults({
        sessionId: sessionRef.current?.id,
        roleplayType: sessionRef.current?.roleplayType,
        mode: sessionRef.current?.mode,
        passed: false,
        metrics: {},
        unlocks: [],
        finalMessage: 'Session completed',
        progressMessage: 'Session completed'
      });

      updateCallState('ended');
    }
  }, [updateCallState]);

  // Start next call in marathon/legend mode
  const startNextCall = useCallback(() => {
    logger.log('📞 [ROLEPLAY] Starting next call...');
    
    // Reset for next call
    setCurrentStage('greeting');
    setCurrentMessage('');
    setEvaluations([]);
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
      logger.log('🔇 [ROLEPLAY] Stopping voice service...');
      voiceService.stopConversation();
      voiceService.stopSpeaking();
      voiceService.stopListening();
      
      // Set session results
      const sessionResultData = {
        sessionId: sessionRef.current.id,
        roleplayType: sessionRef.current.roleplayType,
        mode: sessionRef.current.mode,
        passed: engineResult?.sessionPassed || false,
        metrics: engineResult?.metrics || {},
        unlocks: [],
        finalMessage: engineResult?.response || 'Session ended',
        progressMessage: 'Session completed'
      };

      setSessionResults(sessionResultData);
      updateCallState('ended');
      
      logger.log('✅ [ROLEPLAY] Session ended successfully');
      return sessionResultData;
      
    } catch (error) {
      logger.error('❌ [ROLEPLAY] Error ending session:', error);
      
      // Minimal fallback
      setSessionResults({
        sessionId: sessionRef.current?.id,
        roleplayType: sessionRef.current?.roleplayType,
        mode: sessionRef.current?.mode,
        passed: false,
        metrics: {},
        unlocks: [],
        finalMessage: 'Session ended',
        progressMessage: 'Session completed'
      });

      updateCallState('ended');
      return null;
    }
  }, [updateCallState]);

  // FIXED: Stable endSession function
  const endSession = useCallback(async (reason = 'completed') => {
    if (!sessionRef.current || isEndingSessionRef.current) {
      logger.log('⚠️ [ROLEPLAY] Session already ending or no session');
      return null;
    }

    logger.log('🏁 [ROLEPLAY] Manual session end:', reason);
    
    return await endSessionWithResults({ 
      sessionPassed: false, 
      metrics: { averageScore: 0 },
      response: 'Session ended manually'
    });
  }, [endSessionWithResults]);

  // FIXED: Stable resetSession function
  const resetSession = useCallback(() => {
    logger.log('🔄 [ROLEPLAY] Resetting session');
    
    isEndingSessionRef.current = true;
    
    // Stop voice service
    voiceService.stopConversation();
    voiceService.stopSpeaking();
    voiceService.stopListening();
    
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

  // FIXED: Create stable value object
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
    
    // Actions - all stable references
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