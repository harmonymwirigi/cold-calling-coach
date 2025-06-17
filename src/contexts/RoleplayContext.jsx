// src/contexts/RoleplayContext.jsx - SIMPLE OPENAI FIX (NO BREAKING CHANGES)
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useProgress } from './ProgressContext';
import { voiceService } from '../services/voiceService';
import { openAIService } from '../services/openaiService';
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

  // SIMPLE: Update refs whenever state changes (stable functions)
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

  // SIMPLE: Generate character for OpenAI (stable function)
  const generateCharacter = useCallback((profile) => {
    const jobTitle = profile?.prospect_job_title || 'Marketing Manager';
    const industry = profile?.prospect_industry || 'Technology';
    
    const names = ['Sarah', 'Michael', 'Jessica', 'David', 'Amanda', 'James', 'Lisa', 'Robert'];
    const name = names[Math.floor(Math.random() * names.length)];
    
    const companyNames = {
      'Technology': ['TechCorp', 'InnovateIT', 'DataSolutions', 'CloudFirst'],
      'Healthcare': ['MedSystems', 'HealthTech', 'CareFirst', 'MedInnovate'],
      'Finance': ['FinanceCore', 'BankTech', 'InvestSmart', 'CapitalGroup'],
      'Education': ['EduTech', 'LearningSystems', 'SchoolTech', 'EduInnovate'],
      'Retail': ['RetailCorp', 'ShopSmart', 'Commerce Plus', 'RetailTech']
    };
    
    const companyPool = companyNames[industry] || companyNames.Technology;
    const company = companyPool[Math.floor(Math.random() * companyPool.length)];
    
    const personalities = [
      'busy, professional, skeptical',
      'curious, analytical, cautious',
      'friendly but time-conscious',
      'direct, no-nonsense, results-oriented',
      'polite but guarded'
    ];
    
    const personality = personalities[Math.floor(Math.random() * personalities.length)];

    return {
      name,
      title: jobTitle,
      company,
      industry,
      personality,
      customNotes: profile?.custom_behavior_notes || ''
    };
  }, []);

  // SIMPLE: Start roleplay session (minimal changes)
  const startRoleplaySession = useCallback(async (roleplayType, mode, metadata = {}) => {
    try {
      logger.log('🎬 [ROLEPLAY] Starting session with OpenAI:', { roleplayType, mode });
      
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
      await openAIService.initialize(); // ENSURE OPENAI IS READY

      // Create simple session object
      const character = generateCharacter(userProfile);
      const sessionId = `${userProfile?.id}_${roleplayType}_${mode}_${Date.now()}`;
      
      const session = {
        id: sessionId,
        userId: userProfile?.id,
        roleplayType,
        mode,
        userProfile,
        character,
        startTime: new Date().toISOString(),
        totalCalls: 0,
        passedCalls: 0,
        currentCallIndex: 0,
        stage: 'greeting',
        conversationHistory: [],
        callResults: [],
        isActive: true
      };

      // Set OpenAI context - THIS ENSURES OPENAI IS USED
      openAIService.setSessionContext(roleplayType, mode, userProfile, character);
      
      // Set session state
      sessionRef.current = session;
      setCurrentSession(session);
      setConversationHistory([]);
      setSessionResults(null);
      setCurrentStage('greeting');
      setCallCount(0);
      setPassCount(0);
      updateCallState('dialing');
      
      logger.log('✅ [ROLEPLAY] Session initialized with OpenAI context set');
      
      // Start the conversation flow
      setTimeout(async () => {
        if (isEndingSessionRef.current) {
          logger.log('⚠️ [ROLEPLAY] Session ended during startup');
          return;
        }
        
        logger.log('🔄 [ROLEPLAY] Setting call state to connected');
        updateCallState('connected');
        
        // Get AI's opening message from OpenAI - FORCE OPENAI USAGE
        logger.log('🤖 [ROLEPLAY] Getting greeting from OpenAI...');
        const openingResponse = await openAIService.getProspectResponse('greeting', '', {
          roleplayType,
          mode,
          character,
          userProfile
        });

        if (openingResponse.success && openingResponse.response) {
          setCurrentMessage(openingResponse.response);
          setCurrentStage('opener');
          
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
            logger.log('🎤 [ROLEPLAY] Starting voice conversation');
            const success = voiceService.startConversation(
              handleUserSpeech,
              handleVoiceError
            );
            logger.log('🎤 [ROLEPLAY] Voice conversation started:', success);
          }, 100);
          
          // Speak the greeting
          try {
            logger.log('🗣️ [ROLEPLAY] Speaking OpenAI greeting:', openingResponse.response);
            await voiceService.speakText(openingResponse.response);
            logger.log('✅ [ROLEPLAY] OpenAI greeting spoken successfully');
          } catch (speakError) {
            logger.error('❌ [ROLEPLAY] Failed to speak OpenAI greeting:', speakError);
          }
        } else {
          logger.error('❌ [ROLEPLAY] Failed to get OpenAI greeting');
          throw new Error('OpenAI greeting failed');
        }
        
      }, 2000);
      
      return session;
      
    } catch (error) {
      logger.error('❌ [ROLEPLAY] Error starting session:', error);
      throw error;
    }
  }, [userProfile, canAccessRoleplay, updateCallState, updateIsProcessing, generateCharacter]);

  // SIMPLE: Handle user speech with direct OpenAI calls
  const handleUserSpeech = useCallback(async (transcript, confidence) => {
    logger.log('🗣️ [ROLEPLAY] ====== handleUserSpeech WITH OPENAI ======');
    logger.log('🗣️ [ROLEPLAY] Transcript:', transcript);

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

      // DIRECT OPENAI CALL - THIS IS THE KEY FIX
      logger.log('🤖 [ROLEPLAY] Making DIRECT OpenAI call...');
      
      const aiResult = await openAIService.getProspectResponse(
        currentStage,
        transcript,
        {
          roleplayType: sessionRef.current.roleplayType,
          mode: sessionRef.current.mode,
          character: sessionRef.current.character,
          userProfile: sessionRef.current.userProfile,
          conversationHistory: conversationHistory
        }
      );

      logger.log('🤖 [ROLEPLAY] DIRECT OpenAI result:', {
        success: aiResult.success,
        hasResponse: !!aiResult.response,
        responseLength: aiResult.response?.length,
        source: 'direct_openai'
      });

      // Check if session ended during processing
      if (isEndingSessionRef.current) {
        logger.log('⚠️ [ROLEPLAY] Session ended during OpenAI processing, aborting');
        return;
      }

      if (aiResult.success && aiResult.response) {
        // Add AI response to conversation
        const aiEntry = {
          speaker: 'ai',
          message: aiResult.response,
          timestamp: Date.now(),
          source: 'direct_openai'
        };
        
        setConversationHistory(prev => {
          const updated = [...prev, aiEntry];
          logger.log('📝 [ROLEPLAY] Added DIRECT OpenAI response. Total length:', updated.length);
          return updated;
        });

        setCurrentMessage(aiResult.response);

        // Simple stage progression based on conversation length
        const conversationLength = conversationHistory.length + 2; // +2 for user+ai entries we just added
        
        if (conversationLength >= 10) {
          // End call after reasonable conversation
          setTimeout(() => {
            endCall('conversation_complete', true);
          }, 1000);
        } else {
          // Continue conversation
          setCurrentStage(getNextStage(currentStage, conversationLength));
        }

        // Speak AI response
        try {
          logger.log('🗣️ [ROLEPLAY] Speaking DIRECT OpenAI response...');
          await voiceService.speakText(aiResult.response);
          logger.log('✅ [ROLEPLAY] DIRECT OpenAI response spoken successfully');
        } catch (speakError) {
          logger.error('❌ [ROLEPLAY] Failed to speak OpenAI response:', speakError);
        }

      } else {
        logger.error('❌ [ROLEPLAY] DIRECT OpenAI call failed:', aiResult.error);
        
        // Fallback - but still log that OpenAI failed
        const fallbackResponse = "Could you repeat that? I didn't catch it clearly.";
        setCurrentMessage(fallbackResponse);
        
        const fallbackEntry = {
          speaker: 'ai',
          message: fallbackResponse,
          timestamp: Date.now(),
          source: 'fallback_after_openai_failure'
        };
        
        setConversationHistory(prev => [...prev, fallbackEntry]);
        
        try {
          await voiceService.speakText(fallbackResponse);
        } catch (speakError) {
          logger.error('❌ [ROLEPLAY] Failed to speak fallback:', speakError);
        }
      }

    } catch (error) {
      logger.error('❌ [ROLEPLAY] Error in DIRECT OpenAI processing:', error);
      
      // Emergency recovery
      if (!isEndingSessionRef.current) {
        try {
          const errorResponse = "Sorry, I had a technical issue. Could you try again?";
          setCurrentMessage(errorResponse);
          
          const errorEntry = {
            speaker: 'ai',
            message: errorResponse,
            timestamp: Date.now(),
            source: 'error_recovery'
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
      logger.log('🗣️ [ROLEPLAY] ====== handleUserSpeech COMPLETED ======');
    }
  }, [conversationHistory, currentStage, updateIsProcessing]);

  // SIMPLE: Get next stage based on conversation flow
  const getNextStage = useCallback((currentStage, conversationLength) => {
    // Simple progression
    if (conversationLength <= 2) return 'opener';
    if (conversationLength <= 4) return 'objection';
    if (conversationLength <= 6) return 'pitch_prompt';
    if (conversationLength <= 8) return 'questions_objections';
    return 'meeting_ask';
  }, []);

  // SIMPLE: End call with basic evaluation
  const endCall = useCallback(async (reason, passed = false) => {
    logger.log('📞 [ROLEPLAY] Ending call:', { reason, passed });

    const session = sessionRef.current;
    if (!session) return null;

    // Simple evaluation
    const callResult = {
      callNumber: session.totalCalls + 1,
      passed,
      scores: {
        empathy: passed ? 3.5 : 2.5,
        objection_handling: passed ? 3.5 : 2.5,
        conversation_flow: conversationHistory.length >= 6 ? 3.5 : 2.5,
        outcome: passed ? 4 : 2,
        average: passed ? 3.6 : 2.6
      },
      reason,
      duration: Date.now() - new Date(session.startTime).getTime(),
      conversationLength: conversationHistory.length
    };

    // Update session counts
    session.totalCalls++;
    session.callResults.push(callResult);
    
    if (callResult.passed) {
      session.passedCalls++;
      setPassCount(prev => prev + 1);
    }
    
    setCallCount(session.totalCalls);

    // Check if should continue (marathon/legend modes)
    const shouldContinue = shouldContinueSession(session);

    if (shouldContinue) {
      // Start next call
      setTimeout(() => {
        startNextCall();
      }, 2000);
    } else {
      // End session
      setTimeout(() => {
        endSession('completed');
      }, 2000);
    }

    return callResult;
  }, [conversationHistory]);

  // SIMPLE: Check if session should continue
  const shouldContinueSession = useCallback((session) => {
    const { mode, totalCalls, passedCalls } = session;

    switch (mode) {
      case 'practice':
        return false; // Practice mode is single call
      
      case 'marathon':
        // Continue until 10 calls or 4 failures
        const failures = totalCalls - passedCalls;
        return totalCalls < 10 && failures < 4;
      
      case 'legend':
        // Continue until 10 calls or any failure
        return totalCalls < 10 && totalCalls === passedCalls;
      
      default:
        return false;
    }
  }, []);

  // SIMPLE: Start next call (for marathon/legend)
  const startNextCall = useCallback(async () => {
    logger.log('📞 [ROLEPLAY] Starting next call with OpenAI...');
    
    // Reset for next call
    setCurrentStage('greeting');
    setCurrentMessage('');
    setConversationHistory([]);
    
    // Get new greeting from OpenAI
    setTimeout(async () => {
      try {
        logger.log('🤖 [ROLEPLAY] Getting OpenAI greeting for next call...');
        
        const greetingResponse = await openAIService.getProspectResponse('greeting', '', {
          roleplayType: sessionRef.current?.roleplayType,
          mode: sessionRef.current?.mode,
          character: sessionRef.current?.character,
          userProfile: sessionRef.current?.userProfile
        });

        if (greetingResponse.success && greetingResponse.response) {
          setCurrentMessage(greetingResponse.response);
          setCurrentStage('opener');
          
          const greetingEntry = {
            speaker: 'ai',
            message: greetingResponse.response,
            timestamp: Date.now(),
            source: 'openai_next_call'
          };
          
          setConversationHistory([greetingEntry]);
          
          logger.log('🗣️ [ROLEPLAY] Speaking OpenAI greeting for next call...');
          await voiceService.speakText(greetingResponse.response);
          logger.log('✅ [ROLEPLAY] OpenAI greeting for next call spoken');
        }
      } catch (error) {
        logger.error('❌ [ROLEPLAY] Error getting OpenAI greeting for next call:', error);
      }
    }, 500);
  }, []);

  // SIMPLE: Handle voice errors
  const handleVoiceError = useCallback((error) => {
    logger.error('🎤 [ROLEPLAY] Voice error:', error);
  }, []);

  // SIMPLE: End session
  const endSession = useCallback(async (reason = 'completed') => {
    if (!sessionRef.current || isEndingSessionRef.current) {
      logger.log('⚠️ [ROLEPLAY] Session already ending or no session');
      return null;
    }

    try {
      logger.log('🏁 [ROLEPLAY] Ending OpenAI session:', reason);
      
      // Set ending flag immediately
      isEndingSessionRef.current = true;
      
      // Stop voice service
      voiceService.stopConversation();
      voiceService.stopSpeaking();
      voiceService.stopListening();
      
      // Calculate session results
      const session = sessionRef.current;
      const passRate = session.totalCalls > 0 ? (session.passedCalls / session.totalCalls) * 100 : 0;
      const averageScore = session.callResults.length > 0 
        ? session.callResults.reduce((sum, result) => sum + result.scores.average, 0) / session.callResults.length
        : 60;
      
      let sessionPassed = false;
      
      switch (session.mode) {
        case 'practice':
          sessionPassed = session.passedCalls > 0;
          break;
        case 'marathon':
          sessionPassed = session.passedCalls >= 6; // 6 out of 10
          break;
        case 'legend':
          sessionPassed = session.totalCalls === 10 && session.passedCalls === 10; // Perfect score
          break;
      }

      const sessionResults = {
        sessionId: session.id,
        roleplayType: session.roleplayType,
        mode: session.mode,
        passed: sessionPassed,
        metrics: {
          totalCalls: session.totalCalls,
          passedCalls: session.passedCalls,
          passRate,
          averageScore,
          duration: Date.now() - new Date(session.startTime).getTime(),
          callResults: session.callResults
        },
        unlocks: [],
        openaiPowered: true
      };

      // Update progress
      try {
        const progressResult = await updateProgress(session.roleplayType, {
          mode: session.mode,
          passed: sessionPassed,
          averageScore,
          metrics: sessionResults.metrics
        });
        sessionResults.unlocks = progressResult.unlocks || [];
      } catch (progressError) {
        logger.error('Progress update failed:', progressError);
      }

      updateCallState('ended');
      setSessionResults(sessionResults);
      
      logger.log('✅ [ROLEPLAY] OpenAI session ended successfully');
      return sessionResults;
      
    } catch (error) {
      logger.error('❌ [ROLEPLAY] Error ending session:', error);
      return null;
    }
  }, [updateProgress, updateCallState]);

  // SIMPLE: Reset session
  const resetSession = useCallback(() => {
    logger.log('🔄 [ROLEPLAY] Resetting session');
    
    isEndingSessionRef.current = true;
    
    // Stop voice service
    voiceService.stopConversation();
    voiceService.stopSpeaking();
    voiceService.stopListening();
    voiceService.cleanup();
    
    // Reset OpenAI conversation
    openAIService.resetConversation();
    
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

  // SIMPLE: Get session stats
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

  // SIMPLE: Manual user response for testing
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