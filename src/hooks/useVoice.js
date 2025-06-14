// src/hooks/useVoice.js
import { useState, useRef, useCallback, useEffect } from 'react';
import { voiceService } from '../services/voiceService';
import logger from '../utils/logger';

export const useVoice = () => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const initializationRef = useRef(false);

  // Initialize voice service safely
  const initializeVoiceService = useCallback(async () => {
    if (initializationRef.current) return true;

    try {
      setError(null);
      
      // Check if voice service exists
      if (!voiceService) {
        throw new Error('Voice service not available');
      }

      // Check if already initialized
      if (voiceService.isInitialized) {
        setIsInitialized(true);
        initializationRef.current = true;
        return true;
      }

      // Initialize if not already done
      if (typeof voiceService.initialize === 'function') {
        await voiceService.initialize();
        setIsInitialized(true);
        initializationRef.current = true;
        logger.log('✅ Voice service initialized via hook');
        return true;
      } else {
        throw new Error('Voice service initialize method not available');
      }
    } catch (error) {
      logger.error('❌ Voice service initialization failed in hook:', error);
      setError(error.message);
      setIsInitialized(false);
      return false;
    }
  }, []);

  // Check voice service state on mount
  useEffect(() => {
    const checkVoiceService = async () => {
      try {
        if (voiceService && voiceService.isInitialized) {
          setIsInitialized(true);
          initializationRef.current = true;
        }
      } catch (error) {
        logger.warn('Voice service state check failed:', error);
      }
    };

    checkVoiceService();
  }, []);

  const startListening = useCallback(async (onResult, onError) => {
    try {
      setError(null);

      // Check browser compatibility first
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        const errorMsg = 'Speech recognition not supported in this browser';
        setError(errorMsg);
        if (onError) onError(errorMsg);
        return;
      }

      // Initialize voice service if needed
      const initialized = await initializeVoiceService();
      if (!initialized) {
        const errorMsg = 'Failed to initialize voice service';
        setError(errorMsg);
        if (onError) onError(errorMsg);
        return;
      }

      // Use voice service if available, otherwise fall back to browser API
      if (voiceService && typeof voiceService.startListening === 'function') {
        try {
          const result = await voiceService.startListening();
          setIsListening(true);
          if (onResult) {
            onResult(result.transcript, result.confidence);
          }
          return;
        } catch (voiceError) {
          logger.warn('Voice service listening failed, falling back to browser API:', voiceError);
          // Fall through to browser API
        }
      }

      // Fallback to direct browser speech recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        logger.log('🎤 Browser speech recognition started (fallback)');
      };

      recognition.onend = () => {
        setIsListening(false);
        logger.log('🔚 Browser speech recognition ended (fallback)');
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const confidence = event.results[0][0].confidence;
        logger.log('📝 Speech recognized (fallback):', { transcript, confidence });
        if (onResult) {
          onResult(transcript, confidence);
        }
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        logger.error('❌ Speech recognition error (fallback):', event.error);
        const errorMsg = `Speech recognition error: ${event.error}`;
        setError(errorMsg);
        if (onError) {
          onError(errorMsg);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();

    } catch (error) {
      setIsListening(false);
      logger.error('❌ Error in startListening:', error);
      const errorMsg = error.message || 'Failed to start listening';
      setError(errorMsg);
      if (onError) {
        onError(errorMsg);
      }
    }
  }, [initializeVoiceService]);

  const stopListening = useCallback(() => {
    try {
      setError(null);

      // Stop voice service listening if available
      if (voiceService && typeof voiceService.stopListening === 'function') {
        voiceService.stopListening();
      }

      // Stop browser recognition fallback
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          logger.warn('Error stopping browser recognition:', error);
        }
        recognitionRef.current = null;
      }

      setIsListening(false);
      logger.log('🔇 Listening stopped');
    } catch (error) {
      logger.error('Error stopping listening:', error);
      setError(error.message);
    }
  }, []);

  const speak = useCallback(async (text, options = {}) => {
    try {
      setError(null);

      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('Invalid text provided for speech');
      }

      // Initialize voice service if needed
      const initialized = await initializeVoiceService();
      if (!initialized) {
        throw new Error('Voice service not available');
      }

      setIsSpeaking(true);

      // Use voice service if available
      if (voiceService && typeof voiceService.speakText === 'function') {
        try {
          const result = await voiceService.speakText(text, {
            rate: options.rate || 0.9,
            pitch: options.pitch || 1.0,
            volume: options.volume || 0.8,
            ...options
          });
          
          logger.log('✅ Voice service speech completed:', result);
          return result;
        } catch (voiceError) {
          logger.warn('Voice service speech failed, falling back to browser synthesis:', voiceError);
          // Fall through to browser synthesis
        }
      }

      // Fallback to browser speech synthesis
      if ('speechSynthesis' in window) {
        return new Promise((resolve, reject) => {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = options.rate || 0.9;
          utterance.pitch = options.pitch || 1.0;
          utterance.volume = options.volume || 0.8;
          utterance.lang = 'en-US';

          utterance.onend = () => {
            logger.log('✅ Browser synthesis completed (fallback)');
            resolve({ success: true, synthesisType: 'browser-fallback' });
          };

          utterance.onerror = (event) => {
            logger.error('❌ Browser synthesis error (fallback):', event.error);
            reject(new Error(`Browser speech synthesis error: ${event.error}`));
          };

          window.speechSynthesis.speak(utterance);
        });
      } else {
        throw new Error('Speech synthesis not supported');
      }

    } catch (error) {
      logger.error('❌ Speech error:', error);
      setError(error.message);
      throw error;
    } finally {
      setIsSpeaking(false);
    }
  }, [initializeVoiceService]);

  const getVoiceState = useCallback(() => {
    try {
      if (voiceService && typeof voiceService.getState === 'function') {
        return voiceService.getState();
      }
      
      return {
        isListening: isListening,
        isSpeaking: isSpeaking,
        isInitialized: isInitialized,
        hasAudioContext: false
      };
    } catch (error) {
      logger.warn('Error getting voice state:', error);
      return {
        isListening: false,
        isSpeaking: false,
        isInitialized: false,
        hasAudioContext: false
      };
    }
  }, [isListening, isSpeaking, isInitialized]);

  const cleanup = useCallback(() => {
    try {
      stopListening();
      
      if (voiceService && typeof voiceService.cleanup === 'function') {
        voiceService.cleanup();
      }
      
      setIsInitialized(false);
      setError(null);
      initializationRef.current = false;
      logger.log('🧹 Voice hook cleaned up');
    } catch (error) {
      logger.error('Error in voice hook cleanup:', error);
    }
  }, [stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    // State
    isListening,
    isSpeaking,
    isInitialized,
    error,
    
    // Actions
    startListening,
    stopListening,
    speak,
    
    // Utilities
    initializeVoiceService,
    getVoiceState,
    cleanup
  };
};