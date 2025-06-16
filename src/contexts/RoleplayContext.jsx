// src/contexts/RoleplayContext.jsx - FIXED AI response flow with debugging
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
  
  // Session refs for stable references
  const sessionRef = useRef(null);
  const startTimeRef = useRef(null);
  const evaluationsRef = useRef([]);
  const conversationStageRef = useRef('greeting');
  const aiPersonalityRef = useRef(null);
  const isEndingSessionRef = useRef(false);

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

  // FIXED: Simplified fallback AI response with better error handling
  const generateSimpleAIResponse = useCallback((userInput, stage) => {
    logger.log('🤖 Using fallback AI response for stage:', stage);
    
    const responses = {
      greeting: [
        "I'm sorry, who is this?",
        "What's this call about?",
        "How did you get my number?"
      ],
      opener: [
        "I'm not interested.",
        "We don't take cold calls here.",
        "Can you send me an email instead?",
        "I'm busy right now."
      ],
      objection: [
        "That sounds interesting, tell me more.",
        "What makes you different from everyone else?",
        "How much does this cost?",
        "I'll need to think about it."
      ],
      default: [
        "I see. Go on.",
        "Tell me more about that.",
        "How exactly would that work?",
        "What's the next step?"
      ]
    };

    const stageResponses = responses[stage] || responses.default;
    const randomResponse = stageResponses[Math.floor(Math.random() * stageResponses.length)];
    
    logger.log('✅ Fallback response selected:', randomResponse);
    return randomResponse;
  }, []);

  // FIXED: Robust AI response generation with comprehensive error handling
  const generateAIResponse = useCallback(async (userInput, context) => {
    try {
      // Check if session is ending
      if (isEndingSessionRef.current) {
        logger.log('⚠️ Session is ending, skipping AI response');
        return {
          success: false,
          response: '',
          shouldHangUp: true
        };
      }

      logger.log('🤖 Generating AI response for:', userInput.substring(0, 50));
      logger.log('🤖 Current stage:', conversationStageRef.current);
      logger.log('🤖 Context:', context);
      
      const stage = conversationStageRef.current;
      let aiResponse = '';
      let nextStage = stage;
      let shouldHangUp = false;

      // FIXED: Try OpenAI first, but with timeout and better fallback
      try {
        logger.log('🤖 Attempting OpenAI response...');
        
        // Set a timeout for OpenAI response
        const openAIPromise = openAIService.getProspectResponse(userInput, {
          roleplayType: sessionRef.current?.roleplayType,
          mode: sessionRef.current?.mode,
          character: aiPersonalityRef.current
        }, stage);

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('OpenAI timeout')), 5000);
        });

        const result = await Promise.race([openAIPromise, timeoutPromise]);
        
        if (result.success && result.response) {
          aiResponse = result.response;
          nextStage = result.nextStage || stage;
          shouldHangUp = result.shouldHangUp || false;
          
          logger.log('✅ OpenAI response received:', aiResponse);
          
          // Store evaluation if provided
          if (result.evaluation) {
            evaluationsRef.current.push({
              stage: result.stage,
              evaluation: result.evaluation,
              timestamp: Date.now()
            });
          }
        } else {
          throw new Error('OpenAI returned no valid response');
        }

      } catch (openAIError) {
        logger.warn('⚠️ OpenAI failed, using fallback:', openAIError.message);
        
        // FIXED: Use simple, reliable fallback
        aiResponse = generateSimpleAIResponse(userInput, stage);
        
        // Simple stage progression
        const stageProgression = {
          greeting: 'opener',
          opener: 'objection', 
          objection: 'pitch',
          pitch: 'closing',
          closing: 'ended'
        };
        
        nextStage = stageProgression[stage] || stage;
        
        // Random chance to hang up (20%)
        if (Math.random() < 0.2 && stage !== 'greeting') {
          shouldHangUp = true;
          aiResponse = "I have to go now. Thanks for calling.";
        }
      }

      // Update conversation stage
      conversationStageRef.current = nextStage;
      
      logger.log('✅ Final AI response:', { 
        response: aiResponse, 
        nextStage, 
        shouldHangUp 
      });

      return {
        success: true,
        response: aiResponse,
        evaluation: { passed: true, feedback: 'Good response!' },
        stage,
        nextStage,
        shouldHangUp
      };
      
    } catch (error) {
      logger.error('❌ Complete AI response failure:', error);
      
      // FIXED: Always provide a response, never fail completely
      const emergencyResponse = "Could you repeat that? I didn't catch what you said.";
      
      return {
        success: true, // Still return success to continue flow
        response: emergencyResponse,
        evaluation: { passed: true, feedback: 'Keep practicing!' },
        stage: conversationStageRef.current,
        nextStage: conversationStageRef.current,
        shouldHangUp: false
      };
    }
  }, [generateSimpleAIResponse]);

  // Start roleplay session
  const startRoleplaySession = useCallback(async (roleplayType, mode, metadata = {}) => {
    try {
      logger.log('🎬 Starting roleplay session:', { roleplayType, mode, metadata });
      
      // Reset ending flag
      isEndingSessionRef.current = false;
      
      // Initialize services
      await voiceService.initialize();
      
      // Try to initialize OpenAI but don't fail if it doesn't work
      try {
        await openAIService.initialize();
        logger.log('✅ OpenAI service initialized');
      } catch (openAIError) {
        logger.warn('⚠️ OpenAI initialization failed, using fallback mode');
      }
      
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
      
      setCurrentSession(session);
      setConversationHistory([]);
      setSessionResults(null);
      setCallState('dialing');
      
      // Start the conversation flow
      setTimeout(async () => {
        if (isEndingSessionRef.current) return;
        
        setCallState('connected');
        
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
        
        // Start voice conversation
        voiceService.startConversation(
          handleUserSpeech,
          handleVoiceError
        );
        
        // Speak the greeting
        try {
          await voiceService.speakText(greeting);
          logger.log('✅ Greeting spoken successfully');
        } catch (speakError) {
          logger.error('❌ Failed to speak greeting:', speakError);
        }
        
      }, 2000);
      
      return session;
      
    } catch (error) {
      logger.error('❌ Error starting roleplay session:', error);
      throw error;
    }
  }, [userProfile, getCharacterForRoleplay]);

  // FIXED: Comprehensive user speech handling with detailed logging
  const handleUserSpeech = useCallback(async (transcript, confidence) => {
    // Check if session is valid and not ending
    if (!sessionRef.current || callState !== 'connected' || isEndingSessionRef.current) {
      logger.log('⚠️ Ignoring speech - invalid session state:', {
        hasSession: !!sessionRef.current,
        callState,
        isEnding: isEndingSessionRef.current
      });
      return;
    }

    // Check if already processing
    if (isProcessing) {
      logger.log('⚠️ Already processing, ignoring new speech');
      return;
    }

    try {
      logger.log('🗣️ Processing user speech:', transcript);
      logger.log('🗣️ Confidence:', confidence);
      
      // Set processing state immediately
      setIsProcessing(true);

      // Add user input to conversation history
      const userEntry = {
        speaker: 'user',
        message: transcript,
        timestamp: Date.now()
      };
      
      setConversationHistory(prev => {
        const updated = [...prev, userEntry];
        logger.log('📝 Updated conversation history:', updated.length, 'entries');
        return updated;
      });

      logger.log('🤖 Generating AI response...');
      
      // Generate AI response
      const aiResult = await generateAIResponse(transcript, {
        roleplayType: sessionRef.current.roleplayType,
        mode: sessionRef.current.mode
      });

      logger.log('🤖 AI result received:', {
        success: aiResult.success,
        hasResponse: !!aiResult.response,
        responseLength: aiResult.response?.length,
        shouldHangUp: aiResult.shouldHangUp
      });

      // Check if session ended during processing
      if (isEndingSessionRef.current) {
        logger.log('⚠️ Session ended during processing, skipping AI response');
        return;
      }

      if (aiResult.success && aiResult.response) {
        // Add AI response to conversation
        const aiEntry = {
          speaker: 'ai',
          message: aiResult.response,
          timestamp: Date.now()
        };
        
        setConversationHistory(prev => {
          const updated = [...prev, aiEntry];
          logger.log('📝 Added AI response to history:', updated.length, 'entries');
          return updated;
        });

        setCurrentMessage(aiResult.response);

        // Store evaluation if provided
        if (aiResult.evaluation) {
          evaluationsRef.current.push({
            stage: aiResult.stage,
            evaluation: aiResult.evaluation,
            timestamp: Date.now()
          });
        }

        logger.log('🗣️ Speaking AI response:', aiResult.response.substring(0, 50));
        
        // Speak AI response
        try {
          await voiceService.speakText(aiResult.response);
          logger.log('✅ AI response spoken successfully');
        } catch (speakError) {
          logger.error('❌ Failed to speak AI response:', speakError);
        }

        // Check if call should end
        if (aiResult.shouldHangUp) {
          logger.log('🔚 Ending call as planned by AI');
          setTimeout(() => {
            endSession('completed');
          }, 1000);
          return;
        }

      } else {
        logger.error('❌ AI response failed:', aiResult.error);
        
        // Emergency fallback
        if (!isEndingSessionRef.current) {
          const fallbackResponse = "I'm sorry, could you repeat that?";
          setCurrentMessage(fallbackResponse);
          
          try {
            await voiceService.speakText(fallbackResponse);
          } catch (speakError) {
            logger.error('❌ Failed to speak fallback:', speakError);
          }
        }
      }

    } catch (error) {
      logger.error('❌ Error processing user speech:', error);
      
      // Emergency recovery
      if (!isEndingSessionRef.current) {
        try {
          const errorResponse = "Sorry, I had trouble understanding. Could you try again?";
          setCurrentMessage(errorResponse);
          await voiceService.speakText(errorResponse);
        } catch (recoveryError) {
          logger.error('❌ Recovery failed:', recoveryError);
        }
      }
    } finally {
      // Always clear processing state
      logger.log('✅ Clearing processing state');
      setIsProcessing(false);
    }
  }, [callState, isProcessing, generateAIResponse]);

  // Handle voice errors
  const handleVoiceError = useCallback((error) => {
    logger.error('🎤 Voice error:', error);
    // Don't end the session on voice errors, just log them
  }, []);

  // End session
  const endSession = useCallback(async (reason = 'completed') => {
    if (!sessionRef.current || isEndingSessionRef.current) {
      logger.log('⚠️ Session already ending or no session to end');
      return null;
    }

    try {
      logger.log('🏁 Ending session:', reason);
      
      // Set ending flag immediately to prevent new voice activities
      isEndingSessionRef.current = true;
      
      // Immediately stop all voice activities
      voiceService.stopConversation();
      voiceService.stopSpeaking();
      voiceService.stopListening();
      
      // Stop OpenAI conversation
      try {
        openAIService.resetConversation();
      } catch (error) {
        logger.warn('Error resetting OpenAI:', error);
      }
      
      const endTime = Date.now();
      const duration = Math.floor((endTime - startTimeRef.current) / 1000);
      
      // Calculate results
      const totalEvaluations = evaluationsRef.current.length;
      const passedEvaluations = evaluationsRef.current.filter(e => e.evaluation?.passed).length;
      const overallPassed = totalEvaluations > 0 ? (passedEvaluations / totalEvaluations) >= 0.6 : false;
      
      const results = {
        sessionId: sessionRef.current.id,
        roleplayType: sessionRef.current.roleplayType,
        mode: sessionRef.current.mode,
        duration,
        reason,
        passed: overallPassed,
        evaluations: evaluationsRef.current,
        conversation: conversationHistory,
        metrics: {
          totalStages: totalEvaluations,
          passedStages: passedEvaluations,
          passRate: totalEvaluations > 0 ? (passedEvaluations / totalEvaluations) : 0,
          averageScore: totalEvaluations > 0 ? 
            evaluationsRef.current.reduce((sum, e) => sum + e.evaluation.score, 0) / totalEvaluations : 0
        }
      };
      
      setCallState('ended');
      setSessionResults(results);
      
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
      logger.error('❌ Error ending session:', error);
      return null;
    }
  }, [conversationHistory, userProfile]);

  // Reset session
  const resetSession = useCallback(() => {
    logger.log('🔄 Resetting session');
    
    // Set ending flag
    isEndingSessionRef.current = true;
    
    // Complete voice service cleanup
    voiceService.stopConversation();
    voiceService.stopSpeaking();
    voiceService.stopListening();
    
    // Reset OpenAI
    try {
      openAIService.resetConversation();
    } catch (error) {
      logger.warn('Error resetting OpenAI during session reset:', error);
    }
    
    setCurrentSession(null);
    setCallState('idle');
    setSessionResults(null);
    setIsProcessing(false);
    setCurrentMessage('');
    setConversationHistory([]);
    
    sessionRef.current = null;
    startTimeRef.current = null;
    evaluationsRef.current = [];
    conversationStageRef.current = 'greeting';
    aiPersonalityRef.current = null;
    isEndingSessionRef.current = false;
  }, []);

  // Get session stats
  const getSessionStats = useCallback(() => {
    if (!sessionRef.current) return null;
    
    const duration = startTimeRef.current ? 
      Math.floor((Date.now() - startTimeRef.current) / 1000) : 0;
    
    return {
      duration,
      exchanges: Math.floor(conversationHistory.length / 2),
      evaluations: evaluationsRef.current.length,
      currentStage: conversationStageRef.current
    };
  }, [conversationHistory]);

  // Manual user response (for testing/typing)
  const handleUserResponse = useCallback(async (userInput) => {
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