// src/components/roleplay/FunctionalPhoneInterface.jsx - ENHANCED VERSION
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {PhoneOff, Mic, MicOff, Volume2, VolumeX, AlertCircle, CheckCircle, Send, Phone } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRoleplay } from '../../contexts/RoleplayContext';
import { useProgress } from '../../contexts/ProgressContext';
import { useVoice } from '../../hooks/useVoice';
import logger from '../../utils/logger';

const FunctionalPhoneInterface = () => {
  const { type, mode } = useParams();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { 
    startRoleplaySession, 
    handleUserResponse, 
    endSession, 
    currentSession, 
    callState,
    sessionResults,
    isProcessing,
    resetSession
  } = useRoleplay();
  const { getRoleplayAccess, updateProgress } = useProgress();
  const { 
    isListening, 
    isSpeaking, 
    isInitialized,
    error: voiceError,
    startListening, 
    stopListening, 
    speakText,
    stopSpeaking,
    voiceService,
    getVoiceState
  } = useVoice();

  // Component state
  const [currentMessage, setCurrentMessage] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [userSpeechText, setUserSpeechText] = useState('');
  const [voiceServiceAvailable, setVoiceServiceAvailable] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isAISpeaking, setIsAISpeaking] = useState(false);

  // Refs
  const durationInterval = useRef(null);
  const componentInitAttempted = useRef(false);
  const textInputRef = useRef(null);
  const autoMicTimeout = useRef(null);
  const silenceTimeout = useRef(null);
  const continuousListeningRef = useRef(false);

  // Character data
  const characters = [
    { name: 'Alex Chen', avatar: '👨‍💼', personality: 'Analytical CEO', industry: 'Technology' },
    { name: 'Sarah Johnson', avatar: '👩‍💼', personality: 'Busy Marketing VP', industry: 'Healthcare' },
    { name: 'Mike Rodriguez', avatar: '👨‍💻', personality: 'Tech-savvy CTO', industry: 'Software' },
    { name: 'Linda Kim', avatar: '👩‍💻', personality: 'Results-driven CFO', industry: 'Finance' },
    { name: 'David Thompson', avatar: '👨‍🏢', personality: 'Traditional COO', industry: 'Manufacturing' }
  ];

  const currentCharacter = React.useMemo(() => 
    characters[Math.floor(Math.random() * characters.length)], []
  );

  // Initialize the roleplay
  useEffect(() => {
    if (componentInitAttempted.current) return;
    componentInitAttempted.current = true;

    const initializeRoleplay = async () => {
      try {
        setIsInitializing(true);
        setError('');

        logger.log('🚀 Initializing roleplay:', { type, mode });

        const access = getRoleplayAccess(type);
        if (!access?.unlocked) {
          throw new Error(access?.reason || 'Access denied to this roleplay');
        }

        // Initialize voice service
        logger.log('🎤 Initializing voice service...');
        try {
          const voiceAvailable = await checkVoiceServiceAvailability();
          setVoiceServiceAvailable(voiceAvailable);
          
          if (voiceAvailable) {
            logger.log('✅ Voice service available');
            
          } else {
            logger.warn('⚠️ Voice service not available - using text input');
          }
        } catch (voiceInitError) {
          logger.warn('⚠️ Voice service initialization failed:', voiceInitError);
          setVoiceServiceAvailable(false);
        }

        // Start roleplay session
        await startRoleplaySession(type, mode, {
          character: currentCharacter
        });

        logger.log('✅ Roleplay initialized successfully');

      } catch (error) {
        logger.error('❌ Error initializing roleplay:', error);
        setError(error.message || 'Failed to start roleplay. Please try again.');
      } finally {
        setIsInitializing(false);
      }
    };

    initializeRoleplay();

    return () => {
      cleanup();
    };
  }, [type, mode, startRoleplaySession, getRoleplayAccess]);

  // Check voice service availability
  const checkVoiceServiceAvailability = async () => {
    try {
      logger.log('🎤 Checking voice service availability...');
      
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        logger.warn('Speech recognition not supported in this browser');
        return false;
      }

      if (!('speechSynthesis' in window)) {
        logger.warn('Speech synthesis not supported in this browser');
        return false;
      }

      if (voiceService && typeof voiceService.initialize === 'function') {
        await voiceService.initialize();
        const state = voiceService.getState();
        return state.isInitialized;
      }

      return false;
    } catch (error) {
      logger.warn('Voice service availability check failed:', error);
      return false;
    }
  };

  // Handle call state changes
  useEffect(() => {
    if (callState === 'connected' && currentSession) {
      startDurationTimer();
      
      // Initial AI greeting
      setTimeout(async () => {
        const greeting = "Hello?";
        setCurrentMessage(greeting);
        addToConversationHistory('ai', greeting);
        
        if (voiceServiceAvailable && !isMuted) {
          setIsAISpeaking(true);
          try {
            await speakText(greeting);
            logger.log('✅ AI spoke greeting');
          } catch (error) {
            logger.error('Failed to speak greeting:', error);
          } finally {
            setIsAISpeaking(false);
          }
        }
        
        // Start listening after greeting
        if (voiceServiceAvailable) {
          setTimeout(() => {
            startContinuousListening();
          }, 1000);
        }
      }, 500);
    } else if (callState === 'ended') {
      clearTimers();
      stopContinuousListening();
      handleCallEnded();
    }

    return () => {
      clearTimers();
    };
  }, [callState, currentSession, voiceServiceAvailable]);

  // Handle session results
  useEffect(() => {
    if (sessionResults) {
      setEvaluation(sessionResults.evaluations?.[0]);
      setShowResults(true);
    }
  }, [sessionResults]);

  // Start continuous listening for natural conversation
  const startContinuousListening = useCallback(async () => {
    if (!voiceServiceAvailable || continuousListeningRef.current) return;

    try {
      continuousListeningRef.current = true;
      logger.log('🎤 Starting continuous listening...');

      const result = await startListening({
        continuous: false, // Changed to false to only listen once
        onResult: (transcript, confidence) => {
          logger.log('📝 Speech recognized:', transcript);
          handleContinuousInput(transcript, confidence);
          
          // After processing the result, restart listening if still connected
          if (callState === 'connected' && !isAISpeaking) {
            setTimeout(() => {
              continuousListeningRef.current = false;
              startContinuousListening();
            }, 1000); // Wait 1 second before restarting
          }
        },
        onInterim: (interim) => {
          // Show interim results for better UX
          if (interim && interim.length > 3) {
            setUserSpeechText(interim + '...');
          }
        },
        onError: (error) => {
          logger.error('Speech recognition error:', error);
          // Restart listening after error if still connected
          if (callState === 'connected' && !isAISpeaking) {
            setTimeout(() => {
              continuousListeningRef.current = false;
              startContinuousListening();
            }, 1000);
          }
        }
      });

    } catch (error) {
      logger.error('Failed to start continuous listening:', error);
      // Restart listening after error if still connected
      if (callState === 'connected' && !isAISpeaking) {
        setTimeout(() => {
          continuousListeningRef.current = false;
          startContinuousListening();
        }, 1000);
      }
    }
  }, [voiceServiceAvailable, callState, startListening, isAISpeaking]);

  // Stop continuous listening
  const stopContinuousListening = useCallback(() => {
    continuousListeningRef.current = false;
    stopListening();
    logger.log('🔇 Stopped continuous listening');
  }, [stopListening]);

  // Handle continuous input from speech recognition
  const handleContinuousInput = useCallback((transcript, confidence) => {
    if (!transcript || isProcessing || isAISpeaking) return;

    // Reset silence timer
    resetSilenceTimer();

    // Set the recognized text
    setUserSpeechText(transcript);

    // Process immediately since we're not using continuous mode anymore
    processUserInput(transcript, confidence);
  }, [isProcessing, isAISpeaking]);

  // Handle user interruption during AI speech
  const handleUserInterruption = useCallback((transcript) => {
    logger.log('🛑 User interrupted AI with:', transcript);
    
    // Stop AI speaking
    stopSpeaking();
    setIsAISpeaking(false);
    
    // Process the interruption
    setUserSpeechText(transcript);
    processUserInput(transcript, 0.9);
  }, [stopSpeaking]);

  // Process user input (voice or text)
  const processUserInput = async (transcript, confidence) => {
    if (!currentSession || callState !== 'connected' || isProcessing) {
      logger.warn('⚠️ Cannot process input - session not ready');
      return;
    }

    try {
      logger.log('🔄 Processing user input:', transcript);
      setIsTyping(false);
      addToConversationHistory('user', transcript);

      const aiResult = await handleUserResponse(transcript);
      
     // In processUserInput function, after getting AI response:
if (aiResult?.success) {
  const aiResponse = aiResult.response;
  setCurrentMessage(aiResponse);
  setEvaluation(aiResult.evaluation);
  addToConversationHistory('ai', aiResponse);

  // Make sure AI speaks the response
  if (!isMuted && aiResponse && voiceServiceAvailable) {
    setIsAISpeaking(true);
    try {
      // This is the key part - actually speak!
      await voiceService.speakText(aiResponse);
      logger.log('✅ AI spoke response:', aiResponse);
    } catch (speechError) {
      logger.error('❌ AI speech failed:', speechError);
    } finally {
      setIsAISpeaking(false);
    }
  }
}
    } catch (error) {
      logger.error('❌ Error processing user input:', error);
      setError('Failed to process your response. Please try again.');
    }
  };

  // Add message to conversation history
  const addToConversationHistory = (speaker, message) => {
    setConversationHistory(prev => [...prev, { speaker, message, timestamp: Date.now() }]);
  };

  // Handle text input submission
  const handleTextSubmit = async (e) => {
    e.preventDefault();
    
    if (!textInput.trim() || isProcessing) {
      return;
    }

    const userText = textInput.trim();
    setIsTyping(true);
    setTextInput('');
    setUserSpeechText(userText);
    
    logger.log('⌨️ User typed:', userText);
    
    try {
      await processUserInput(userText, 1.0);
    } catch (error) {
      logger.error('❌ Error processing typed input:', error);
      setError('Failed to process your message. Please try again.');
    }
  };

  // Silence detection
  const resetSilenceTimer = useCallback(() => {
    clearTimeout(silenceTimeout.current);
    
    silenceTimeout.current = setTimeout(() => {
      if (callState === 'connected' && !isProcessing && !isAISpeaking) {
        logger.log('⏱️ Silence detected');
        processUserInput('', 0); // Trigger silence handling
      }
    }, 10000); // 10 seconds
  }, [callState, isProcessing, isAISpeaking]);

  // Start duration timer
  const startDurationTimer = () => {
    clearTimers();
    durationInterval.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  // Clear all timers
  const clearTimers = () => {
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }
    if (autoMicTimeout.current) {
      clearTimeout(autoMicTimeout.current);
      autoMicTimeout.current = null;
    }
    if (silenceTimeout.current) {
      clearTimeout(silenceTimeout.current);
      silenceTimeout.current = null;
    }
  };

  // Handle call ended
  const handleCallEnded = () => {
    logger.log('📞 Call ended');
    stopContinuousListening();
    stopSpeaking();
    clearTimers();
  };

  // End call
  const handleCallEnd = async (reason = 'user_ended') => {
    try {
      logger.log('🏁 Ending call:', reason);
      
      const sessionResult = await endSession(reason);
      
      if (sessionResult) {
        await updateProgressData(sessionResult);
      }
    } catch (error) {
      logger.error('❌ Error ending call:', error);
      setError('Error ending call');
    }
  };

  // Update progress data
  const updateProgressData = async (sessionResult) => {
    try {
      const progressUpdate = {
        total_attempts: 1,
        total_passes: sessionResult.passed ? 1 : 0
      };

      if (mode === 'marathon' && sessionResult.passed) {
        const currentProgress = getRoleplayAccess(type);
        progressUpdate.marathon_passes = (currentProgress.marathon_passes || 0) + 1;
        
        if (progressUpdate.marathon_passes >= 6) {
          progressUpdate.unlock_expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        }
      }

      logger.log('📊 Updating progress:', progressUpdate);
      await updateProgress(type, progressUpdate);

    } catch (error) {
      logger.error('❌ Error updating progress:', error);
    }
  };

  // Toggle mute
  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    if (!isMuted) {
      stopSpeaking();
    }
  };

  // Manual microphone control
  const handleManualMicToggle = async () => {
    if (isListening) {
      stopListening();
    } else if (!isAISpeaking && !isProcessing) {
      try {
        const result = await startListening({
          continuous: false,
          onResult: (transcript, confidence) => {
            logger.log('📝 Manual recognition:', transcript);
            setUserSpeechText(transcript);
            processUserInput(transcript, confidence);
          }
        });
      } catch (error) {
        logger.error('Manual listening error:', error);
        setError('Failed to start microphone');
      }
    }
  };

  // Cleanup
  const cleanup = () => {
    clearTimers();
    stopContinuousListening();
    stopSpeaking();
    resetSession();
  };

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get call state color
  const getCallStateColor = () => {
    switch (callState) {
      case 'dialing': return 'bg-yellow-500';
      case 'connected': return 'bg-green-500';
      case 'ended': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  // Get call state text
  const getCallStateText = () => {
    switch (callState) {
      case 'dialing': return 'Connecting...';
      case 'connected': return `Connected • ${formatTime(callDuration)}`;
      case 'ended': return 'Call Ended';
      default: return 'Idle';
    }
  };

  // Navigate back
  const goBack = () => {
    cleanup();
    navigate('/dashboard');
  };

  // Loading state
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Initializing Roleplay</h2>
          <p className="text-blue-200">Setting up your practice session...</p>
        </div>
      </div>
    );
  }

  // Results screen
  if (showResults && sessionResults) {
    return (
      <CallResults
        sessionResults={sessionResults}
        duration={callDuration}
        roleplayType={type}
        mode={mode}
        onContinue={goBack}
        onRetry={() => {
          setShowResults(false);
          setCallDuration(0);
          setCurrentMessage('');
          setEvaluation(null);
          setConversationHistory([]);
          window.location.reload();
        }}
      />
    );
  }

  // Main interface
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 flex flex-col">
      {/* Header */}
      <div className="bg-black/20 text-white p-4 flex items-center justify-between">
        <button
          onClick={goBack}
          className="text-white/80 hover:text-white transition-colors"
        >
          ← Back to Dashboard
        </button>
        <div className="text-center">
          <div className="font-semibold">{type.replace('_', ' ').toUpperCase()}</div>
          <div className="text-sm opacity-80">{mode.toUpperCase()} MODE</div>
        </div>
        <div className="w-32" />
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-600 text-white p-4 text-center flex items-center justify-center">
          <AlertCircle className="w-5 h-5 mr-2" />
          {error}
        </div>
      )}

      {/* Voice service status */}
      {!voiceServiceAvailable && (
        <div className="bg-blue-600/20 text-blue-200 p-3 text-center text-sm">
          💡 Voice not available - using text input. For voice: use Chrome and allow microphone
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-white">
        {/* Call status */}
        <div className="mb-6 text-center">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <div className={`w-3 h-3 rounded-full ${getCallStateColor()}`}></div>
            <span className="text-sm font-medium">{getCallStateText()}</span>
          </div>
        </div>

        {/* Prospect avatar */}
        <div className="relative mb-6">
          <div className="w-40 h-40 bg-gradient-to-b from-blue-100 to-blue-200 rounded-full flex items-center justify-center text-6xl mb-4 shadow-2xl">
            {currentCharacter.avatar}
          </div>
          
          {/* Speaking indicator */}
          {isAISpeaking && (
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2">
              <div className="flex space-x-1">
                {[0, 1, 2].map(i => (
                  <div 
                    key={i}
                    className="w-2 h-2 bg-red-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Listening indicator */}
          {isListening && !isAISpeaking && (
            <div className="absolute -top-2 -right-2">
              <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                <Mic className="w-3 h-3 text-white" />
              </div>
            </div>
          )}
        </div>

        {/* Character info */}
        <div className="text-center mb-6">
          <h3 className="text-xl font-semibold mb-1">{currentCharacter.name}</h3>
          <p className="text-blue-200 text-sm">{currentCharacter.personality}</p>
          <p className="text-blue-300 text-xs">{currentCharacter.industry}</p>
        </div>

        {/* Current AI message */}
        {currentMessage && callState === 'connected' && (
          <div className="bg-white/10 backdrop-blur rounded-lg p-4 mb-6 max-w-md text-center border border-white/20">
            <p className="text-xs text-blue-200 mb-2">💬 Prospect says:</p>
            <p className="font-medium text-sm">&quot;{currentMessage}&quot;</p>
          </div>
        )}

        {/* User speech text */}
        {userSpeechText && (
          <div className="bg-blue-600/20 backdrop-blur rounded-lg p-3 mb-4 max-w-md text-center border border-blue-400/30">
            <p className="text-xs text-blue-200 mb-1">
              {isListening ? '🎤 Speaking...' : '💬 You said:'}
            </p>
            <p className="text-sm text-blue-100">&quot;{userSpeechText}&quot;</p>
          </div>
        )}

        {/* Status messages */}
        <div className="text-center mb-8 min-h-[2rem]">
          {callState === 'dialing' && (
            <div className="flex items-center justify-center space-x-2">
              <Phone className="w-4 h-4 animate-pulse" />
              <span className="text-blue-200">Dialing prospect...</span>
            </div>
          )}
          
          {callState === 'connected' && voiceServiceAvailable && (
            <p className="text-blue-200 text-sm">
              {isAISpeaking ? '🗣️ AI is speaking...' : 
               isListening ? '🎤 Listening...' :
               isProcessing ? '🤖 Processing...' :
               '🎤 Speak naturally - I\'m listening'}
            </p>
          )}
        </div>

        {/* Text input */}
        {callState === 'connected' && !isProcessing && (
          <div className="w-full max-w-md mb-6">
            <form onSubmit={handleTextSubmit} className="flex space-x-2">
              <input
                ref={textInputRef}
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={voiceServiceAvailable ? 
                  "Type here or speak naturally..." : 
                  "Type your response here..."
                }
                className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-white/50 focus:outline-none focus:border-blue-400 focus:bg-white/20"
                disabled={isProcessing || isTyping}
              />
              <button
                type="submit"
                disabled={!textInput.trim() || isProcessing || isTyping}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* Control buttons */}
        <div className="flex flex-col items-center space-y-6">
          {callState === 'connected' && (
            <div className="flex space-x-8">
              {/* Mute button */}
              <button
                onClick={handleMuteToggle}
                className={`
                  w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg
                  ${isMuted ? 'bg-gray-600 hover:bg-gray-700' : 'bg-white/20 hover:bg-white/30'}
                `}
                title={isMuted ? 'Unmute AI Voice' : 'Mute AI Voice'}
              >
                {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
              </button>

              {/* Manual mic button (if voice available) */}
              {voiceServiceAvailable && (
                <button
                  onClick={handleManualMicToggle}
                  disabled={isAISpeaking || isProcessing}
                  className={`
                    w-16 h-16 rounded-full flex items-center justify-center transition-all transform shadow-lg
                    ${isListening ? 'bg-red-500 hover:bg-red-600 scale-110' : 'bg-blue-500 hover:bg-blue-600'}
                    ${(isAISpeaking || isProcessing) ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  title={isListening ? 'Stop Manual Recording' : 'Start Manual Recording'}
                >
                  {isListening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
                </button>
              )}
            </div>
          )}

          {/* End call button */}
          <button
            onClick={() => handleCallEnd('user_ended')}
            disabled={callState === 'ended'}
            className="w-16 h-16 bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-full flex items-center justify-center transition-all shadow-lg"
            title="End Call"
          >
            <PhoneOff className="w-8 h-8" />
          </button>
        </div>

        {/* Evaluation feedback */}
        {evaluation && callState === 'connected' && (
          <div className="mt-6 bg-black/20 rounded-lg p-4 max-w-sm w-full">
            <div className="flex items-center space-x-2 mb-2">
              {evaluation.passed ? 
                <CheckCircle className="w-4 h-4 text-green-400" /> : 
                <AlertCircle className="w-4 h-4 text-red-400" />
              }
              <span className="text-sm font-medium">
                {evaluation.passed ? '✅ Good response!' : '📈 Keep practicing!'}
              </span>
            </div>
            {evaluation.feedback && (
              <p className="text-xs text-gray-300">{evaluation.feedback}</p>
            )}
          </div>
        )}
      </div>

      {/* Footer status */}
      <div className="bg-black/20 p-4 text-center text-sm text-white/80">
        {callState === 'dialing' && "Connecting to prospect..."}
        {callState === 'connected' && voiceServiceAvailable && "Speaking naturally - AI is listening continuously"}
        {callState === 'connected' && !voiceServiceAvailable && "Type your responses in the text box"}
        {callState === 'ended' && "Call completed - review your results"}
      </div>
    </div>
  );
};

// Call Results Component
const CallResults = ({ sessionResults, duration, roleplayType, mode, onContinue, onRetry }) => {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const evaluation = sessionResults.evaluations?.[0] || {};
  const coaching = sessionResults.coaching || {};

  const getResultData = () => {
    if (sessionResults.passed && evaluation.overall_score >= 3.5) {
      return { 
        color: 'green', 
        icon: '🌟', 
        title: 'Excellent Work!',
        message: 'Outstanding performance!'
      };
    }
    if (sessionResults.passed) {
      return { 
        color: 'blue', 
        icon: '✅', 
        title: 'Call Passed!',
        message: 'Good job! Keep improving.'
      };
    }
    return { 
      color: 'red', 
      icon: '📈', 
      title: 'Keep Practicing!',
      message: 'You\'re learning - try again!'
    };
  };

  const result = getResultData();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          {/* Result header */}
          <div className={`bg-${result.color}-500 text-white p-8 text-center`}>
            <div className="text-6xl mb-4">{result.icon}</div>
            <h1 className="text-3xl font-bold mb-2">{result.title}</h1>
            <p className="text-xl opacity-90">{result.message}</p>
            <p className="text-lg opacity-75 mt-2">
              {roleplayType.replace('_', ' ').toUpperCase()} • {mode.toUpperCase()}
            </p>
          </div>

          <div className="p-8">
            {/* Statistics */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{formatTime(duration)}</div>
                <div className="text-sm text-gray-600">Duration</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold text-${result.color}-600`}>
                  {evaluation.overall_score?.toFixed(1) || 'N/A'}/4
                </div>
                <div className="text-sm text-gray-600">Score</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold text-${result.color}-600`}>
                  {sessionResults.passed ? 'PASS' : 'RETRY'}
                </div>
                <div className="text-sm text-gray-600">Result</div>
              </div>
            </div>

            {/* Feedback sections */}
            {evaluation.feedback && (
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">📝 Performance Feedback</h3>
                <p className="text-gray-700">{evaluation.feedback}</p>
              </div>
            )}

            {/* Coaching feedback */}
            {Object.entries(coaching).length > 0 && (
              <div className="bg-blue-50 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">🎓 Coaching Tips</h3>
                <div className="space-y-2">
                  {coaching.sales && (
                    <p className="text-gray-700"><strong>Sales:</strong> {coaching.sales}</p>
                  )}
                  {coaching.grammar && (
                    <p className="text-gray-700"><strong>Grammar:</strong> {coaching.grammar}</p>
                  )}
                  {coaching.vocabulary && (
                    <p className="text-gray-700"><strong>Vocabulary:</strong> {coaching.vocabulary}</p>
                  )}
                  {coaching.pronunciation && (
                    <p className="text-gray-700"><strong>Pronunciation:</strong> {coaching.pronunciation}</p>
                  )}
                  {coaching.overall && (
                    <p className="text-gray-700 font-medium mt-3">{coaching.overall}</p>
                  )}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex space-x-4">
              <button
                onClick={onRetry}
                className="flex-1 bg-gray-600 text-white py-3 px-6 rounded-lg hover:bg-gray-700 transition-colors"
              >
                🔄 Try Again
              </button>
              <button
                onClick={onContinue}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
              >
                📚 Continue Training
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FunctionalPhoneInterface;