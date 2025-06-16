// src/contexts/RoleplayContext.jsx - FIXED to work with the new VoiceService API
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
  const [callState, setCallState] = useState('idle'); // idle, dialing, connected, ended
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

  // AI Response Generator with realistic conversation flow
  const generateAIResponse = useCallback(async (userInput, context) => {
    try {
      logger.log('🤖 Generating AI response for:', userInput);
      
      const character = aiPersonalityRef.current;
      const stage = conversationStageRef.current;
      const conversationLength = conversationHistory.length;
      
      // Determine conversation stage progression
      let nextStage = stage;
      let shouldHangUp = false;
      let evaluation = null;
      
      // Stage progression logic
      if (stage === 'greeting' && conversationLength >= 2) {
        nextStage = 'opener_response';
      } else if (stage === 'opener_response' && conversationLength >= 4) {
        nextStage = 'objection';
      } else if (stage === 'objection' && conversationLength >= 6) {
        nextStage = 'pitch_response';
      } else if (stage === 'pitch_response' && conversationLength >= 8) {
        nextStage = 'closing';
      } else if (conversationLength >= 12) {
        nextStage = 'ending';
        shouldHangUp = true;
      }
      
      conversationStageRef.current = nextStage;
      
      // Generate contextual response based on stage and user input
      let aiResponse = '';
      
      switch (nextStage) {
        case 'opener_response':
          aiResponse = generateOpenerResponse(userInput, character);
          evaluation = evaluateOpener(userInput);
          break;
          
        case 'objection':
          aiResponse = generateObjection(userInput, character);
          evaluation = evaluateResponse(userInput, 'objection_handling');
          break;
          
        case 'pitch_response':
          aiResponse = generatePitchResponse(userInput, character);
          evaluation = evaluateResponse(userInput, 'pitch');
          break;
          
        case 'closing':
          aiResponse = generateClosingResponse(userInput, character);
          evaluation = evaluateResponse(userInput, 'closing');
          break;
          
        case 'ending':
          aiResponse = generateEndingResponse(userInput, character);
          evaluation = evaluateResponse(userInput, 'overall');
          shouldHangUp = true;
          break;
          
        default:
          aiResponse = `${character.greeting}`;
      }
      
      // Add some personality variations
      aiResponse = addPersonalityToResponse(aiResponse, character);
      
      return {
        success: true,
        response: aiResponse,
        stage: nextStage,
        shouldHangUp,
        evaluation
      };
      
    } catch (error) {
      logger.error('❌ Error generating AI response:', error);
      return {
        success: false,
        error: error.message,
        response: "I'm sorry, could you repeat that?",
        stage: conversationStageRef.current,
        shouldHangUp: false
      };
    }
  }, [conversationHistory]);

  // Response generators for different stages
  const generateOpenerResponse = (userInput, character) => {
    const responses = [
      `Okay, ${userInput.includes('name') ? 'and what company are you with?' : 'who is this?'}`,
      "I'm busy right now. What's this regarding?",
      "How did you get my direct number?",
      "I don't take unsolicited calls. What do you want?"
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const generateObjection = (userInput, character) => {
    const objections = [
      "We're not looking for anything right now.",
      "I'm not interested. Please remove me from your list.",
      "We already have a solution for that.",
      "Can you just send me an email instead?",
      "I don't have time for this right now."
    ];
    return objections[Math.floor(Math.random() * objections.length)];
  };

  const generatePitchResponse = (userInput, character) => {
    const responses = [
      "That sounds like what everyone else is selling. How are you different?",
      "What kind of results are we talking about? Do you have case studies?",
      "How much does this cost? I need to see ROI.",
      "This sounds too good to be true. What's the catch?",
      "I need to discuss this with my team first."
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const generateClosingResponse = (userInput, character) => {
    const responses = [
      "I'll need to think about it. Send me some information.",
      "What's the next step if we decide to move forward?",
      "I'm interested, but I need approval from my boss.",
      "Can we schedule a proper meeting to discuss this?",
      "Alright, you've got my attention. Tell me more."
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const generateEndingResponse = (userInput, character) => {
    const responses = [
      "Okay, thanks for calling. I'll consider it.",
      "I have to go now. We'll be in touch.",
      "Send me that information and we'll see.",
      "I'll discuss this with my team and get back to you.",
      "Thanks for your time. Have a good day."
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const addPersonalityToResponse = (response, character) => {
    // Add occasional personality quirks
    if (character.personality.includes('busy') && Math.random() < 0.3) {
      response = "Look, I'm really busy. " + response;
    }
    if (character.personality.includes('skeptical') && Math.random() < 0.2) {
      response = response + " I've heard this pitch before.";
    }
    return response;
  };

  // Simple evaluation system
  const evaluateOpener = (userInput) => {
    const hasName = /name.*is|i'm|this is/i.test(userInput);
    const hasCompany = /company|from/i.test(userInput);
    const hasReason = /reason|call|help|about/i.test(userInput);
    const isPolite = /please|thank|sorry|excuse/i.test(userInput);
    
    const score = (hasName ? 1 : 0) + (hasCompany ? 1 : 0) + (hasReason ? 1 : 0) + (isPolite ? 1 : 0);
    
    return {
      passed: score >= 2,
      score: score,
      maxScore: 4,
      feedback: score >= 3 ? "Great opener!" : score >= 2 ? "Good opener, could be stronger" : "Opener needs work"
    };
  };

  const evaluateResponse = (userInput, stage) => {
    const wordCount = userInput.split(' ').length;
    const hasValue = /save|improve|increase|reduce|help|benefit/i.test(userInput);
    const isConfident = userInput.length > 10 && !userInput.includes('um') && !userInput.includes('uh');
    
    const score = (wordCount > 5 ? 1 : 0) + (hasValue ? 2 : 0) + (isConfident ? 1 : 0);
    
    return {
      passed: score >= 2,
      score: score,
      maxScore: 4,
      feedback: score >= 3 ? "Excellent response!" : score >= 2 ? "Good response" : "Response could be stronger"
    };
  };

  // Start roleplay session
  const startRoleplaySession = useCallback(async (roleplayType, mode, metadata = {}) => {
    try {
      logger.log('🎬 Starting roleplay session:', { roleplayType, mode, metadata });
      
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
        
        // FIXED: Start voice conversation using the correct API
        voiceService.startConversation(
          handleUserSpeech,
          handleVoiceError
        );
        
        // Speak the greeting
        await voiceService.speakText(greeting);
        
      }, 2000); // Simulate dialing time
      
      return session;
      
    } catch (error) {
      logger.error('❌ Error starting roleplay session:', error);
      throw error;
    }
  }, [userProfile, getCharacterForRoleplay]);

  // Handle user speech input
  const handleUserSpeech = useCallback(async (transcript, confidence) => {
    if (!sessionRef.current || callState !== 'connected' || isProcessing) {
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
        
        // Fallback response
        const fallbackResponse = "I'm sorry, could you repeat that?";
        await voiceService.speakText(fallbackResponse);
        setCurrentMessage(fallbackResponse);
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

  // End session
  const endSession = useCallback(async (reason = 'completed') => {
    if (!sessionRef.current) {
      return null;
    }

    try {
      logger.log('🏁 Ending session:', reason);
      
      // FIXED: Stop voice service using correct API
      voiceService.stopConversation();
      
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
          // Continue anyway - the session still works without database logging
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
    
    // FIXED: Stop voice service using correct API
    voiceService.stopConversation();
    
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