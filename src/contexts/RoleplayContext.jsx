// src/contexts/RoleplayContext.jsx - FIXED hangup handling
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { voiceService } from '../services/voiceService';
import { openAIService } from '../services/openaiService'; // FIXED: Use OpenAI service
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
  const isEndingSessionRef = useRef(false); // FIXED: Track if session is ending

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

  // FIXED: Use OpenAI service for AI responses
  const generateAIResponse = useCallback(async (userInput, context) => {
    try {
      // FIXED: Check if session is ending
      if (isEndingSessionRef.current) {
        logger.log('⚠️ Session is ending, skipping AI response');
        return {
          success: false,
          response: '',
          shouldHangUp: true
        };
      }

      logger.log('🤖 Generating AI response for:', userInput);
      
      const stage = conversationStageRef.current;
      
      // FIXED: Use OpenAI service instead of local logic
      const result = await openAIService.getProspectResponse(userInput, {
        roleplayType: sessionRef.current?.roleplayType,
        mode: sessionRef.current?.mode,
        character: aiPersonalityRef.current
      }, stage);

      if (result.success) {
        // Update stage
        conversationStageRef.current = result.nextStage || stage;
        
        // Store evaluation if provided
        if (result.evaluation) {
          evaluationsRef.current.push({
            stage: result.stage,
            evaluation: result.evaluation,
            timestamp: Date.now()
          });
        }
      }

      return result;
      
    } catch (error) {
      logger.error('❌ Error generating AI response:', error);
      
      // FIXED: Check if session ending before fallback
      if (isEndingSessionRef.current) {
        return {
          success: false,
          response: '',
          shouldHangUp: true
        };
      }
      
      return {
        success: false,
        error: error.message,
        response: "I'm sorry, could you repeat that?",
        stage: conversationStageRef.current,
        shouldHangUp: false
      };
    }
  }, []);

  // Start roleplay session
  const startRoleplaySession = useCallback(async (roleplayType, mode, metadata = {}) => {
    try {
      logger.log('🎬 Starting roleplay session:', { roleplayType, mode, metadata });
      
      // Reset ending flag
      isEndingSessionRef.current = false;
      
      // Initialize services
      await voiceService.initialize();
      await openAIService.initialize(); // FIXED: Initialize OpenAI service
      
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
        // FIXED: Check if session still active
        if (isEndingSessionRef.current) return;
        
        setCallState('connected');
        
        // AI starts with greeting
        const greeting = character.greeting;
        setCurrentMessage(greeting);
        
        // Add to conversation history
        setConversationHistory([{
          speaker: 'ai',
          message: greeting,
          timestamp: Date.now()
        }]);
        
        // Start voice conversation
        voiceService.startConversation(
          handleUserSpeech,
          handleVoiceError
        );
        
        // Speak the greeting
        await voiceService.speakText(greeting);
        
      }, 2000);
      
      return session;
      
    } catch (error) {
      logger.error('❌ Error starting roleplay session:', error);
      throw error;
    }
  }, [userProfile, getCharacterForRoleplay]);

  // Handle user speech input
  const handleUserSpeech = useCallback(async (transcript, confidence) => {
    // FIXED: Check if session is ending
    if (!sessionRef.current || callState !== 'connected' || isProcessing || isEndingSessionRef.current) {
      logger.log('⚠️ Ignoring speech - session ending or invalid state');
      return;
    }

    try {
      setIsProcessing(true);
      logger.log('🗣️ Processing user speech:', transcript);

      // Add user input to conversation
      setConversationHistory(prev => [...prev, {
        speaker: 'user',
        message: transcript,
        timestamp: Date.now()
      }]);

      // Generate AI response
      const aiResult = await generateAIResponse(transcript, {
        roleplayType: sessionRef.current.roleplayType,
        mode: sessionRef.current.mode
      });

      // FIXED: Check if session ended during processing
      if (isEndingSessionRef.current) {
        logger.log('⚠️ Session ended during processing, skipping AI response');
        return;
      }

      if (aiResult.success) {
        // Add AI response to conversation
        setConversationHistory(prev => [...prev, {
          speaker: 'ai',
          message: aiResult.response,
          timestamp: Date.now()
        }]);

        setCurrentMessage(aiResult.response);

        // Store evaluation if provided
        if (aiResult.evaluation) {
          evaluationsRef.current.push({
            stage: aiResult.stage,
            evaluation: aiResult.evaluation,
            timestamp: Date.now()
          });
        }

        // Speak AI response
        await voiceService.speakText(aiResult.response);

        // Check if call should end
        if (aiResult.shouldHangUp) {
          logger.log('🔚 Ending call as planned');
          setTimeout(() => {
            endSession('completed');
          }, 1000);
        }

      } else {
        logger.error('❌ AI response failed:', aiResult.error);
        
        if (!isEndingSessionRef.current) {
          const fallbackResponse = "I'm sorry, could you repeat that?";
          await voiceService.speakText(fallbackResponse);
          setCurrentMessage(fallbackResponse);
        }
      }

    } catch (error) {
      logger.error('❌ Error processing user speech:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [callState, isProcessing, generateAIResponse]);

  // Handle voice errors
  const handleVoiceError = useCallback((error) => {
    logger.error('🎤 Voice error:', error);
    // Don't end the session on voice errors, just log them
  }, []);

  // FIXED: Improved end session with immediate cleanup
  const endSession = useCallback(async (reason = 'completed') => {
    if (!sessionRef.current || isEndingSessionRef.current) {
      logger.log('⚠️ Session already ending or no session to end');
      return null;
    }

    try {
      logger.log('🏁 Ending session:', reason);
      
      // FIXED: Set ending flag immediately to prevent new voice activities
      isEndingSessionRef.current = true;
      
      // FIXED: Immediately stop all voice activities
      voiceService.stopConversation();
      voiceService.stopSpeaking();
      voiceService.stopListening();
      
      // Stop OpenAI conversation
      openAIService.resetConversation();
      
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

  // FIXED: Complete reset with cleanup
  const resetSession = useCallback(() => {
    logger.log('🔄 Resetting session');
    
    // Set ending flag
    isEndingSessionRef.current = true;
    
    // Complete voice service cleanup
    voiceService.stopConversation();
    voiceService.stopSpeaking();
    voiceService.stopListening();
    
    // Reset OpenAI
    openAIService.resetConversation();
    
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
    isEndingSessionRef.current = false; // Reset flag
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