// src/hooks/useVoice.js - FIXED VERSION
import { useState, useRef, useCallback, useEffect } from 'react';
import { voiceService } from '../services/voiceService';
import logger from '../utils/logger';

export const useVoice = () => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);
  const [initializationAttempted, setInitializationAttempted] = useState(false);
  
  const recognitionRef = useRef(null);
  const initializationRef = useRef(false);
  const initTimeoutRef = useRef(null);

  // Initialize voice service safely with shorter timeout
  const initializeVoiceService = useCallback(async () => {
    if (initializationRef.current) {
      logger.log('🎤 Voice service initialization already attempted');
      return isInitialized;
    }

    try {
      setError(null);
      setInitializationAttempted(true);
      
      // Check if voice service exists
      if (!voiceService) {
        throw new Error('Voice service not available');
      }

      // Check if already initialized
      if (voiceService.isInitialized) {
        setIsInitialized(true);
        initializationRef.current = true;
        logger.log('✅ Voice service was already initialized');
        return true;
      }

      // Set a shorter timeout to prevent infinite initialization
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }

      logger.log('🎤 Starting voice service initialization...');

      // Create initialization promise with timeout
      const initPromise = voiceService.initialize();
      const timeoutPromise = new Promise((_, reject) => {
        initTimeoutRef.current = setTimeout(() => {
          reject(new Error('Voice service initialization timed out after 5 seconds'));
        }, 5000); // Reduced to 5 seconds
      });

      // Race between initialization and timeout
      await Promise.race([initPromise, timeoutPromise]);
      
      // Clear timeout if initialization succeeded
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }

      setIsInitialized(true);
      initializationRef.current = true;
      logger.log('✅ Voice service initialized successfully via hook');
      return true;

    } catch (error) {
      logger.error('❌ Voice service initialization failed in hook:', error);
      
      // Clear timeout
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }

      // Set error but don't prevent app from working
      setError(error.message);
      setIsInitialized(false);
      initializationRef.current = true; // Mark as attempted to prevent retries
      
      // Don't throw - let the app continue with degraded functionality
      logger.warn('⚠️ Continuing without voice service - functionality will be limited');
      return false;
    }
  }, [isInitialized]);

  // Check voice service state on mount
  useEffect(() => {
    const checkVoiceService = async () => {
      try {
        if (voiceService && voiceService.isInitialized) {
          setIsInitialized(true);
          initializationRef.current = true;
          logger.log('✅ Voice service was already initialized on mount');
        } else {
          // Auto-initialize on mount
          logger.log('🎤 Auto-initializing voice service on mount...');
          await initializeVoiceService();
        }
      } catch (error) {
        logger.warn('Voice service state check failed:', error);
        setError(error.message);
      }
    };

    checkVoiceService();
  }, [initializeVoiceService]);

  const startListening = useCallback(async (options = {}) => {
    try {
      setError(null);

      // Check browser compatibility first
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        const errorMsg = 'Speech recognition not supported in this browser';
        setError(errorMsg);
        if (options.onError) options.onError(errorMsg);
        return null;
      }

      // Initialize voice service if needed
      const initialized = await initializeVoiceService();
      if (!initialized) {
        logger.warn('⚠️ Voice service not available - using fallback');
        // Continue with browser fallback instead of failing
      }

      // Use voice service if available and working
      if (initialized && voiceService && typeof voiceService.startListening === 'function') {
        try {
          const result = await voiceService.startListening({
            continuous: true,
            onResult: options.onResult,
            onInterim: options.onInterim,
            onError: options.onError
          });
          setIsListening(true);
          return result;
        } catch (voiceError) {
          logger.warn('Voice service listening failed, falling back to browser API:', voiceError);
          // Fall through to browser API fallback
        }
      }

      // Fallback to direct browser speech recognition
      return await startBrowserListening(options);

    } catch (error) {
      setIsListening(false);
      logger.error('❌ Error in startListening:', error);
      const errorMsg = error.message || 'Failed to start listening';
      setError(errorMsg);
      if (options.onError) {
        options.onError(errorMsg);
      }
      return null;
    }
  }, [initializeVoiceService]);

  // Browser fallback listening method
  const startBrowserListening = useCallback(async (options = {}) => {
    logger.log('🎤 Using browser fallback for speech recognition');
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    return new Promise((resolve, reject) => {
      recognition.onstart = () => {
        setIsListening(true);
        logger.log('🎤 Browser speech recognition started (fallback)');
      };

      recognition.onend = () => {
        logger.log('🔚 Browser speech recognition ended (fallback)');
        
        // Restart if continuous mode is enabled
        if (recognition.continuous && !isListening) {
          try {
            recognition.start();
          } catch (error) {
            logger.warn('Could not restart browser recognition:', error);
          }
        } else {
          setIsListening(false);
        }
      };

      recognition.onresult = (event) => {
        const result = event.results[event.results.length - 1];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence;
        
        logger.log('📝 Speech recognized (fallback):', { 
          transcript, 
          confidence,
          isFinal: result.isFinal 
        });
        
        if (result.isFinal) {
          if (options.onResult) {
            options.onResult(transcript, confidence);
          }
        } else if (options.onInterim) {
          options.onInterim(transcript);
        }
      };

      recognition.onerror = (event) => {
        logger.error('❌ Speech recognition error (fallback):', event.error);
        const errorMsg = `Speech recognition error: ${event.error}`;
        setError(errorMsg);
        if (options.onError) {
          options.onError(errorMsg);
        }
        reject(new Error(errorMsg));
      };

      recognitionRef.current = recognition;
      
      try {
        recognition.start();
      } catch (startError) {
        setIsListening(false);
        reject(startError);
      }
    });
  }, [isListening]);

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

  const speakText = useCallback(async (text, options = {}) => {
    try {
      setError(null);

      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('Invalid text provided for speech');
      }

      // Initialize voice service if needed
      const initialized = await initializeVoiceService();
      
      setIsSpeaking(true);

      // Use voice service if available
      if (initialized && voiceService && typeof voiceService.speakText === 'function') {
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
      return await this.speakWithBrowser(text, options);

    } catch (error) {
      logger.error('❌ Speech error:', error);
      setError(error.message);
      throw error;
    } finally {
      setIsSpeaking(false);
    }
  }, [initializeVoiceService]);

  // Browser synthesis fallback
  const speakWithBrowser = useCallback(async (text, options = {}) => {
    if (!('speechSynthesis' in window)) {
      throw new Error('Speech synthesis not supported');
    }

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = options.rate || 0.9;
      utterance.pitch = options.pitch || 1.0;
      utterance.volume = options.volume || 0.8;
      utterance.lang = 'en-US';

      // Set up timeout
      const timeout = setTimeout(() => {
        window.speechSynthesis.cancel();
        reject(new Error('Browser speech synthesis timed out'));
      }, 30000);

      utterance.onend = () => {
        clearTimeout(timeout);
        logger.log('✅ Browser synthesis completed (fallback)');
        resolve({ success: true, synthesisType: 'browser-fallback' });
      };

      utterance.onerror = (event) => {
        clearTimeout(timeout);
        logger.error('❌ Browser synthesis error (fallback):', event.error);
        reject(new Error(`Browser speech synthesis error: ${event.error}`));
      };

      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const stopSpeaking = useCallback(() => {
    try {
      setError(null);
      setIsSpeaking(false);

      // Stop voice service speaking if available
      if (voiceService && typeof voiceService.stopSpeaking === 'function') {
        voiceService.stopSpeaking();
      }

      // Stop browser synthesis if available
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }

      logger.log('🔇 Speaking stopped');
    } catch (error) {
      logger.error('Error stopping speech:', error);
      setError(error.message);
    }
  }, []);

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
      stopSpeaking();
      
      if (voiceService && typeof voiceService.cleanup === 'function') {
        voiceService.cleanup();
      }
      
      setIsInitialized(false);
      setError(null);
      initializationRef.current = false;
      setInitializationAttempted(false);
      
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
      
      logger.log('🧹 Voice hook cleaned up');
    } catch (error) {
      logger.error('Error in voice hook cleanup:', error);
    }
  }, [stopListening, stopSpeaking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          logger.warn('Error stopping recognition on unmount:', error);
        }
      }
      logger.log('🧹 Voice hook cleaned up on unmount');
    };
  }, []);

  return {
    // State
    isListening,
    isSpeaking,
    isInitialized,
    error,
    initializationAttempted,
    
    // Actions
    startListening,
    stopListening,
    speakText, // Changed from 'speak' to match the component usage
    stopSpeaking,
    
    // Utilities
    initializeVoiceService,
    getVoiceState,
    cleanup,
    
    // Direct reference to voice service for advanced usage
    voiceService
  };
};