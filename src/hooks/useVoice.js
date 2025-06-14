// React hook for voice functionality
import { useState, useEffect, useCallback } from 'react';
import { voiceService } from '../services/voiceService';
import logger from '../utils/logger';

export const useVoice = () => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize voice service on mount
  useEffect(() => {
    const initializeVoice = async () => {
      try {
        await voiceService.initialize();
        setIsInitialized(true);
      } catch (error) {
        logger.error('Voice service initialization failed:', error);
        setError(error.message);
      }
    };

    initializeVoice();

    // Update state based on voice service state
    const updateState = () => {
      const state = voiceService.getState();
      setIsListening(state.isListening);
      setIsSpeaking(state.isSpeaking);
    };

    const interval = setInterval(updateState, 500);
    
    return () => {
      clearInterval(interval);
      voiceService.cleanup();
    };
  }, []);

  const startListening = useCallback(async (options = {}) => {
    try {
      setError(null);
      const result = await voiceService.startListening(options);
      return result;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  }, []);

  const stopListening = useCallback(() => {
    voiceService.stopListening();
  }, []);

  const speakText = useCallback(async (text, options = {}) => {
    try {
      setError(null);
      const result = await voiceService.speakText(text, options);
      return result;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    voiceService.stopCurrentAudio();
  }, []);

  return {
    isListening,
    isSpeaking,
    isInitialized,
    error,
    startListening,
    stopListening,
    speakText,
    stopSpeaking,
    voiceService
  };
};