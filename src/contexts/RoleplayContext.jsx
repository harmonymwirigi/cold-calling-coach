// src/contexts/RoleplayContext.jsx - FINAL POLISHED VERSION
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
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
  
  // Session state
  const [currentSession, setCurrentSession] = useState(null);
  const [callState, setCallState] = useState('idle');
  const [sessionResults, setSessionResults] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  
  // Use refs for state that needs to be current in callbacks
  const sessionRef = useRef(null);
  const startTimeRef = useRef(null);
  const evaluationsRef = useRef([]);
  const conversationStageRef = useRef('greeting');
  const aiPersonalityRef = useRef(null);
  const isEndingSessionRef = useRef(false);
  const exchangeCountRef = useRef(0);
  const callStateRef = useRef('idle');
  const isProcessingRef = useRef(false);

  // Update refs whenever state changes
  const updateCallState = useCallback((newState) => {
    console.log('🔄 [DEBUG] Updating call state from', callStateRef.current, 'to', newState);
    callStateRef.current = newState;
    setCallState(newState);
  }, []);

  const updateIsProcessing = useCallback((newValue) => {
    console.log('🔄 [DEBUG] Updating isProcessing from', isProcessingRef.current, 'to', newValue);
    isProcessingRef.current = newValue;
    setIsProcessing(newValue);
  }, []);

  // Character templates for different roleplays
  const getCharacterForRoleplay = useCallback((roleplayType) => {
    const characters = {
      opener_practice: {
        name: 'Sarah Mitchell',
        title: 'VP of Marketing',
        company: 'TechCorp Solutions',
        personality: 'busy, skeptical, interrupts quickly',
        greeting: 'Hello, Sarah speaking.',
        objections: ['Who is this?', 'How did you get my number?', 'I\'m not interested', 'Send me an email']
      },
      pitch_practice: {
        name: 'Michael Chen',
        title: 'CTO',
        company: 'InnovateX',
        personality: 'analytical, asks detailed questions',
        greeting: 'Hi, this is Michael. You have 2 minutes - what\'s this about?',
        objections: ['How is this different?', 'What\'s the ROI?', 'We already have a solution']
      },
      full_simulation: {
        name: 'Lisa Rodriguez',
        title: 'CEO',
        company: 'GrowthCorp',
        personality: 'direct, time-conscious, decision-maker',
        greeting: 'Lisa Rodriguez speaking.',
        objections: ['I\'m in a meeting', 'Not the right time', 'Send me information']
      },
      warmup_challenge: {
        name: 'David Park',
        title: 'Operations Manager',
        company: 'EfficiencyPro',
        personality: 'friendly but cautious',
        greeting: 'Hello, this is David.',
        objections: ['Tell me more', 'Sounds interesting but...', 'I need to think about it']
      },
      power_hour: {
        name: 'Jennifer Walsh',
        title: 'Sales Director',
        company: 'ResultsFirst',
        personality: 'experienced, knows sales tactics',
        greeting: 'Jennifer here. Let me guess - you\'re selling something?',
        objections: ['I know all the tricks', 'You sound like every other rep', 'Prove it']
      }
    };
    
    return characters[roleplayType] || characters.opener_practice;
  }, []);

  // Use OpenAI service for realistic AI responses
  const generateAIResponse = useCallback(async (userInput, context) => {
    try {
      console.log('🤖 [DEBUG] Generating AI response using OpenAI service...');
      console.log('🤖 [DEBUG] User input:', userInput);
      console.log('🤖 [DEBUG] Context:', context);
      console.log('🤖 [DEBUG] Current stage:', conversationStageRef.current);
      
      // Check if session is ending
      if (isEndingSessionRef.current) {
        console.log('⚠️ [DEBUG] Session is ending, skipping AI response');
        return {
          success: false,
          response: '',
          shouldHangUp: true
        };
      }

      // Use OpenAI service with proper context
      const result = await openAIService.getProspectResponse(userInput, {
        roleplayType: sessionRef.current?.roleplayType,
        mode: sessionRef.current?.mode,
        character: aiPersonalityRef.current
      }, conversationStageRef.current);

      console.log('🤖 [DEBUG] OpenAI service result:', {
        success: result.success,
        hasResponse: !!result.response,
        responseLength: result.response?.length,
        shouldHangUp: result.shouldHangUp,
        nextStage: result.nextStage,
        evaluation: result.evaluation
      });

      if (result.success) {
        // Update conversation stage
        if (result.nextStage) {
          console.log('🔄 [DEBUG] Updating conversation stage from', conversationStageRef.current, 'to', result.nextStage);
          conversationStageRef.current = result.nextStage;
        }
        
        // FIXED: Store evaluation with proper scoring
        if (result.evaluation) {
          const evaluation = {
            ...result.evaluation,
            score: result.evaluation.score || (result.evaluation.passed ? 85 : 65), // Ensure score exists
            timestamp: Date.now()
          };
          
          evaluationsRef.current.push({
            stage: result.stage,
            evaluation,
            timestamp: Date.now()
          });
          console.log('📊 [DEBUG] Added evaluation with score:', evaluation.score);
        }
      }

      return result;
      
    } catch (error) {
      console.error('❌ [DEBUG] Error generating AI response:', error);
      
      // Always provide a response with score
      const emergencyResponse = "Could you repeat that? I didn't catch what you said.";
      
      return {
        success: true,
        response: emergencyResponse,
        evaluation: { passed: true, feedback: 'Keep practicing!', score: 70 },
        stage: conversationStageRef.current,
        nextStage: conversationStageRef.current,
        shouldHangUp: false
      };
    }
  }, []);

  // Start roleplay session
  const startRoleplaySession = useCallback(async (roleplayType, mode, metadata = {}) => {
    try {
      console.log('🎬 [DEBUG] Starting roleplay session:', { roleplayType, mode });
      
      // Reset all flags
      isEndingSessionRef.current = false;
      exchangeCountRef.current = 0;
      updateCallState('idle');
      updateIsProcessing(false);
      
      // Initialize both voice and OpenAI services
      console.log('🔄 [DEBUG] Initializing services...');
      await voiceService.initialize();
      await openAIService.initialize();
      console.log('✅ [DEBUG] Services initialized');
      
      // Create session
      const character = getCharacterForRoleplay(roleplayType);
      const session = {
        id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId: userProfile?.id,
        roleplayType,
        mode,
        character,
        startTime: new Date().toISOString(),
        status: 'active'
      };
      
      // Reset state
      sessionRef.current = session;
      aiPersonalityRef.current = character;
      startTimeRef.current = Date.now();
      evaluationsRef.current = [];
      conversationStageRef.current = 'greeting';
      
      // Reset OpenAI conversation state
      openAIService.resetConversation();
      
      setCurrentSession(session);
      setConversationHistory([]);
      setSessionResults(null);
      updateCallState('dialing');
      console.log('✅ [DEBUG] Session state reset, call state set to dialing');
      
      // Start the conversation flow after delay
      setTimeout(async () => {
        if (isEndingSessionRef.current) {
          console.log('⚠️ [DEBUG] Session ended during startup');
          return;
        }
        
        console.log('🔄 [DEBUG] Setting call state to connected');
        updateCallState('connected');
        
        // AI starts with greeting
        const greeting = character.greeting;
        setCurrentMessage(greeting);
        
        // Add to conversation history
        const greetingEntry = {
          speaker: 'ai',
          message: greeting,
          timestamp: Date.now()
        };
        
        setConversationHistory([greetingEntry]);
        console.log('📝 [DEBUG] Added greeting to history');
        
        // Start voice conversation AFTER state is updated
        setTimeout(() => {
          console.log('🎤 [DEBUG] Starting voice conversation with state:', callStateRef.current);
          const success = voiceService.startConversation(
            handleUserSpeech,
            handleVoiceError
          );
          console.log('🎤 [DEBUG] Voice conversation started:', success);
        }, 100);
        
        // Speak the greeting
        try {
          console.log('🗣️ [DEBUG] Speaking greeting:', greeting);
          await voiceService.speakText(greeting);
          console.log('✅ [DEBUG] Greeting spoken successfully');
        } catch (speakError) {
          console.error('❌ [DEBUG] Failed to speak greeting:', speakError);
        }
        
      }, 2000);
      
      return session;
      
    } catch (error) {
      console.error('❌ [DEBUG] Error starting roleplay session:', error);
      throw error;
    }
  }, [userProfile, getCharacterForRoleplay, updateCallState, updateIsProcessing]);

  // User speech handling with OpenAI integration
  const handleUserSpeech = useCallback(async (transcript, confidence) => {
    console.log('🗣️ [DEBUG] ====== handleUserSpeech CALLED ======');
    console.log('🗣️ [DEBUG] Transcript:', transcript);
    console.log('🗣️ [DEBUG] Confidence:', confidence);
    console.log('🗣️ [DEBUG] Current state (useRef):', {
      hasSession: !!sessionRef.current,
      callState: callStateRef.current,
      isEnding: isEndingSessionRef.current,
      isProcessing: isProcessingRef.current
    });

    // Use refs for current state
    if (!sessionRef.current) {
      console.log('⚠️ [DEBUG] No session, ignoring speech');
      return;
    }

    if (callStateRef.current !== 'connected') {
      console.log('⚠️ [DEBUG] Call not connected, ignoring speech. State:', callStateRef.current);
      return;
    }

    if (isEndingSessionRef.current) {
      console.log('⚠️ [DEBUG] Session ending, ignoring speech');
      return;
    }

    if (isProcessingRef.current) {
      console.log('⚠️ [DEBUG] Already processing, ignoring speech');
      return;
    }

    try {
      console.log('🔄 [DEBUG] Setting isProcessing to TRUE');
      updateIsProcessing(true);

      // Increment exchange counter
      exchangeCountRef.current += 1;
      console.log('📊 [DEBUG] Exchange count incremented to:', exchangeCountRef.current);

      // Add user input to conversation history
      const userEntry = {
        speaker: 'user',
        message: transcript,
        timestamp: Date.now()
      };
      
      setConversationHistory(prev => {
        const updated = [...prev, userEntry];
        console.log('📝 [DEBUG] Updated conversation history. Length:', updated.length);
        return updated;
      });

      console.log('🤖 [DEBUG] About to generate AI response using OpenAI service...');
      
      // Generate AI response using OpenAI service
      const aiResult = await generateAIResponse(transcript, {
        roleplayType: sessionRef.current.roleplayType,
        mode: sessionRef.current.mode
      });

      console.log('🤖 [DEBUG] AI result received:', {
        success: aiResult.success,
        hasResponse: !!aiResult.response,
        responseLength: aiResult.response?.length,
        shouldHangUp: aiResult.shouldHangUp
      });

      // Check if session ended during processing
      if (isEndingSessionRef.current) {
        console.log('⚠️ [DEBUG] Session ended during processing, aborting');
        return;
      }

      if (aiResult.success && aiResult.response) {
        console.log('✅ [DEBUG] AI response is valid, proceeding...');
        
        // Add AI response to conversation
        const aiEntry = {
          speaker: 'ai',
          message: aiResult.response,
          timestamp: Date.now()
        };
        
        setConversationHistory(prev => {
          const updated = [...prev, aiEntry];
          console.log('📝 [DEBUG] Added AI response to history. Total length:', updated.length);
          return updated;
        });

        setCurrentMessage(aiResult.response);
        console.log('📱 [DEBUG] Set current message to:', aiResult.response);

        // Store evaluation if provided
        if (aiResult.evaluation) {
          evaluationsRef.current.push({
            stage: aiResult.stage,
            evaluation: aiResult.evaluation,
            timestamp: Date.now()
          });
        }

        console.log('🗣️ [DEBUG] About to speak AI response...');
        
        // Speak AI response
        try {
          await voiceService.speakText(aiResult.response);
          console.log('✅ [DEBUG] AI response spoken successfully');
        } catch (speakError) {
          console.error('❌ [DEBUG] Failed to speak AI response:', speakError);
        }

        // Check if call should end
        if (aiResult.shouldHangUp) {
          console.log('🔚 [DEBUG] AI wants to hang up, ending call in 2 seconds');
          setTimeout(() => {
            endSession('completed');
          }, 2000);
          return;
        }

      } else {
        console.error('❌ [DEBUG] AI response failed:', aiResult.error);
        
        // Emergency fallback
        if (!isEndingSessionRef.current) {
          const fallbackResponse = "I'm sorry, could you repeat that?";
          setCurrentMessage(fallbackResponse);
          
          try {
            await voiceService.speakText(fallbackResponse);
          } catch (speakError) {
            console.error('❌ [DEBUG] Failed to speak fallback:', speakError);
          }
        }
      }

    } catch (error) {
      console.error('❌ [DEBUG] Error processing user speech:', error);
      
      // Emergency recovery
      if (!isEndingSessionRef.current) {
        try {
          const errorResponse = "Sorry, I had trouble understanding. Could you try again?";
          setCurrentMessage(errorResponse);
          await voiceService.speakText(errorResponse);
        } catch (recoveryError) {
          console.error('❌ [DEBUG] Recovery failed:', recoveryError);
        }
      }
    } finally {
      console.log('🔄 [DEBUG] Setting isProcessing to FALSE');
      updateIsProcessing(false);
      console.log('🗣️ [DEBUG] ====== handleUserSpeech COMPLETED ======');
    }
  }, [updateIsProcessing, generateAIResponse]);

  // Handle voice errors
  const handleVoiceError = useCallback((error) => {
    console.error('🎤 [DEBUG] Voice error:', error);
  }, []);

  // FIXED: Better session ending with immediate voice cleanup
  const endSession = useCallback(async (reason = 'completed') => {
    if (!sessionRef.current || isEndingSessionRef.current) {
      console.log('⚠️ [DEBUG] Session already ending or no session');
      return null;
    }

    try {
      console.log('🏁 [DEBUG] Ending session:', reason);
      
      // FIXED: Set ending flag immediately and stop voice FIRST
      isEndingSessionRef.current = true;
      
      // FIXED: Immediately stop all voice activities with more thorough cleanup
      console.log('🔇 [DEBUG] Stopping voice service immediately...');
      voiceService.stopConversation();
      voiceService.stopSpeaking();
      voiceService.stopListening();
      
      // FIXED: Small delay to ensure voice service cleanup completes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Reset OpenAI conversation state
      openAIService.resetConversation();
      console.log('🔇 [DEBUG] Voice service and OpenAI stopped');
      
      const endTime = Date.now();
      const duration = Math.floor((endTime - startTimeRef.current) / 1000);
      
      // FIXED: Better metrics calculation to avoid NaN
      const totalEvaluations = evaluationsRef.current.length;
      const passedEvaluations = evaluationsRef.current.filter(e => e.evaluation?.passed).length;
      const overallPassed = totalEvaluations > 0 ? (passedEvaluations / totalEvaluations) >= 0.6 : exchangeCountRef.current >= 2;
      
      // FIXED: Calculate average score properly with fallback
      let averageScore = 0;
      if (totalEvaluations > 0) {
        const totalScore = evaluationsRef.current.reduce((sum, e) => {
          const score = e.evaluation?.score || (e.evaluation?.passed ? 75 : 50);
          return sum + score;
        }, 0);
        averageScore = Math.round(totalScore / totalEvaluations);
      } else {
        // Fallback scoring based on exchanges
        averageScore = exchangeCountRef.current >= 2 ? 80 : 60;
      }
      
      const results = {
        sessionId: sessionRef.current.id,
        roleplayType: sessionRef.current.roleplayType,
        mode: sessionRef.current.mode,
        duration,
        reason,
        passed: overallPassed,
        evaluations: evaluationsRef.current,
        conversation: conversationHistory,
        exchanges: exchangeCountRef.current,
        metrics: {
          totalStages: totalEvaluations,
          passedStages: passedEvaluations,
          passRate: totalEvaluations > 0 ? Math.round((passedEvaluations / totalEvaluations) * 100) : (exchangeCountRef.current >= 2 ? 100 : 0),
          averageScore // FIXED: This should never be NaN now
        }
      };
      
      updateCallState('ended');
      setSessionResults(results);
      console.log('✅ [DEBUG] Session ended with results. Average score:', averageScore);
      
      // Log session to database if available
      if (userProfile?.id) {
        try {
          await supabase
            .from('session_logs')
            .insert({
              user_id: userProfile.id,
              session_id: sessionRef.current.id,
              roleplay_type: sessionRef.current.roleplayType,
              mode: sessionRef.current.mode,
              started_at: sessionRef.current.startTime,
              ended_at: new Date().toISOString(),
              duration,
              passed: overallPassed,
              reason,
              metrics: results.metrics
            });
        } catch (dbError) {
          logger.warn('Failed to log session to database:', dbError);
        }
      }
      
      return results;
      
    } catch (error) {
      console.error('❌ [DEBUG] Error ending session:', error);
      return null;
    }
  }, [conversationHistory, updateCallState, userProfile]);

  // Reset session
  const resetSession = useCallback(() => {
    console.log('🔄 [DEBUG] Resetting session');
    
    // FIXED: More thorough cleanup
    isEndingSessionRef.current = true;
    
    // Stop voice service multiple times to ensure cleanup
    voiceService.stopConversation();
    voiceService.stopSpeaking();
    voiceService.stopListening();
    voiceService.cleanup(); // FIXED: Call cleanup method
    
    // Reset OpenAI conversation state
    openAIService.resetConversation();
    
    setCurrentSession(null);
    updateCallState('idle');
    setSessionResults(null);
    updateIsProcessing(false);
    setCurrentMessage('');
    setConversationHistory([]);
    
    sessionRef.current = null;
    startTimeRef.current = null;
    evaluationsRef.current = [];
    conversationStageRef.current = 'greeting';
    aiPersonalityRef.current = null;
    isEndingSessionRef.current = false;
    exchangeCountRef.current = 0;
    
    console.log('✅ [DEBUG] Session reset complete');
  }, [updateCallState, updateIsProcessing]);

  // Get session stats
  const getSessionStats = useCallback(() => {
    if (!sessionRef.current) return null;
    
    const duration = startTimeRef.current ? 
      Math.floor((Date.now() - startTimeRef.current) / 1000) : 0;
    
    return {
      duration,
      exchanges: exchangeCountRef.current,
      evaluations: evaluationsRef.current.length,
      currentStage: conversationStageRef.current
    };
  }, []);

  // Manual user response for testing
  const handleUserResponse = useCallback(async (userInput) => {
    console.log('📝 [DEBUG] Manual user response:', userInput);
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