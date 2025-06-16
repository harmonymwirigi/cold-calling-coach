// src/hooks/useVoice.js - SIMPLIFIED & RELIABLE
import { useState, useRef, useCallback, useEffect } from 'react';
import { voiceService } from '../services/voiceService';
import logger from '../utils/logger';

export const useVoice = () => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);
  
  const initializationAttempted = useRef(false);
  const stateUpdateInterval = useRef(null);

  // Initialize voice service on first use
  const initializeVoiceService = useCallback(async () => {
    if (initializationAttempted.current) {
      return isInitialized;
    }

    try {
      initializationAttempted.current = true;
      setError(null);
      
      logger.log('🎤 Initializing voice service...');
      
      await voiceService.initialize();
      setIsInitialized(true);
      
      logger.log('✅ Voice service initialized successfully');
      return true;

    } catch (error) {
      logger.error('❌ Voice service initialization failed:', error);
      setError(error.message);
      setIsInitialized(false);
      return false;
    }
  }, [isInitialized]);

  // Update states from voice service
  const updateStates = useCallback(() => {
    try {
      const state = voiceService.getState();
      setIsListening(state.isListening);
      setIsSpeaking(state.isSpeaking);
      setIsInitialized(state.isInitialized);
    } catch (error) {
      logger.warn('Error updating voice states:', error);
    }
  }, []);

  // Start state monitoring when voice service is available
  useEffect(() => {
    if (isInitialized) {
      stateUpdateInterval.current = setInterval(updateStates, 1000);
      
      return () => {
        if (stateUpdateInterval.current) {
          clearInterval(stateUpdateInterval.current);
        }
      };
    }
  }, [isInitialized, updateStates]);

  // Auto-initialize on mount
  useEffect(() => {
    if (!initializationAttempted.current) {
      initializeVoiceService();
    }
  }, [initializeVoiceService]);

  // Start listening
  const startListening = useCallback(async (options = {}) => {
    try {
      setError(null);

      // Initialize if needed
      const initialized = await initializeVoiceService();
      if (!initialized) {
        throw new Error('Voice service not available');
      }

      // Check if already listening
      if (isListening) {
        logger.log('Already listening');
        return true;
      }

      // Start listening
      const success = voiceService.startListening();
      if (success) {
        setIsListening(true);
        logger.log('✅ Started listening');
        return true;
      } else {
        throw new Error('Failed to start listening');
      }

    } catch (error) {
      logger.error('❌ Error starting listening:', error);
      setError(error.message);
      return false;
    }
  }, [initializeVoiceService, isListening]);

  // Stop listening
  const stopListening = useCallback(() => {
    try {
      setError(null);
      
      const success = voiceService.stopListening();
      if (success) {
        setIsListening(false);
        logger.log('✅ Stopped listening');
      }
      
      return success;
    } catch (error) {
      logger.error('❌ Error stopping listening:', error);
      setError(error.message);
      return false;
    }
  }, []);

  // Speak text
  const speakText = useCallback(async (text, options = {}) => {
    try {
      setError(null);

      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('Invalid text for speech');
      }

      // Initialize if needed
      const initialized = await initializeVoiceService();
      if (!initialized) {
        throw new Error('Voice service not available');
      }

      // Set speaking state
      setIsSpeaking(true);

      // Speak the text
      await voiceService.speakText(text);
      
      logger.log('✅ Speech completed');
      return true;

    } catch (error) {
      logger.error('❌ Error speaking text:', error);
      setError(error.message);
      throw error;
    } finally {
      setIsSpeaking(false);
    }
  }, [initializeVoiceService]);

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    try {
      setError(null);
      
      const success = voiceService.stopSpeaking();
      if (success) {
        setIsSpeaking(false);
        logger.log('✅ Stopped speaking');
      }
      
      return success;
    } catch (error) {
      logger.error('❌ Error stopping speech:', error);
      setError(error.message);
      return false;
    }
  }, []);

  // Start conversation with callbacks
  const startConversation = useCallback(async (onUserSpeech, onError) => {
    try {
      setError(null);

      // Initialize if needed
      const initialized = await initializeVoiceService();
      if (!initialized) {
        throw new Error('Voice service not available');
      }

      // Start conversation flow
      const success = voiceService.startConversation(onUserSpeech, onError);
      
      if (success) {
        logger.log('✅ Conversation started');
        return true;
      } else {
        throw new Error('Failed to start conversation');
      }

    } catch (error) {
      logger.error('❌ Error starting conversation:', error);
      setError(error.message);
      if (onError) onError(error.message);
      return false;
    }
  }, [initializeVoiceService]);

  // Stop conversation
  const stopConversation = useCallback(() => {
    try {
      setError(null);
      
      const success = voiceService.stopConversation();
      if (success) {
        setIsListening(false);
        setIsSpeaking(false);
        logger.log('✅ Conversation stopped');
      }
      
      return success;
    } catch (error) {
      logger.error('❌ Error stopping conversation:', error);
      setError(error.message);
      return false;
    }
  }, []);

  // Get current voice state
  const getVoiceState = useCallback(() => {
    try {
      return voiceService.getState();
    } catch (error) {
      logger.warn('Error getting voice state:', error);
      return {
        isListening: false,
        isSpeaking: false,
        isInitialized: false,
        conversationActive: false
      };
    }
  }, []);

  // Cleanup
  const cleanup = useCallback(() => {
    try {
      stopConversation();
      
      if (stateUpdateInterval.current) {
        clearInterval(stateUpdateInterval.current);
        stateUpdateInterval.current = null;
      }
      
      voiceService.cleanup();
      
      setIsListening(false);
      setIsSpeaking(false);
      setIsInitialized(false);
      setError(null);
      initializationAttempted.current = false;
      
      logger.log('✅ Voice hook cleaned up');
    } catch (error) {
      logger.error('❌ Error in voice hook cleanup:', error);
    }
  }, [stopConversation]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    // State
    isListening,
    isSpeaking,
    isInitialized,
    error,
    
    // Basic actions
    startListening,
    stopListening,
    speakText,
    stopSpeaking,
    
    // Conversation actions
    startConversation,
    stopConversation,
    
    // Utilities
    initializeVoiceService,
    getVoiceState,
    cleanup,
    
    // Direct access to voice service for advanced usage
    voiceService
  };
};