import React, { useCallback } from 'react';
import { useSpeechRecognition } from 'react-speech-recognition';
import { useSpeechSynthesis } from 'react-speech-synthesis';
import { useLogger } from '../contexts/LoggerContext';

const FunctionalPhoneInterface = () => {
  const logger = useLogger();
  const { startListening, stopListening } = useSpeechRecognition();
  const { speak } = useSpeechSynthesis();
  const [messages, setMessages] = React.useState([]);
  const [error, setError] = React.useState(null);

  const handleSpeechResult = useCallback((transcript, confidence) => {
    if (!transcript) return;
    
    logger.log('🎯 Speech result received:', { transcript, confidence });
    
    // Add user message to chat
    setMessages(prev => [...prev, {
      role: 'user',
      content: transcript,
      timestamp: new Date().toISOString()
    }]);

    // Process with OpenAI
    processUserInput(transcript);
  }, [processUserInput]);

  const handleInterimResult = useCallback((transcript) => {
    if (!transcript) return;
    
    logger.log('🎯 Interim speech result:', transcript);
    
    // Update the last user message if it exists and is interim
    setMessages(prev => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage && lastMessage.role === 'user' && lastMessage.isInterim) {
        return [...prev.slice(0, -1), { ...lastMessage, content: transcript }];
      }
      return [...prev, {
        role: 'user',
        content: transcript,
        isInterim: true,
        timestamp: new Date().toISOString()
      }];
    });
  }, []);

  const startContinuousListening = useCallback(async () => {
    try {
      logger.log('🎤 Starting continuous listening...');
      await startListening({
        onResult: handleSpeechResult,
        onInterim: handleInterimResult,
        onError: (error) => {
          logger.error('❌ Speech recognition error:', error);
          setError(error);
        }
      });
    } catch (error) {
      logger.error('❌ Failed to start continuous listening:', error);
      setError(error.message);
    }
  }, [startListening, handleSpeechResult, handleInterimResult]);

  const initializeRoleplay = useCallback(async () => {
    try {
      logger.log('🎭 Initializing roleplay session...');
      
      // Initialize voice service
      const voiceAvailable = await checkVoiceServiceAvailability();
      if (!voiceAvailable) {
        throw new Error('Voice service not available');
      }

      // Start with AI greeting
      const greeting = "Hello! I'm your cold calling coach. How can I help you practice today?";
      setMessages([{
        role: 'assistant',
        content: greeting,
        timestamp: new Date().toISOString()
      }]);

      // Speak the greeting
      await speak(greeting);

      // Start continuous listening after a short delay
      setTimeout(() => {
        startContinuousListening();
      }, 1000);

    } catch (error) {
      logger.error('❌ Failed to initialize roleplay:', error);
      setError(error.message);
    }
  }, [checkVoiceServiceAvailability, speak, startContinuousListening]);

  return (
    <div>
      {/* Render your component content here */}
    </div>
  );
};

export default FunctionalPhoneInterface; 