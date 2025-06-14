// src/components/roleplay/FunctionalPhoneInterface.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {PhoneOff, Mic, MicOff, Volume2, VolumeX, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRoleplay } from '../../contexts/RoleplayContext';
import { useProgress } from '../../contexts/ProgressContext';
import { useVoice } from '../../services/voiceService';
import logger from '../../utils/logger';

const FunctionalPhoneInterface = () => {
  const { type, mode } = useParams(); // e.g., /roleplay/opener_practice/practice
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

  // Refs
  const durationInterval = useRef(null);
  const initializationAttempted = useRef(false);

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

  // Initialize the roleplay when component mounts
  useEffect(() => {
    if (initializationAttempted.current) return;
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

        // Wait for voice service to be ready
        if (!isInitialized) {
          logger.log('⏳ Waiting for voice service initialization...');
          await new Promise(resolve => {
            const checkInit = () => {
              if (voiceService.isInitialized) {
                resolve();
              } else {
                setTimeout(checkInit, 100);
              }
            };
            checkInit();
          });
        }

        // Start the roleplay session
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
  }, [type, mode, startRoleplaySession, isInitialized, getRoleplayAccess]);

  // Handle call state changes
  useEffect(() => {
    if (callState === 'connected' && currentSession) {
      startDurationTimer();
      
      // Set initial greeting message when connected
      setTimeout(() => {
        setCurrentMessage("Hello?");
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
    if (sessionResults) {
      setEvaluation(sessionResults.evaluations?.[0]);
      setShowResults(true);
    }
  }, [sessionResults]);

  // Handle voice errors
  useEffect(() => {
    if (voiceError) {
      setError(voiceError);
    }
  }, [voiceError]);

  const startDurationTimer = () => {
    clearTimers();
    durationInterval.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const clearTimers = () => {
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }
  };

  const handleCallEnded = () => {
    logger.log('📞 Call ended, stopping all audio/voice');
    stopListening();
    stopSpeaking();
    clearTimers();
  };

  const handleStartListening = async () => {
    if (isListening || isSpeaking || isProcessing) {
      logger.log('⚠️ Cannot start listening - already active');
      return;
    }

    try {
      setError('');
      setSilenceWarning(false);
      setUserSpeechText('');
      
      logger.log('🎤 Starting to listen...');
      
      const result = await startListening({
        skipPermissionCheck: false
      });

      if (result?.transcript) {
        logger.log('📝 User said:', result.transcript);
        setUserSpeechText(result.transcript);
        await processUserInput(result.transcript, result.confidence);
      }
    } catch (error) {
      logger.error('❌ Voice recognition error:', error);
      setError(error.message);
    }
  };

  const processUserInput = async (transcript, confidence) => {
    if (!currentSession || callState !== 'connected') {
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
      
      if (aiResult?.success) {
        setCurrentMessage(aiResult.response);
        setEvaluation(aiResult.evaluation);

        // Speak the AI response if not muted
        if (!isMuted && aiResult.response) {
          logger.log('🗣️ AI speaking:', aiResult.response);
          await speakText(aiResult.response, {
            voiceId: 'Joanna',
            rate: 0.9
          });
        }

        // Check if call should end
        if (aiResult.nextStage === 'hang_up' || aiResult.shouldHangUp) {
          logger.log('📞 Call ending due to stage:', aiResult.nextStage);
          setTimeout(() => {
            handleCallEnd(aiResult.evaluation?.passed ? 'completed' : 'failed');
          }, 2000);
        }
      } else {
        logger.error('❌ AI processing failed:', aiResult?.error);
        setError('Failed to process your response. Please try again.');
      }
    } catch (error) {
      logger.error('❌ Error processing user input:', error);
      setError('Failed to process your response. Please try again.');
    }
  };

  const handleCallEnd = async (reason = 'user_ended') => {
    try {
      logger.log('🏁 Ending call:', reason);
      
      const sessionResult = await endSession(reason);
      
      // Update progress based on result
      if (sessionResult) {
        await updateProgressData(sessionResult);
      }
    } catch (error) {
      logger.error('❌ Error ending call:', error);
      setError('Error ending call');
    }
  };

  const updateProgressData = async (sessionResult) => {
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
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    if (!isMuted) {
      stopSpeaking();
    }
  };

  const cleanup = () => {
    clearTimers();
    stopListening();
    stopSpeaking();
    resetSession();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCallStateColor = () => {
    switch (callState) {
      case 'dialing': return 'bg-yellow-500';
      case 'connected': return 'bg-green-500';
      case 'ended': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getCallStateText = () => {
    switch (callState) {
      case 'dialing': return 'Connecting...';
      case 'connected': return `Connected • ${formatTime(callDuration)}`;
      case 'ended': return 'Call Ended';
      default: return 'Idle';
    }
  };

  const goBack = () => {
    cleanup();
    navigate('/dashboard');
  };

  // Show loading while initializing
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
        <div className="bg-red-600 text-white p-4 text-center flex items-center justify-center">
          <AlertCircle className="w-5 h-5 mr-2" />
          {error}
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
              <p className="text-blue-200">🎤 Tap microphone to speak</p>
              {process.env.NODE_ENV === 'development' && (
                <button
                  onClick={() => voiceService.testSpeech("Hello, this is a test.")}
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
          {callState === 'connected' && (
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
        {callState === 'connected' && !isListening && !isSpeaking && "Tap microphone to speak, then release when finished"}
        {callState === 'connected' && isListening && "Speaking... Release when finished"}
        {callState === 'connected' && isSpeaking && "AI is responding..."}
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
          {/* Header */}
          <div className={`bg-${result.color}-500 text-white p-8 text-center`}>
            <div className="text-6xl mb-4">{result.icon}</div>
            <h1 className="text-3xl font-bold mb-2">{result.title}</h1>
            <p className="text-xl opacity-90">{result.message}</p>
            <p className="text-lg opacity-75 mt-2">
              {roleplayType.replace('_', ' ').toUpperCase()} • {mode.toUpperCase()}
            </p>
          </div>

          {/* Results */}
          <div className="p-8">
            {/* Quick Stats */}
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

            {/* Feedback */}
            {evaluation.feedback && (
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">📝 Feedback</h3>
                <p className="text-gray-700">{evaluation.feedback}</p>
              </div>
            )}

            {/* Coaching */}
            {coaching && Object.keys(coaching).length > 0 && (
              <div className="bg-blue-50 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">💡 Coaching Tips</h3>
                <div className="space-y-3">
                  {coaching.sales && (
                    <div>
                      <span className="font-medium text-blue-800">Sales:</span>
                      <span className="text-blue-700 ml-2">{coaching.sales}</span>
                    </div>
                  )}
                  {coaching.grammar && (
                    <div>
                      <span className="font-medium text-blue-800">Grammar:</span>
                      <span className="text-blue-700 ml-2">{coaching.grammar}</span>
                    </div>
                  )}
                  {coaching.vocabulary && (
                    <div>
                      <span className="font-medium text-blue-800">Vocabulary:</span>
                      <span className="text-blue-700 ml-2">{coaching.vocabulary}</span>
                    </div>
                  )}
                  {coaching.pronunciation && (
                    <div>
                      <span className="font-medium text-blue-800">Pronunciation:</span>
                      <span className="text-blue-700 ml-2">{coaching.pronunciation}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Score Breakdown */}
            {evaluation.scores && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Score Breakdown</h3>
                <div className="space-y-3">
                  {Object.entries(evaluation.scores).map(([criterion, passed], index) => (
                    <div key={criterion} className="flex items-center justify-between">
                      <span className="text-gray-700">Criterion {index + 1}</span>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {passed ? '✓ Met' : '✗ Needs Work'}
                      </div>
                    </div>
                  ))}
                </div>
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
};

export default FunctionalPhoneInterface;