// src/components/roleplay/UnifiedPhoneInterface.jsx - FIXED CONVERSATION STARTUP
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, MessageCircle, ArrowLeft, Clock, Star, Trophy } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRoleplay } from '../../contexts/RoleplayContext';
import { useProgress } from '../../contexts/ProgressContext';
import logger from '../../utils/logger';

const UnifiedPhoneInterface = () => {
  const { type, mode } = useParams();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { canAccessRoleplay } = useProgress();
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
    currentStage,
    callCount,
    passCount,
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
  const [isHangingUp, setIsHangingUp] = useState(false);
  const [accessInfo, setAccessInfo] = useState(null);
  const [voiceReady, setVoiceReady] = useState(false);

  // Refs
  const durationInterval = useRef(null);
  const initializationAttempted = useRef(false);
  const hangupAttempted = useRef(false);
  const voiceServiceRef = useRef(null);

  // Initialize voice service reference
  useEffect(() => {
    const initVoiceService = async () => {
      try {
        const { voiceService } = await import('../../services/voiceService');
        voiceServiceRef.current = voiceService;
        setVoiceReady(true);
        logger.log('🎤 Voice service reference set');
      } catch (error) {
        logger.error('❌ Failed to load voice service:', error);
      }
    };

    initVoiceService();
  }, []);

  // Handle user speech with proper callback
  const handleUserSpeech = useCallback(async (transcript, confidence) => {
    logger.log('🗣️ [PHONE] User speech received:', transcript);
    
    if (!currentSession || callState !== 'connected' || isProcessing) {
      logger.log('⚠️ [PHONE] Ignoring speech - session not ready');
      return;
    }

    try {
      await handleUserResponse(transcript);
      logger.log('✅ [PHONE] User speech processed successfully');
    } catch (error) {
      logger.error('❌ [PHONE] Error processing user speech:', error);
      setError('Failed to process your message. Please try again.');
    }
  }, [currentSession, callState, isProcessing, handleUserResponse]);

  // Handle voice errors
  const handleVoiceError = useCallback((error) => {
    logger.error('🎤 [PHONE] Voice error:', error);
    setError('Voice recognition error. Please try speaking again or use text input.');
  }, []);

  // Initialize roleplay session
  useEffect(() => {
    if (initializationAttempted.current || !voiceReady) return;
    initializationAttempted.current = true;

    const initializeRoleplay = async () => {
      try {
        setIsInitializing(true);
        setError('');
        hangupAttempted.current = false;

        logger.log('🚀 [PHONE] Initializing roleplay:', { type, mode });

        // Check access first
        const accessCheck = await canAccessRoleplay(type, mode);
        setAccessInfo(accessCheck.accessInfo);
        
        if (!accessCheck.allowed) {
          throw new Error(accessCheck.reason || 'Access denied to this roleplay');
        }

        // Start the roleplay session
        await startRoleplaySession(type, mode, {
          userProfile,
          deviceType,
          accessInfo: accessCheck.accessInfo
        });

        logger.log('✅ [PHONE] Roleplay initialized successfully');

      } catch (error) {
        logger.error('❌ [PHONE] Error initializing roleplay:', error);
        setError(error.message || 'Failed to start roleplay. Please try again.');
      } finally {
        setIsInitializing(false);
      }
    };

    initializeRoleplay();
  }, [type, mode, startRoleplaySession, canAccessRoleplay, userProfile, deviceType, voiceReady]);

  // FIXED: Start voice conversation after AI speaks
  useEffect(() => {
    if (callState === 'connected' && currentMessage && voiceServiceRef.current && !isProcessing) {
      // Wait a bit after AI speaks, then start listening
      const timer = setTimeout(async () => {
        if (callState === 'connected' && !isHangingUp && !isProcessing) {
          logger.log('🎤 [PHONE] Starting voice conversation after AI response');
          
          try {
            const success = voiceServiceRef.current.startConversation(
              handleUserSpeech,
              handleVoiceError
            );
            
            if (success) {
              logger.log('✅ [PHONE] Voice conversation started successfully');
            } else {
              logger.warn('⚠️ [PHONE] Failed to start voice conversation');
            }
          } catch (error) {
            logger.error('❌ [PHONE] Error starting voice conversation:', error);
          }
        }
      }, 1500); // Wait 1.5 seconds after AI speaks

      return () => clearTimeout(timer);
    }
  }, [callState, currentMessage, isProcessing, isHangingUp, handleUserSpeech, handleVoiceError]);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      logger.log('🧹 [PHONE] Component unmounting, cleaning up...');
      if (currentSession && !hangupAttempted.current) {
        hangupAttempted.current = true;
        endSession('component_unmount');
      }
      resetSession();
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
      if (voiceServiceRef.current) {
        voiceServiceRef.current.stopConversation();
      }
    };
  }, [currentSession, endSession, resetSession]);

  // Handle microphone button click
  const handleMicClick = useCallback(async () => {
    logger.log('🎤 [PHONE] Microphone button clicked');

    if (!voiceServiceRef.current) {
      setError('Voice service not available');
      return;
    }

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
      
      if (voiceServiceRef.current.isListening) {
        logger.log('Stopping listening...');
        voiceServiceRef.current.stopListening();
      } else {
        logger.log('Starting listening...');
        const started = voiceServiceRef.current.startListening();
        if (!started) {
          setError('Failed to start microphone. Try the text input option.');
        }
      }
    } catch (error) {
      logger.error('❌ [PHONE] Microphone error:', error);
      setError('Microphone not available. Please use text input or check your browser permissions.');
    }
  }, [micPermission, callState, isProcessing]);

  // Handle manual text input
  const handleManualSubmit = useCallback(async () => {
    if (!manualInput.trim()) return;

    try {
      setError('');
      logger.log('📝 [PHONE] Manual input:', manualInput);
      
      await handleUserResponse(manualInput.trim());
      setManualInput('');
      setShowManualInput(false);
    } catch (error) {
      logger.error('❌ [PHONE] Error with manual input:', error);
      setError('Failed to process your message. Please try again.');
    }
  }, [manualInput, handleUserResponse]);

  // Handle hangup
  const handleHangUp = useCallback(async () => {
    if (hangupAttempted.current || isHangingUp) {
      logger.log('⚠️ [PHONE] Hangup already in progress');
      return;
    }

    try {
      hangupAttempted.current = true;
      setIsHangingUp(true);
      
      logger.log('📞 [PHONE] Hangup button clicked - starting cleanup');
      
      // Stop voice service immediately
      if (voiceServiceRef.current) {
        logger.log('🔇 [PHONE] Stopping voice service immediately');
        voiceServiceRef.current.stopConversation();
        voiceServiceRef.current.stopSpeaking();
        voiceServiceRef.current.stopListening();
      }

      // End the session
      if (endSession) {
        logger.log('📞 [PHONE] Ending session...');
        const sessionResult = await endSession('user_hangup');
        logger.log('📞 [PHONE] Session ended, result:', sessionResult);
      }
      
      // Navigate back to dashboard
      logger.log('📞 [PHONE] Navigating to dashboard');
      navigate('/dashboard');
      
    } catch (error) {
      logger.error('❌ [PHONE] Error in hangup handler:', error);
      navigate('/dashboard');
    } finally {
      setIsHangingUp(false);
    }
  }, [endSession, navigate, isHangingUp]);

  // Get microphone state
  const getMicrophoneState = useCallback(async () => {
    try {
      if (voiceServiceRef.current) {
        return voiceServiceRef.current.getState();
      }
      return { isListening: false, isSpeaking: false };
    } catch (error) {
      return { isListening: false, isSpeaking: false };
    }
  }, []);

  // Rest of the component remains the same...
  // [Include all the existing render logic, but with the fixes above]

  // Show loading state
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Starting Roleplay</h2>
          <p className="text-blue-200">Setting up your practice session...</p>
          <p className="text-sm text-blue-300 mt-2">Device: {deviceType}</p>
          {accessInfo && (
            <p className="text-xs text-blue-400 mt-1">Access Level: {accessInfo.accessLevel}</p>
          )}
        </div>
      </div>
    );
  }

  // Show session results
  if (sessionResults) {
    return <SessionResults 
      results={sessionResults} 
      onContinue={() => navigate('/dashboard')}
      onRetry={() => window.location.reload()}
    />;
  }

  const character = currentSession?.character || { 
    name: 'Sarah Mitchell', 
    title: 'VP of Marketing', 
    company: 'TechCorp Solutions' 
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900">
      {/* Header */}
      <div className="p-4 flex items-center justify-between text-white">
        <button
          onClick={() => navigate('/dashboard')}
          disabled={isHangingUp}
          className="flex items-center space-x-2 text-white/80 hover:text-white transition-colors disabled:opacity-50"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        
        <div className="text-center">
          <h1 className="font-semibold">{type.replace('_', ' ').toUpperCase()}</h1>
          <p className="text-sm opacity-80">{mode.toUpperCase()} MODE</p>
        </div>
        
        <div className="w-16" />
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

      {/* Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-yellow-600 text-white p-2 text-center text-xs">
          Debug: {callState} | Stage: {currentStage} | Processing: {isProcessing ? 'yes' : 'no'} | Voice Ready: {voiceReady ? 'yes' : 'no'}
        </div>
      )}

      {/* Main Phone Interface */}
      <div className="flex justify-center px-4">
        <div className="bg-black/80 backdrop-blur rounded-3xl p-6 w-full max-w-md shadow-2xl">
          
          {/* Call Status */}
          <div className="text-center text-white mb-6">
            <div className="text-lg font-mono mb-1">
              {isHangingUp ? 'Ending Call...' : 
               callState === 'idle' ? 'Ready' :
               callState === 'dialing' ? 'Connecting...' :
               callState === 'connected' ? `Connected • ${Math.floor(callDuration / 60)}:${(callDuration % 60).toString().padStart(2, '0')}` :
               callState === 'ended' ? 'Call Ended' : 'Unknown'}
            </div>
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
          {currentMessage && callState === 'connected' && !isHangingUp && (
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
              isHangingUp={isHangingUp}
              getMicrophoneState={getMicrophoneState}
            />
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {/* Primary Microphone Button */}
            {callState === 'connected' && !isHangingUp && (
              <div className="flex justify-center">
                <MicrophoneButton 
                  onClick={handleMicClick}
                  disabled={isProcessing || isMuted || isHangingUp}
                  getMicrophoneState={getMicrophoneState}
                />
              </div>
            )}

            {/* Secondary Controls */}
            {!isHangingUp && callState === 'connected' && (
              <div className="flex justify-center space-x-4">
                {/* Text Input Toggle */}
                <button
                  onClick={() => setShowManualInput(!showManualInput)}
                  disabled={isHangingUp}
                  className="w-12 h-12 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-full flex items-center justify-center transition-colors"
                  title="Type response"
                >
                  <MessageCircle className="w-5 h-5 text-white" />
                </button>

                {/* Mute Toggle */}
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  disabled={isHangingUp}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 ${
                    isMuted 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
                </button>
              </div>
            )}

            {/* Manual Input */}
            {showManualInput && !isHangingUp && (
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
                    disabled={!manualInput.trim() || isProcessing || isHangingUp}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Send Response
                  </button>
                  <button
                    onClick={() => {
                      setShowManualInput(false);
                      setManualInput('');
                    }}
                    disabled={isHangingUp}
                    className="bg-gray-600 text-white py-2 px-4 rounded-lg text-sm hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Hangup Button */}
            <div className="flex justify-center pt-4">
              <button
                onClick={handleHangUp}
                disabled={callState === 'ended' || isHangingUp}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors shadow-lg ${
                  isHangingUp 
                    ? 'bg-gray-600 cursor-not-allowed opacity-50' 
                    : 'bg-red-600 hover:bg-red-700 disabled:opacity-50'
                }`}
                title={isHangingUp ? 'Ending Call...' : 'End Call'}
              >
                {isHangingUp ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <PhoneOff className="w-8 h-8 text-white" />
                )}
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-4 text-center text-white/60 text-xs">
            {isHangingUp && "Ending call..."}
            {!isHangingUp && callState === 'dialing' && "Connecting to prospect..."}
            {!isHangingUp && callState === 'connected' && !showManualInput && (
              micPermission === 'granted' 
                ? "Tap microphone to speak or use text input"
                : "Use text input to respond"
            )}
            {!isHangingUp && callState === 'connected' && showManualInput && "Type your response and press Send"}
            {!isHangingUp && callState === 'ended' && "Call completed"}
          </div>
        </div>
      </div>
    </div>
  );
};

// Voice Status Indicator Component
const VoiceStatusIndicator = ({ callState, isProcessing, isHangingUp, getMicrophoneState }) => {
  const [micState, setMicState] = useState({ isListening: false, isSpeaking: false });

  useEffect(() => {
    if (isHangingUp) return;

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
  }, [getMicrophoneState, isHangingUp]);

  if (isHangingUp) {
    return <p className="text-sm text-red-300">📞 Ending call...</p>;
  }

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
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          <div className="bg-blue-500 text-white p-8 text-center">
            <div className="text-6xl mb-4">🌟</div>
            <h1 className="text-2xl font-bold mb-2">Session Complete!</h1>
            <p className="text-lg opacity-90">Great job practicing!</p>
          </div>

          <div className="p-6">
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