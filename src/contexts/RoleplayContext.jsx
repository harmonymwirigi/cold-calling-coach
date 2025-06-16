// src/contexts/RoleplayContext.jsx - SIMPLIFIED for reliable AI responses
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { voiceService } from '../services/voiceService';
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
  const exchangeCountRef = useRef(0); // Track conversation exchanges

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

  // SIMPLIFIED: Fast, reliable AI response generator
  const generateSimpleAIResponse = useCallback((userInput, stage, exchangeCount) => {
    logger.log('🤖 Generating simple AI response for stage:', stage, 'exchange:', exchangeCount);
    
    // Define responses by conversation stage and exchange count
    const responseMap = {
      // First exchange after greeting
      1: [
        "Who is this?",
        "What's this about?", 
        "How did you get my number?",
        "I'm busy right now.",
        "What company are you with?"
      ],
      // Second exchange - objections
      2: [
        "I'm not interested.",
        "We don't take cold calls.",
        "Can you send me an email instead?",
        "I don't have time for this.",
        "We already have a solution for that."
      ],
      // Third exchange - follow up
      3: [
        "That sounds expensive.",
        "How is this different from what we have?",
        "What kind of results are we talking about?",
        "I'll need to think about it.",
        "Can you prove that works?"
      ],
      // Fourth exchange - consideration
      4: [
        "Tell me more about the pricing.",
        "What's the next step?",
        "I'll need to discuss this with my team.",
        "Send me some information.",
        "That's interesting, but I'm not sure."
      ],
      // Fifth+ exchange - ending
      5: [
        "I have to go now.",
        "Thanks for calling. I'll consider it.", 
        "We'll be in touch.",
        "I need to get to my next meeting.",
        "Let me think about it and get back to you."
      ]
    };

    // Determine which response set to use
    const responseKey = Math.min(exchangeCount, 5);
    const responses = responseMap[responseKey] || responseMap[5];
    
    // Random selection with some input-based logic
    let selectedResponse;
    const lowerInput = userInput.toLowerCase();
    
    if (responseKey === 1) {
      // First response - ask who they are
      if (lowerInput.includes('hello') || lowerInput.includes('hi')) {
        selectedResponse = responses[Math.floor(Math.random() * 3)]; // First 3 are identity questions
      } else {
        selectedResponse = responses[Math.floor(Math.random() * responses.length)];
      }
    } else if (responseKey === 2) {
      // Second response - objections
      if (lowerInput.includes('help') || lowerInput.includes('save')) {
        selectedResponse = "We already have a solution for that.";
      } else {
        selectedResponse = responses[Math.floor(Math.random() * responses.length)];
      }
    } else {
      // Later responses
      selectedResponse = responses[Math.floor(Math.random() * responses.length)];
    }

    // Determine if call should end (20% chance after exchange 3)
    const shouldHangUp = exchangeCount >= 3 && Math.random() < 0.2;

    if (shouldHangUp) {
      selectedResponse = "I have to go now. Thanks for calling.";
    }

    logger.log('✅ Selected AI response:', selectedResponse, 'shouldHangUp:', shouldHangUp);

    return {
      success: true,
      response: selectedResponse,
      shouldHangUp,
      evaluation: { passed: true, feedback: 'Good response!' }
    };
  }, []);

  // Start roleplay session
  const startRoleplaySession = useCallback(async (roleplayType, mode, metadata = {}) => {
    try {
      logger.log('🎬 Starting roleplay session:', { roleplayType, mode, metadata });
      
      // Reset ending flag
      isEndingSessionRef.current = false;
      exchangeCountRef.current = 0;
      
      // Initialize voice service
      await voiceService.initialize();
      
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

  // SIMPLIFIED: User speech handling with guaranteed AI response
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

      // Increment exchange counter
      exchangeCountRef.current += 1;
      logger.log('📊 Exchange count:', exchangeCountRef.current);

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
      
      // Generate simple, reliable AI response
      const aiResult = generateSimpleAIResponse(
        transcript, 
        conversationStageRef.current,
        exchangeCountRef.current
      );

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
            stage: conversationStageRef.current,
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
          }, 2000); // Give time for final message
          return;
        }

      } else {
        logger.error('❌ AI response failed - this should never happen with simple responses');
        
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
      
      // Emergency recovery - always provide a response
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
  }, [callState, isProcessing, generateSimpleAIResponse]);

  // Handle voice errors
  const handleVoiceError = useCallback((error) => {
    logger.error('🎤 Voice error:', error);
    // Don't end the session on voice errors, just log them
  }, []);

  // End session with proper cleanup
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
      
      const endTime = Date.now();
      const duration = Math.floor((endTime - startTimeRef.current) / 1000);
      
      // Calculate results
      const totalEvaluations = evaluationsRef.current.length;
      const passedEvaluations = evaluationsRef.current.filter(e => e.evaluation?.passed).length;
      const overallPassed = exchangeCountRef.current >= 2; // Pass if had at least 2 exchanges
      
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

  // Reset session with complete cleanup
  const resetSession = useCallback(() => {
    logger.log('🔄 Resetting session');
    
    // Set ending flag
    isEndingSessionRef.current = true;
    
    // Complete voice service cleanup
    voiceService.stopConversation();
    voiceService.stopSpeaking();
    voiceService.stopListening();
    
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
    exchangeCountRef.current = 0;
  }, []);

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