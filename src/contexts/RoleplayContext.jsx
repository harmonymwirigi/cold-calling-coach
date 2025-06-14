// src/contexts/RoleplayContext.jsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import { openAIService } from '../services/openaiService';
import { voiceService } from '../services/voiceService';
import { useAuth } from './AuthContext';

const RoleplayContext = createContext();

export const useRoleplay = () => {
  const context = useContext(RoleplayContext);
  if (!context) {
    throw new Error('useRoleplay must be used within a RoleplayProvider');
  }
  return context;
};

export const RoleplayProvider = ({ children }) => {
  const { userProfile } = useAuth();
  const [currentSession, setCurrentSession] = useState(null);
  const [callState, setCallState] = useState('idle'); // idle, dialing, connected, ended
  const [sessionResults, setSessionResults] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Initialize voice service with callbacks
  React.useEffect(() => {
    voiceService.setSilenceCallbacks(
      (silenceSeconds) => handleSilenceWarning(silenceSeconds),
      (reason) => handleSilenceTimeout(reason)
    );
  }, []);

  const startRoleplaySession = useCallback(async (roleplayType, mode, options = {}) => {
    try {
      console.log('🚀 Starting roleplay session:', { roleplayType, mode, options });
      
      // Reset services
      openAIService.resetConversation();
      voiceService.cleanup();

      // Create session data
      const sessionData = {
        id: Date.now().toString(),
        roleplayType,
        mode,
        character: options.character,
        startTime: new Date().toISOString(),
        callsAttempted: 0,
        callsPassed: 0,
        currentStage: 'greeting',
        conversationHistory: [],
        evaluations: [],
        usedObjections: new Set(),
        ...options
      };

      setCurrentSession(sessionData);
      setCallState('dialing');

      // Simulate dialing delay then connect
      setTimeout(async () => {
        setCallState('connected');
        
        // Start with prospect greeting - need to speak directly since session just started
        const greeting = "Hello?";
        console.log('🎭 AI will now speak the greeting:', greeting);
        
        try {
          // Speak the greeting directly
          console.log('🔊 Attempting to speak greeting...');
          await voiceService.speakText(greeting, {
            voiceId: 'Joanna',
            rate: 0.9,
            pitch: 1.0
          });
          console.log('✅ Greeting spoken successfully');
        } catch (error) {
          console.error('❌ Error speaking greeting:', error);
        }
        
        console.log('✅ Roleplay session started successfully');
      }, 2000);

      return sessionData;
    } catch (error) {
      console.error('❌ Error starting roleplay session:', error);
      throw error;
    }
  }, [userProfile]);

  const handleUserResponse = useCallback(async (userInput) => {
    if (!currentSession || callState !== 'connected' || isProcessing) {
      return { success: false, error: 'Session not ready' };
    }

    try {
      setIsProcessing(true);
      console.log('📝 Processing user input:', userInput);

      // Build context for AI
      const context = {
        roleplayType: currentSession.roleplayType,
        mode: currentSession.mode,
        prospectJobTitle: userProfile?.prospect_job_title || 'CEO',
        prospectIndustry: userProfile?.prospect_industry || 'Technology',
        customBehaviorNotes: userProfile?.custom_behavior_notes || 'Professional but busy',
        currentStage: currentSession.currentStage,
        usedObjections: Array.from(currentSession.usedObjections)
      };

      // Get AI response using OpenAI service
      const aiResult = await openAIService.getProspectResponse(
        userInput,
        context,
        currentSession.currentStage
      );

      if (!aiResult.success) {
        console.error('❌ OpenAI service error:', aiResult.error);
        return { success: false, error: aiResult.error };
      }

      // Update session with conversation history
      const updatedSession = {
        ...currentSession,
        currentStage: aiResult.nextStage,
        conversationHistory: [
          ...currentSession.conversationHistory,
          { speaker: 'user', content: userInput, timestamp: new Date().toISOString() },
          { speaker: 'ai', content: aiResult.response, timestamp: new Date().toISOString() }
        ],
        evaluations: [...currentSession.evaluations, aiResult.evaluation]
      };

      // Track used objections
      if (aiResult.objectionUsed) {
        updatedSession.usedObjections.add(aiResult.objectionUsed);
      }

      setCurrentSession(updatedSession);

      console.log('✅ AI response generated:', aiResult.response);
      return aiResult;

    } catch (error) {
      console.error('❌ Error processing user response:', error);
      return { success: false, error: error.message };
    } finally {
      setIsProcessing(false);
    }
  }, [currentSession, callState, isProcessing, userProfile]);

  const handleProspectResponse = useCallback(async (response, stage) => {
    if (!currentSession) return;

    try {
      console.log('🎭 Prospect speaking:', response);
      
      // Speak the prospect's response
      console.log('🔊 Attempting to speak with voice service...');
      const speechResult = await voiceService.speakText(response, {
        voiceId: 'Joanna', // Female US voice
        rate: 0.9,
        pitch: 1.0
      });
      
      console.log('✅ Speech result:', speechResult);

      // Update session with prospect response
      const updatedSession = {
        ...currentSession,
        conversationHistory: [
          ...currentSession.conversationHistory,
          { speaker: 'prospect', content: response, timestamp: new Date().toISOString() }
        ]
      };

      setCurrentSession(updatedSession);

    } catch (error) {
      console.error('❌ Error handling prospect response:', error);
      
      // Try a fallback approach - just update the session without speech
      const updatedSession = {
        ...currentSession,
        conversationHistory: [
          ...currentSession.conversationHistory,
          { speaker: 'prospect', content: response, timestamp: new Date().toISOString() }
        ]
      };
      setCurrentSession(updatedSession);
    }
  }, [currentSession]);

  const handleSilenceWarning = useCallback(async (silenceSeconds) => {
    if (!currentSession || callState !== 'connected') return;

    try {
      console.log('⚠️ Silence warning:', silenceSeconds, 'seconds');
      
      const impatiencePhrase = openAIService.getImpatiencePhrase();
      await handleProspectResponse(impatiencePhrase, 'silence_warning');
      
    } catch (error) {
      console.error('❌ Error handling silence warning:', error);
    }
  }, [currentSession, callState, handleProspectResponse]);

  const handleSilenceTimeout = useCallback(async (reason) => {
    if (!currentSession || callState !== 'connected') return;

    try {
      console.log('⏰ Silence timeout:', reason);
      
      const hangupMessage = "I have to go.";
      await handleProspectResponse(hangupMessage, 'hang_up');
      
      // End the call
      setTimeout(() => {
        endSession('silence_timeout');
      }, 1000);
      
    } catch (error) {
      console.error('❌ Error handling silence timeout:', error);
    }
  }, [currentSession, callState, handleProspectResponse]);

  const endSession = useCallback(async (reason = 'completed') => {
    if (!currentSession) return null;

    try {
      console.log('🏁 Ending session:', reason);
      
      setCallState('ended');
      
      // Calculate session results
      const evaluations = currentSession.evaluations.filter(e => e);
      const passedEvaluations = evaluations.filter(e => e.passed);
      const averageScore = evaluations.length > 0 
        ? evaluations.reduce((sum, e) => sum + (e.overall_score || 0), 0) / evaluations.length 
        : 0;

      const sessionResult = {
        sessionId: currentSession.id,
        roleplayType: currentSession.roleplayType,
        mode: currentSession.mode,
        duration: Math.floor((new Date() - new Date(currentSession.startTime)) / 1000),
        reason,
        passed: passedEvaluations.length > 0 && reason !== 'silence_timeout',
        evaluations: evaluations,
        averageScore: averageScore,
        conversationHistory: currentSession.conversationHistory,
        endTime: new Date().toISOString()
      };

      // Generate coaching feedback
      if (evaluations.length > 0) {
        sessionResult.coaching = await openAIService.generateCoachingFeedback({
          roleplayType: currentSession.roleplayType,
          callsAttempted: 1,
          callsPassed: sessionResult.passed ? 1 : 0,
          averageScore: averageScore,
          commonIssues: evaluations.flatMap(e => e.issues || [])
        });
      }

      setSessionResults(sessionResult);
      console.log('✅ Session ended successfully:', sessionResult);
      
      return sessionResult;

    } catch (error) {
      console.error('❌ Error ending session:', error);
      return null;
    }
  }, [currentSession]);

  const resetSession = useCallback(() => {
    setCurrentSession(null);
    setCallState('idle');
    setSessionResults(null);
    setIsProcessing(false);
    openAIService.resetConversation();
    voiceService.cleanup();
  }, []);

  const value = {
    // State
    currentSession,
    callState,
    sessionResults,
    isProcessing,
    
    // Actions
    startRoleplaySession,
    handleUserResponse,
    endSession,
    resetSession,
    
    // Voice actions
    handleProspectResponse,
    handleSilenceWarning,
    handleSilenceTimeout
  };

  return (
    <RoleplayContext.Provider value={value}>
      {children}
    </RoleplayContext.Provider>
  );
};

export default RoleplayProvider;