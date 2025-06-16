// src/components/roleplay/UnifiedPhoneInterface.jsx - CLEAN & RELIABLE
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, MessageCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRoleplay } from '../../contexts/RoleplayContext';
import { useProgress } from '../../contexts/ProgressContext';
import logger from '../../utils/logger';

const UnifiedPhoneInterface = () => {
  const { type, mode } = useParams();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { getRoleplayAccess, updateProgress } = useProgress();
  const { 
    startRoleplaySession, 
    endSession, 
    resetSession,
    currentSession, 
    callState,
    sessionResults,
    isProcessing,
    currentMessage,
    conversationHistory,
    getSessionStats,
    handleUserResponse
  } = useRoleplay();

  // Local state
  const [isInitializing, setIsInitializing] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [error, setError] = useState('');
  const [deviceType, setDeviceType] = useState('desktop');
  const [micPermission, setMicPermission] = useState('prompt');

  // Refs
  const durationInterval = useRef(null);
  const initializationAttempted = useRef(false);

  // Detect device type
  useEffect(() => {
    const detectDevice = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const isMobileDevice = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      const isSmallScreen = window.innerWidth <= 768;
      
      setDeviceType(isMobileDevice || isSmallScreen ? 'mobile' : 'desktop');
      
      logger.log('📱 Device detected:', { 
        type: isMobileDevice || isSmallScreen ? 'mobile' : 'desktop',
        userAgent: isMobileDevice,
        screenWidth: window.innerWidth 
      });
    };

    detectDevice();
    window.addEventListener('resize', detectDevice);
    return () => window.removeEventListener('resize', detectDevice);
  }, []);

  // Check microphone permission
  useEffect(() => {
    const checkMicPermission = async () => {
      try {
        const permission = await navigator.permissions.query({ name: 'microphone' });
        setMicPermission(permission.state);
        
        permission.addEventListener('change', () => {
          setMicPermission(permission.state);
        });
      } catch (error) {
        logger.warn('Could not check microphone permission:', error);
        setMicPermission('granted'); // Assume granted if we can't check
      }
    };

    checkMicPermission();
  }, []);

  // Initialize roleplay session
  useEffect(() => {
    if (initializationAttempted.current) return;
    initializationAttempted.current = true;

    const initializeRoleplay = async () => {
      try {
        setIsInitializing(true);
        setError('');

        logger.log('🚀 Initializing roleplay:', { type, mode });

        // Check access
        const access = getRoleplayAccess(type);
        if (!access?.unlocked) {
          throw new Error(access?.reason || 'Access denied to this roleplay');
        }

        // Start the roleplay session
        await startRoleplaySession(type, mode, {
          userProfile,
          deviceType
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

    // Cleanup on unmount
    return () => {
      if (currentSession) {
        endSession('component_unmount');
      }
      resetSession();
      clearInterval(durationInterval.current);
    };
  }, [type, mode, startRoleplaySession, getRoleplayAccess, userProfile, deviceType]);

  // Handle call duration timer
  useEffect(() => {
    if (callState === 'connected') {
      durationInterval.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }
      if (callState === 'idle') {
        setCallDuration(0);
      }
    }

    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, [callState]);

  // Handle session results
  useEffect(() => {
    if (sessionResults) {
      logger.log('📊 Session completed:', sessionResults);
    }
  }, [sessionResults]);

  // Format call duration
  const formatDuration = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Handle microphone button click
  const handleMicClick = useCallback(async () => {
    if (micPermission === 'denied') {
      setError('Microphone permission denied. Please enable microphone access in your browser settings.');
      return;
    }

    if (callState !== 'connected') {
      setError('Cannot use microphone - call not connected');
      return;
    }

    if (isProcessing) {
      logger.log('Cannot start listening - AI is processing');
      return;
    }

    try {
      setError('');
      
      // Import voice service dynamically since it might not be in the context
      const { voiceService } = await import('../../services/voiceService');
      
      if (voiceService.isListening) {
        voiceService.stopListening();
      } else {
        const started = voiceService.startListening();
        if (!started) {
          setError('Failed to start microphone. Try the text input option.');
        }
      }
    } catch (error) {
      logger.error('❌ Microphone error:', error);
      setError('Microphone not available. Please use text input or check your browser permissions.');
    }
  }, [micPermission, callState, isProcessing]);

  // Handle manual text input
  const handleManualSubmit = useCallback(async () => {
    if (!manualInput.trim()) return;

    try {
      setError('');
      logger.log('📝 Manual input:', manualInput);
      
      await handleUserResponse(manualInput.trim());
      setManualInput('');
      setShowManualInput(false);
    } catch (error) {
      logger.error('❌ Error with manual input:', error);
      setError('Failed to process your message. Please try again.');
    }
  }, [manualInput, handleUserResponse]);

  // Handle hang up
  const handleHangUp = useCallback(async () => {
    try {
      logger.log('📞 User hang up');
      
      const sessionResult = await endSession('user_hangup');
      
      // Update progress if needed
      if (sessionResult) {
        const progressUpdate = {
          total_attempts: 1,
          total_passes: sessionResult.passed ? 1 : 0,
          last_completed: new Date().toISOString()
        };

        if (mode === 'marathon' && sessionResult.passed) {
          const currentProgress = getRoleplayAccess(type);
          progressUpdate.marathon_passes = (currentProgress.marathon_passes || 0) + 1;
        }

        await updateProgress(type, progressUpdate);
      }
      
    } catch (error) {
      logger.error('❌ Error ending call:', error);
    }
  }, [endSession, mode, type, getRoleplayAccess, updateProgress]);

  // Handle back navigation
  const handleGoBack = useCallback(() => {
    if (currentSession && callState !== 'ended') {
      handleHangUp();
    }
    navigate('/dashboard');
  }, [currentSession, callState, handleHangUp, navigate]);

  // Get call state display
  const getCallStateDisplay = () => {
    switch (callState) {
      case 'idle':
        return 'Ready';
      case 'dialing':
        return 'Connecting...';
      case 'connected':
        return `Connected • ${formatDuration(callDuration)}`;
      case 'ended':
        return 'Call Ended';
      default:
        return 'Unknown';
    }
  };

  // Get microphone state
  const getMicrophoneState = async () => {
    try {
      const { voiceService } = await import('../../services/voiceService');
      return voiceService.getState();
    } catch (error) {
      return { isListening: false, isSpeaking: false };
    }
  };

  // Get character info
  const getCharacterInfo = () => {
    if (currentSession?.character) {
      return currentSession.character;
    }
    return {
      name: 'Loading...',
      title: '',
      company: ''
    };
  };

  // Show loading state
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Starting Roleplay</h2>
          <p className="text-blue-200">Setting up your practice session...</p>
          <p className="text-sm text-blue-300 mt-2">Device: {deviceType}</p>
        </div>
      </div>
    );
  }

  // Show session results
  if (sessionResults) {
    return <SessionResults 
      results={sessionResults} 
      onContinue={handleGoBack}
      onRetry={() => window.location.reload()}
    />;
  }

  const character = getCharacterInfo();
  const stats = getSessionStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900">
      {/* Header */}
      <div className="p-4 flex items-center justify-between text-white">
        <button
          onClick={handleGoBack}
          className="flex items-center space-x-2 text-white/80 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        
        <div className="text-center">
          <h1 className="font-semibold">{type.replace('_', ' ').toUpperCase()}</h1>
          <p className="text-sm opacity-80">{mode.toUpperCase()} MODE</p>
        </div>
        
        <div className="w-16" /> {/* Spacer */}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-600 text-white p-4 text-center">
          <p className="text-sm">{error}</p>
          <button 
            onClick={() => setError('')}
            className="mt-2 text-xs underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Phone Interface */}
      <div className="flex justify-center px-4">
        <div className="bg-black/80 backdrop-blur rounded-3xl p-6 w-full max-w-md shadow-2xl">
          
          {/* Call Status */}
          <div className="text-center text-white mb-6">
            <div className="text-lg font-mono mb-1">{getCallStateDisplay()}</div>
            {micPermission === 'denied' && (
              <p className="text-xs text-red-300">⚠️ Microphone access denied</p>
            )}
          </div>

          {/* Character Avatar & Info */}
          <div className="text-center text-white mb-6">
            <div className="w-24 h-24 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full mx-auto mb-3 flex items-center justify-center shadow-lg">
              <span className="text-2xl font-bold">
                {character.name ? character.name.charAt(0) : '?'}
              </span>
            </div>
            <h2 className="text-xl font-semibold mb-1">{character.name}</h2>
            <p className="text-sm opacity-75">{character.title}</p>
            <p className="text-xs opacity-60">{character.company}</p>
          </div>

          {/* Current Message */}
          {currentMessage && callState === 'connected' && (
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 mb-6 text-center border border-white/20">
              <p className="text-xs text-blue-200 mb-2">💬 Prospect says:</p>
              <p className="text-white text-sm font-medium">"{currentMessage}"</p>
            </div>
          )}

          {/* Voice Status */}
          <div className="text-center text-white mb-6">
            <VoiceStatusIndicator 
              callState={callState}
              isProcessing={isProcessing}
              getMicrophoneState={getMicrophoneState}
            />
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {/* Primary Microphone Button */}
            {callState === 'connected' && (
              <div className="flex justify-center">
                <MicrophoneButton 
                  onClick={handleMicClick}
                  disabled={isProcessing || isMuted}
                  getMicrophoneState={getMicrophoneState}
                />
              </div>
            )}

            {/* Secondary Controls */}
            <div className="flex justify-center space-x-4">
              {/* Text Input Toggle */}
              <button
                onClick={() => setShowManualInput(!showManualInput)}
                className="w-12 h-12 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors"
                title="Type response"
              >
                <MessageCircle className="w-5 h-5 text-white" />
              </button>

              {/* Mute Toggle */}
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  isMuted 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
              </button>
            </div>

            {/* Manual Input */}
            {showManualInput && (
              <div className="space-y-3">
                <textarea
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Type your response here..."
                  className="w-full p-3 bg-gray-800 text-white rounded-lg text-sm resize-none"
                  rows={3}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleManualSubmit();
                    }
                  }}
                />
                <div className="flex space-x-2">
                  <button
                    onClick={handleManualSubmit}
                    disabled={!manualInput.trim() || isProcessing}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Send Response
                  </button>
                  <button
                    onClick={() => {
                      setShowManualInput(false);
                      setManualInput('');
                    }}
                    className="bg-gray-600 text-white py-2 px-4 rounded-lg text-sm hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Hang Up Button */}
            <div className="flex justify-center pt-4">
              <button
                onClick={handleHangUp}
                disabled={callState === 'ended'}
                className="w-16 h-16 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-full flex items-center justify-center transition-colors shadow-lg"
                title="End Call"
              >
                <PhoneOff className="w-8 h-8 text-white" />
              </button>
            </div>
          </div>

          {/* Session Stats */}
          {stats && (
            <div className="mt-6 text-center text-white text-xs space-y-1 opacity-75">
              <div>Exchanges: {stats.exchanges}</div>
              <div>Stage: {stats.currentStage}</div>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-4 text-center text-white/60 text-xs">
            {callState === 'dialing' && "Connecting to prospect..."}
            {callState === 'connected' && !showManualInput && (
              micPermission === 'granted' 
                ? "Tap microphone to speak or use text input"
                : "Use text input to respond"
            )}
            {callState === 'connected' && showManualInput && "Type your response and press Send"}
            {callState === 'ended' && "Call completed"}
          </div>
        </div>
      </div>
    </div>
  );
};

// Voice Status Indicator Component
const VoiceStatusIndicator = ({ callState, isProcessing, getMicrophoneState }) => {
  const [micState, setMicState] = useState({ isListening: false, isSpeaking: false });

  useEffect(() => {
    const updateMicState = async () => {
      try {
        const state = await getMicrophoneState();
        setMicState(state);
      } catch (error) {
        setMicState({ isListening: false, isSpeaking: false });
      }
    };

    const interval = setInterval(updateMicState, 1000);
    updateMicState();

    return () => clearInterval(interval);
  }, [getMicrophoneState]);

  if (callState !== 'connected') {
    return (
      <div className="flex justify-center space-x-1">
        {[0, 1, 2].map(i => (
          <div 
            key={i}
            className="w-2 h-2 bg-white rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.1}s` }}
          />
        ))}
        <span className="ml-2 text-sm">Connecting...</span>
      </div>
    );
  }

  if (isProcessing) {
    return <p className="text-sm text-yellow-300">🤖 Processing your response...</p>;
  }

  if (micState.isSpeaking) {
    return <p className="text-sm text-blue-300">🗣️ AI is speaking...</p>;
  }

  if (micState.isListening) {
    return (
      <div className="flex items-center justify-center space-x-2">
        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
        <p className="text-sm text-red-300">Listening...</p>
      </div>
    );
  }

  return <p className="text-sm text-green-300">Ready to listen</p>;
};

// Microphone Button Component
const MicrophoneButton = ({ onClick, disabled, getMicrophoneState }) => {
  const [micState, setMicState] = useState({ isListening: false });

  useEffect(() => {
    const updateMicState = async () => {
      try {
        const state = await getMicrophoneState();
        setMicState(state);
      } catch (error) {
        setMicState({ isListening: false });
      }
    };

    const interval = setInterval(updateMicState, 500);
    updateMicState();

    return () => clearInterval(interval);
  }, [getMicrophoneState]);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg ${
        micState.isListening
          ? 'bg-red-600 hover:bg-red-700 animate-pulse scale-110' 
          : disabled
            ? 'bg-gray-600 cursor-not-allowed opacity-50'
            : 'bg-blue-600 hover:bg-blue-700 hover:scale-105'
      }`}
      title={micState.isListening ? 'Listening...' : 'Start speaking'}
    >
      {micState.isListening ? (
        <MicOff className="w-8 h-8 text-white" />
      ) : (
        <Mic className="w-8 h-8 text-white" />
      )}
    </button>
  );
};

// Session Results Component
const SessionResults = ({ results, onContinue, onRetry }) => {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getResultData = () => {
    if (results.passed) {
      return { 
        color: 'green', 
        icon: '🌟', 
        title: 'Great Job!',
        message: 'You passed this roleplay!'
      };
    }
    return { 
      color: 'red', 
      icon: '📈', 
      title: 'Keep Practicing!',
      message: 'You\'re improving - try again!'
    };
  };

  const result = getResultData();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className={`bg-${result.color}-500 text-white p-8 text-center`}>
            <div className="text-6xl mb-4">{result.icon}</div>
            <h1 className="text-2xl font-bold mb-2">{result.title}</h1>
            <p className="text-lg opacity-90">{result.message}</p>
          </div>

          {/* Stats */}
          <div className="p-6">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <div className="text-xl font-bold text-gray-900">{formatTime(results.duration)}</div>
                <div className="text-xs text-gray-600">Duration</div>
              </div>
              <div className="text-center">
                <div className={`text-xl font-bold text-${result.color}-600`}>
                  {results.metrics?.averageScore?.toFixed(1) || 'N/A'}
                </div>
                <div className="text-xs text-gray-600">Avg Score</div>
              </div>
              <div className="text-center">
                <div className={`text-xl font-bold text-${result.color}-600`}>
                  {results.passed ? 'PASS' : 'RETRY'}
                </div>
                <div className="text-xs text-gray-600">Result</div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={onRetry}
                className="w-full bg-gray-600 text-white py-3 px-6 rounded-lg hover:bg-gray-700 transition-colors"
              >
                🔄 Try Again
              </button>
              <button
                onClick={onContinue}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
              >
                📚 Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedPhoneInterface;