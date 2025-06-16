// src/contexts/RoleplayContext.jsx - ULTRA-SIMPLE DEBUG VERSION
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
  const exchangeCountRef = useRef(0);

  // Character templates
  const getCharacterForRoleplay = useCallback((roleplayType) => {
    const characters = {
      opener_practice: {
        name: 'Sarah Mitchell',
        title: 'VP of Marketing',
        company: 'TechCorp Solutions',
        greeting: 'Hello, Sarah speaking.'
      },
      pitch_practice: {
        name: 'Michael Chen',
        title: 'CTO',
        company: 'InnovateX',
        greeting: 'Hi, this is Michael. You have 2 minutes - what\'s this about?'
      }
    };
    
    return characters[roleplayType] || characters.opener_practice;
  }, []);

  // ULTRA-SIMPLE: AI responses with heavy debugging
  const generateSimpleAIResponse = useCallback((userInput, exchangeCount) => {
    console.log('🤖 [DEBUG] generateSimpleAIResponse called with:', { userInput, exchangeCount });
    
    const responses = [
      "Who is this?",
      "What's this about?", 
      "I'm not interested.",
      "We don't take cold calls.",
      "How much does this cost?",
      "I have to go now."
    ];
    
    const selectedResponse = responses[exchangeCount % responses.length];
    const shouldHangUp = exchangeCount >= 4;
    
    console.log('🤖 [DEBUG] Selected response:', selectedResponse, 'shouldHangUp:', shouldHangUp);
    
    return {
      success: true,
      response: selectedResponse,
      shouldHangUp,
      evaluation: { passed: true, feedback: 'Good!' }
    };
  }, []);

  // Start roleplay session
  const startRoleplaySession = useCallback(async (roleplayType, mode, metadata = {}) => {
    try {
      console.log('🎬 [DEBUG] Starting roleplay session:', { roleplayType, mode });
      
      // Reset all flags
      isEndingSessionRef.current = false;
      exchangeCountRef.current = 0;
      
      // Initialize voice service
      await voiceService.initialize();
      console.log('✅ [DEBUG] Voice service initialized');
      
      // Create session
      const character = getCharacterForRoleplay(roleplayType);
      const session = {
        id: `session-${Date.now()}`,
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
      console.log('✅ [DEBUG] Session state reset');
      
      // Start the conversation flow after delay
      setTimeout(async () => {
        if (isEndingSessionRef.current) {
          console.log('⚠️ [DEBUG] Session ended during startup');
          return;
        }
        
        console.log('🔄 [DEBUG] Setting call state to connected');
        setCallState('connected');
        
        // AI greeting
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
        
        // Start voice conversation with debugging
        console.log('🎤 [DEBUG] Starting voice conversation...');
        const success = voiceService.startConversation(
          handleUserSpeech,
          handleVoiceError
        );
        console.log('🎤 [DEBUG] Voice conversation started:', success);
        
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
  }, [userProfile, getCharacterForRoleplay]);

  // ULTRA-SIMPLE: User speech handling with extensive debugging
  const handleUserSpeech = useCallback(async (transcript, confidence) => {
    console.log('🗣️ [DEBUG] ====== handleUserSpeech CALLED ======');
    console.log('🗣️ [DEBUG] Transcript:', transcript);
    console.log('🗣️ [DEBUG] Confidence:', confidence);
    console.log('🗣️ [DEBUG] Current state:', {
      hasSession: !!sessionRef.current,
      callState,
      isEnding: isEndingSessionRef.current,
      isProcessing
    });

    // Check if session is valid
    if (!sessionRef.current) {
      console.log('⚠️ [DEBUG] No session, ignoring speech');
      return;
    }

    if (callState !== 'connected') {
      console.log('⚠️ [DEBUG] Call not connected, ignoring speech. State:', callState);
      return;
    }

    if (isEndingSessionRef.current) {
      console.log('⚠️ [DEBUG] Session ending, ignoring speech');
      return;
    }

    // Check if already processing
    if (isProcessing) {
      console.log('⚠️ [DEBUG] Already processing, ignoring speech');
      return;
    }

    try {
      console.log('🔄 [DEBUG] Setting isProcessing to TRUE');
      setIsProcessing(true);

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

      console.log('🤖 [DEBUG] About to generate AI response...');
      
      // Generate AI response with debugging
      const aiResult = generateSimpleAIResponse(transcript, exchangeCountRef.current);
      
      console.log('🤖 [DEBUG] AI result received:', aiResult);

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
        console.error('❌ [DEBUG] AI response failed or invalid:', aiResult);
        
        // Emergency fallback
        const fallbackResponse = "Could you repeat that?";
        setCurrentMessage(fallbackResponse);
        
        try {
          await voiceService.speakText(fallbackResponse);
          console.log('✅ [DEBUG] Fallback response spoken');
        } catch (speakError) {
          console.error('❌ [DEBUG] Failed to speak fallback:', speakError);
        }
      }

    } catch (error) {
      console.error('❌ [DEBUG] Error in handleUserSpeech:', error);
      
      // Emergency recovery
      const errorResponse = "Sorry, I had trouble understanding.";
      setCurrentMessage(errorResponse);
      try {
        await voiceService.speakText(errorResponse);
      } catch (recoveryError) {
        console.error('❌ [DEBUG] Recovery failed:', recoveryError);
      }
    } finally {
      console.log('🔄 [DEBUG] Setting isProcessing to FALSE');
      setIsProcessing(false);
      console.log('🗣️ [DEBUG] ====== handleUserSpeech COMPLETED ======');
    }
  }, [callState, isProcessing, generateSimpleAIResponse]);

  // Handle voice errors
  const handleVoiceError = useCallback((error) => {
    console.error('🎤 [DEBUG] Voice error:', error);
  }, []);

  // End session
  const endSession = useCallback(async (reason = 'completed') => {
    if (!sessionRef.current || isEndingSessionRef.current) {
      console.log('⚠️ [DEBUG] Session already ending or no session');
      return null;
    }

    try {
      console.log('🏁 [DEBUG] Ending session:', reason);
      
      // Set ending flag immediately
      isEndingSessionRef.current = true;
      
      // Stop all voice activities
      voiceService.stopConversation();
      voiceService.stopSpeaking();
      voiceService.stopListening();
      console.log('🔇 [DEBUG] Voice service stopped');
      
      const endTime = Date.now();
      const duration = Math.floor((endTime - startTimeRef.current) / 1000);
      
      // Calculate results
      const overallPassed = exchangeCountRef.current >= 2;
      
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
          totalStages: 0,
          passedStages: 0,
          passRate: 0,
          averageScore: 0
        }
      };
      
      setCallState('ended');
      setSessionResults(results);
      console.log('✅ [DEBUG] Session ended with results:', results);
      
      return results;
      
    } catch (error) {
      console.error('❌ [DEBUG] Error ending session:', error);
      return null;
    }
  }, [conversationHistory]);

  // Reset session
  const resetSession = useCallback(() => {
    console.log('🔄 [DEBUG] Resetting session');
    
    isEndingSessionRef.current = true;
    
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
    
    console.log('✅ [DEBUG] Session reset complete');
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