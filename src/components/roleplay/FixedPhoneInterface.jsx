// src/components/roleplay/FunctionalPhoneInterface.jsx - FIXED REF ERROR
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {PhoneOff, Mic, MicOff, Volume2, VolumeX, AlertCircle, CheckCircle } from 'lucide-react';
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
    voiceService 
  } = useVoice();

  // Component state
  const [currentMessage, setCurrentMessage] = useState('');
  const [silenceWarning, setSilenceWarning] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [userSpeechText, setUserSpeechText] = useState('');
  const [voiceServiceAvailable, setVoiceServiceAvailable] = useState(false);

  // FIXED: Refs with proper initialization
  const durationInterval = useRef(null);
  const initializationAttempted = useRef(false);
  const componentMounted = useRef(true);

  // Character data for the roleplay
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

  // FIXED: Better voice service availability check
  const checkVoiceServiceAvailability = useCallback(async () => {
    try {
      // Wait a bit for voice service to initialize, but don't block too long
      let attempts = 0;
      const maxAttempts = 30; // 3 seconds max
      
      while (!isInitialized && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      const available = isInitialized && !voiceError;
      logger.log(`🎤 Voice service availability check: ${available ? 'Available' : 'Not available'}`);
      return available;
    } catch (error) {
      logger.warn('Voice service availability check failed:', error);
      return false;
    }
  }, [isInitialized, voiceError]);

  // FIXED: Initialize the roleplay when component mounts
  useEffect(() => {
    // FIXED: Proper ref check to prevent double initialization
    if (initializationAttempted.current || !componentMounted.current) {
      return;
    }
    
    initializationAttempted.current = true;

    const initializeRoleplay = async () => {
      try {
        setIsInitializing(true);
        setError('');

        logger.log('🚀 Initializing roleplay:', { type, mode });

        // Check if user has access to this roleplay
        const access = getRoleplayAccess(type);
        if (!access?.unlocked) {
          throw new Error(access?.reason || 'Access denied to this roleplay');
        }

        // Check voice service status but don't block on it
        const voiceAvailable = await checkVoiceServiceAvailability();
        setVoiceServiceAvailable(voiceAvailable);

        if (!voiceAvailable) {
          logger.warn('⚠️ Voice service not available - continuing with limited functionality');
          setError('Voice service unavailable - you can still practice by typing responses');
        }

        // Start the roleplay session regardless of voice service status
        await startRoleplaySession(type, mode, {
          character: currentCharacter
        });

        logger.log('✅ Roleplay initialized successfully');

      } catch (error) {
        logger.error('❌ Error initializing roleplay:', error);
        setError(error.message || 'Failed to start roleplay. Please try again.');
      } finally {
        if (componentMounted.current) {
          setIsInitializing(false);
        }
      }
    };

    initializeRoleplay();
  }, [type, mode, startRoleplaySession, getRoleplayAccess, currentCharacter, checkVoiceServiceAvailability]);

  // FIXED: Cleanup on unmount
  useEffect(() => {
    componentMounted.current = true;
    
    return () => {
      componentMounted.current = false;
      cleanup();
    };
  }, []);

  // Handle call state changes
  useEffect(() => {
    if (!componentMounted.current) return;

    if (callState === 'connected' && currentSession) {
      startDurationTimer();
      
      // Set initial greeting message when connected
      setTimeout(() => {
        if (componentMounted.current) {
          setCurrentMessage("Hello?");
        }
      }, 500);
    } else if (callState === 'ended') {
      clearTimers();
      handleCallEnded();
    }

    return () => {
      clearTimers();
    };
  }, [callState, currentSession]);

  // Handle session results
  useEffect(() => {
    if (!componentMounted.current) return;
    
    if (sessionResults) {
      setEvaluation(sessionResults.evaluations?.[0]);
      setShowResults(true);
    }
  }, [sessionResults]);

  // Handle voice errors
  useEffect(() => {
    if (!componentMounted.current) return;
    
    if (voiceError) {
      logger.warn('Voice error occurred:', voiceError);
      setVoiceServiceAvailable(false);
      // Don't set this as a blocking error - just show a warning
    }
  }, [voiceError]);

  const startDurationTimer = useCallback(() => {
    clearTimers();
    durationInterval.current = setInterval(() => {
      if (componentMounted.current) {
        setCallDuration(prev => prev + 1);
      }
    }, 1000);
  }, []);

  const clearTimers = useCallback(() => {
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }
  }, []);

  const handleCallEnded = useCallback(() => {
    logger.log('📞 Call ended, stopping all audio/voice');
    stopListening();
    stopSpeaking();
    clearTimers();
  }, [stopListening, stopSpeaking, clearTimers]);

  const handleStartListening = useCallback(async () => {
    if (isListening || isSpeaking || isProcessing) {
      logger.log('⚠️ Cannot start listening - already active');
      return;
    }

    if (!voiceServiceAvailable) {
      setError('Voice service not available. Please check your microphone and browser permissions.');
      return;
    }

    try {
      setError('');
      setSilenceWarning(false);
      setUserSpeechText('');
      
      logger.log('🎤 Starting to listen...');
      
      const result = await startListening({
        onResult: (transcript, confidence) => {
          logger.log('📝 User said:', transcript);
          if (componentMounted.current) {
            setUserSpeechText(transcript);
            processUserInput(transcript, confidence);
          }
        },
        onError: (error) => {
          logger.error('❌ Voice recognition error:', error);
          if (componentMounted.current) {
            setError(error);
          }
        }
      });

      if (result && result.transcript && componentMounted.current) {
        setUserSpeechText(result.transcript);
        await processUserInput(result.transcript, result.confidence);
      }

    } catch (error) {
      logger.error('❌ Voice recognition error:', error);
      if (componentMounted.current) {
        setError(error.message);
      }
    }
  }, [isListening, isSpeaking, isProcessing, voiceServiceAvailable, startListening]);

  const processUserInput = useCallback(async (transcript, confidence) => {
    if (!currentSession || callState !== 'connected' || !componentMounted.current) {
      logger.warn('⚠️ Cannot process input - session not ready');
      return;
    }

    try {
      logger.log('🔄 Processing user input:', transcript);

      // Log pronunciation issues for low confidence
      if (confidence < 0.7) {
        logger.log('📊 Low confidence speech detected:', confidence);
      }

      // Process with AI and get response
      const aiResult = await handleUserResponse(transcript);
      
      if (aiResult?.success && componentMounted.current) {
        setCurrentMessage(aiResult.response);
        setEvaluation(aiResult.evaluation);

        // Speak the AI response if not muted and voice service is available
        if (!isMuted && aiResult.response && voiceServiceAvailable) {
          try {
            logger.log('🗣️ AI speaking:', aiResult.response);
            await speakText(aiResult.response, {
              voiceId: 'Joanna',
              rate: 0.9
            });
          } catch (speechError) {
            logger.warn('❌ AI speech failed:', speechError);
            // Don't block the conversation if speech fails
          }
        }

        // Check if call should end
        if (aiResult.nextStage === 'hang_up' || aiResult.shouldHangUp) {
          logger.log('📞 Call ending due to stage:', aiResult.nextStage);
          setTimeout(() => {
            if (componentMounted.current) {
              handleCallEnd(aiResult.evaluation?.passed ? 'completed' : 'failed');
            }
          }, 2000);
        }
      } else {
        logger.error('❌ AI processing failed:', aiResult?.error);
        if (componentMounted.current) {
          setError('Failed to process your response. Please try again.');
        }
      }
    } catch (error) {
      logger.error('❌ Error processing user input:', error);
      if (componentMounted.current) {
        setError('Failed to process your response. Please try again.');
      }
    }
  }, [currentSession, callState, handleUserResponse, isMuted, voiceServiceAvailable, speakText]);

  const handleCallEnd = useCallback(async (reason = 'user_ended') => {
    try {
      logger.log('🏁 Ending call:', reason);
      
      const sessionResult = await endSession(reason);
      
      // Update progress based on result
      if (sessionResult && componentMounted.current) {
        await updateProgressData(sessionResult);
      }
    } catch (error) {
      logger.error('❌ Error ending call:', error);
      if (componentMounted.current) {
        setError('Error ending call');
      }
    }
  }, [endSession]);

  const updateProgressData = useCallback(async (sessionResult) => {
    try {
      const progressUpdate = {
        total_attempts: 1,
        total_passes: sessionResult.passed ? 1 : 0,
        last_completed: new Date().toISOString()
      };

      // For marathon mode, update marathon passes
      if (mode === 'marathon' && sessionResult.passed) {
        const currentProgress = getRoleplayAccess(type);
        progressUpdate.marathon_passes = (currentProgress.marathon_passes || 0) + 1;
        
        // Unlock next module if enough passes
        if (progressUpdate.marathon_passes >= 6) {
          progressUpdate.unlock_expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        }
      }

      // For legend mode
      if (mode === 'legend') {
        progressUpdate.legend_completed = sessionResult.passed;
        progressUpdate.legend_attempt_used = true;
      }

      await updateProgress(type, progressUpdate);
    } catch (error) {
      logger.error('❌ Error updating progress:', error);
    }
  }, [mode, type, getRoleplayAccess, updateProgress]);

  const handleMuteToggle = useCallback(() => {
    setIsMuted(prev => {
      const newMuted = !prev;
      if (newMuted) {
        stopSpeaking();
      }
      return newMuted;
    });
  }, [stopSpeaking]);

  const cleanup = useCallback(() => {
    clearTimers();
    stopListening();
    stopSpeaking();
    resetSession();
  }, [clearTimers, stopListening, stopSpeaking, resetSession]);

  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const getCallStateColor = useCallback(() => {
    switch (callState) {
      case 'dialing': return 'bg-yellow-500';
      case 'connected': return 'bg-green-500';
      case 'ended': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  }, [callState]);

  const getCallStateText = useCallback(() => {
    switch (callState) {
      case 'dialing': return 'Connecting...';
      case 'connected': return `Connected • ${formatTime(callDuration)}`;
      case 'ended': return 'Call Ended';
      default: return 'Idle';
    }
  }, [callState, callDuration, formatTime]);

  const goBack = useCallback(() => {
    cleanup();
    navigate('/dashboard');
  }, [cleanup, navigate]);

  // Show loading while initializing
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Initializing Roleplay</h2>
          <p className="text-blue-200">Setting up your practice session...</p>
          {voiceError && (
            <p className="text-yellow-200 text-sm mt-2">
              Voice service is starting up...
            </p>
          )}
        </div>
      </div>
    );
  }

  // Show results modal
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
          // Reset refs for retry
          initializationAttempted.current = false;
          window.location.reload(); // Restart the component
        }}
      />
    );
  }

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
        <div className="w-32" /> {/* Spacer */}
      </div>

      {/* Error Message */}
      {error && (
        <div className={`p-4 text-center flex items-center justify-center ${
          voiceServiceAvailable ? 'bg-red-600 text-white' : 'bg-yellow-600 text-white'
        }`}>
          <AlertCircle className="w-5 h-5 mr-2" />
          {error}
        </div>
      )}

      {/* Voice Service Status */}
      {!voiceServiceAvailable && !error && (
        <div className="bg-blue-600/20 text-blue-200 p-3 text-center text-sm">
          💡 Voice service not available - you can practice by typing responses or try refreshing
        </div>
      )}

      {/* Main Interface */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-white">
        {/* Call Status */}
        <div className="mb-6 text-center">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <div className={`w-3 h-3 rounded-full ${getCallStateColor()}`}></div>
            <span className="text-sm font-medium">{getCallStateText()}</span>
          </div>
          
          {silenceWarning && (
            <div className="text-yellow-400 text-sm animate-pulse">
              ⚠️ Prospect getting impatient...
            </div>
          )}
        </div>

        {/* Character Avatar */}
        <div className="relative mb-6">
          <div className="w-40 h-40 bg-gradient-to-b from-blue-100 to-blue-200 rounded-full flex items-center justify-center text-6xl mb-4 shadow-2xl">
            {currentCharacter.avatar}
          </div>
          
          {/* Speaking indicator */}
          {isSpeaking && (
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
          {isListening && (
            <div className="absolute -top-2 -right-2">
              <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                <Mic className="w-3 h-3 text-white" />
              </div>
            </div>
          )}
        </div>

        {/* Character Info */}
        <div className="text-center mb-6">
          <h3 className="text-xl font-semibold mb-1">{currentCharacter.name}</h3>
          <p className="text-blue-200 text-sm">{currentCharacter.personality}</p>
          <p className="text-blue-300 text-xs">{userProfile?.prospect_job_title || 'Decision Maker'}</p>
          <p className="text-blue-400 text-xs">{currentCharacter.industry}</p>
        </div>

        {/* Current Message */}
        {currentMessage && callState === 'connected' && (
          <div className="bg-white/10 backdrop-blur rounded-lg p-4 mb-6 max-w-md text-center border border-white/20">
            <p className="text-xs text-blue-200 mb-2">💬 Prospect says:</p>
            <p className="font-medium text-sm">&quot;{currentMessage}&quot;</p>
          </div>
        )}

        {/* User Speech Display */}
        {userSpeechText && (
          <div className="bg-blue-600/20 backdrop-blur rounded-lg p-3 mb-4 max-w-md text-center border border-blue-400/30">
            <p className="text-xs text-blue-200 mb-1">🎤 You said:</p>
            <p className="text-sm text-blue-100">&quot;{userSpeechText}&quot;</p>
          </div>
        )}

        {/* Voice Status */}
        <div className="text-center mb-8 min-h-[2rem]">
          {callState === 'dialing' && (
            <div className="flex items-center justify-center space-x-2">
              {[0, 1, 2].map(i => (
                <div 
                  key={i}
                  className="w-2 h-2 bg-white rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
              ))}
              <span className="ml-2 text-blue-200">Dialing prospect...</span>
            </div>
          )}
          
          {callState === 'connected' && !isListening && !isSpeaking && !isProcessing && (
            <div className="space-y-2">
              <p className="text-blue-200">
                {voiceServiceAvailable ? '🎤 Tap microphone to speak' : '⌨️ Voice not available - type your response'}
              </p>
              {process.env.NODE_ENV === 'development' && voiceService && (
                <button
                  onClick={() => voiceService.testSpeech && voiceService.testSpeech("Hello, this is a test.")}
                  className="text-xs bg-blue-600/20 px-2 py-1 rounded text-blue-200 hover:bg-blue-600/30"
                >
                  Test Speech
                </button>
              )}
            </div>
          )}
          
          {isListening && (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <p className="text-red-200">Listening... Speak now</p>
            </div>
          )}

          {isSpeaking && (
            <p className="text-blue-200">🗣️ AI is speaking...</p>
          )}

          {isProcessing && (
            <p className="text-yellow-200">🤖 Processing your response...</p>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center space-y-6">
          {/* Voice Controls */}
          {callState === 'connected' && voiceServiceAvailable && (
            <div className="flex space-x-8">
              {/* Mute Button */}
              <button
                onClick={handleMuteToggle}
                className={`
                  w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg
                  ${isMuted 
                    ? 'bg-gray-600 hover:bg-gray-700' 
                    : 'bg-white/20 hover:bg-white/30'}
                `}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
              </button>

              {/* Mic Button */}
              <button
                onClick={isListening ? stopListening : handleStartListening}
                disabled={isSpeaking || isProcessing}
                className={`
                  w-16 h-16 rounded-full flex items-center justify-center transition-all transform shadow-lg
                  ${isListening 
                    ? 'bg-red-500 hover:bg-red-600 scale-110' 
                    : 'bg-blue-500 hover:bg-blue-600'}
                  ${(isSpeaking || isProcessing) ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                title={isListening ? 'Stop Listening' : 'Start Speaking'}
              >
                {isListening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
              </button>
            </div>
          )}

          {/* Hang Up Button */}
          <button
            onClick={() => handleCallEnd('user_ended')}
            disabled={callState === 'ended'}
            className="w-16 h-16 bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-full flex items-center justify-center transition-all shadow-lg"
            title="End Call"
          >
            <PhoneOff className="w-8 h-8" />
          </button>
        </div>

        {/* Evaluation Preview */}
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

      {/* Instructions */}
      <div className="bg-black/20 p-4 text-center text-sm text-white/80">
        {callState === 'dialing' && "Connecting to prospect..."}
        {callState === 'connected' && !isListening && !isSpeaking && voiceServiceAvailable && "Tap microphone to speak, then release when finished"}
        {callState === 'connected' && !isListening && !isSpeaking && !voiceServiceAvailable && "Voice service unavailable - practice by typing responses"}
        {callState === 'connected' && isListening && "Speaking... Release when finished"}
        {callState === 'connected' && isSpeaking && "AI is responding..."}
        {callState === 'ended' && "Call completed - review your results"}
      </div>
    </div>
  );
};

// Call Results Component (unchanged but with better error handling)
const CallResults = React.memo(({ sessionResults, duration, roleplayType, mode, onContinue, onRetry }) => {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const evaluation = sessionResults?.evaluations?.[0] || {};
  const coaching = sessionResults?.coaching || {};

  const getResultData = () => {
    if (sessionResults?.passed && evaluation.overall_score >= 3.5) {
      return { 
        color: 'green', 
        icon: '🌟', 
        title: 'Excellent Work!',
        message: 'Outstanding performance!'
      };
    }
    if (sessionResults?.passed) {
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
          {/* Header */}
          <div className={`bg-${result.color}-500 text-white p-8 text-center`}>
            <div className="text-6xl mb-4">{result.icon}</div>
            <h1 className="text-3xl font-bold mb-2">{result.title}</h1>
            <p className="text-xl opacity-90">{result.message}</p>
            <p className="text-lg opacity-75 mt-2">
              {roleplayType?.replace('_', ' ').toUpperCase()} • {mode?.toUpperCase()}
            </p>
          </div>

          {/* Results */}
          <div className="p-8">
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{formatTime(duration || 0)}</div>
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
                  {sessionResults?.passed ? 'PASS' : 'RETRY'}
                </div>
                <div className="text-sm text-gray-600">Result</div>
              </div>
            </div>

            {/* Feedback */}
            {evaluation.feedback && (
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">📝 Feedback</h3>
                <p className="text-gray-700">{evaluation.feedback}</p>
              </div>
            )}

            {/* Actions */}
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
});

CallResults.displayName = 'CallResults';

export default FunctionalPhoneInterface;