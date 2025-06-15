// src/components/roleplay/MobilePhoneInterface.jsx - MOBILE-OPTIMIZED VERSION
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoleplay } from '../../contexts/RoleplayContext';
import { useVoice } from '../../hooks/useVoice';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, MessageCircle } from 'lucide-react';
import logger from '../../utils/logger';

const MobilePhoneInterface = () => {
  const { type, mode } = useParams();
  const navigate = useNavigate();
  
  // Roleplay context
  const {
    currentSession,
    callState,
    sessionResults,
    isProcessing,
    startRoleplaySession,
    endSession,
    resetSession,
    getSessionStats,
    conversation,
    conversationActive,
    handleUserResponse
  } = useRoleplay();

  // Voice context
  const {
    isListening,
    isSpeaking,
    isInitialized: voiceInitialized,
    error: voiceError,
    startListening,
    stopListening,
    speakText,
    stopSpeaking,
    voiceService
  } = useVoice();

  // Mobile-specific state
  const [isInitializing, setIsInitializing] = useState(true);
  const [callTimer, setCallTimer] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [isMobile, setIsMobile] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [isPushToTalk, setIsPushToTalk] = useState(false);
  const [micButtonPressed, setMicButtonPressed] = useState(false);

  // Refs for mobile interaction
  const micButtonRef = useRef(null);
  const interactionDetectedRef = useRef(false);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const mobileCheck = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      setIsMobile(mobileCheck);
      setIsPushToTalk(mobileCheck); // Enable push-to-talk on mobile by default
      logger.log(`📱 Device detected: ${mobileCheck ? 'MOBILE' : 'DESKTOP'}`);
    };
    
    checkMobile();
  }, []);

  // Initialize roleplay session on mount
  useEffect(() => {
    const initializeSession = async () => {
      try {
        setIsInitializing(true);
        logger.log('🎬 Initializing mobile roleplay session:', { type, mode });

        // Generate character for session
        const character = {
          name: 'Sarah Mitchell',
          title: 'VP of Marketing',
          company: 'TechCorp Solutions',
          personality: 'professional, busy, skeptical'
        };

        // Start the roleplay session
        await startRoleplaySession(type, mode, { character });
        
        logger.log('✅ Mobile roleplay session started successfully');
        
      } catch (error) {
        logger.error('❌ Failed to initialize mobile roleplay session:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    if (type && mode) {
      initializeSession();
    }

    // Cleanup on unmount
    return () => {
      if (currentSession) {
        endSession('component_unmount');
      }
      resetSession();
    };
  }, [type, mode]);

  // Call timer effect
  useEffect(() => {
    let interval = null;
    
    if (callState === 'connected') {
      interval = setInterval(() => {
        setCallTimer(prev => prev + 1);
      }, 1000);
    } else {
      setCallTimer(0);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [callState]);

  // Mobile interaction detection
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (!interactionDetectedRef.current) {
        interactionDetectedRef.current = true;
        logger.log('📱 First mobile interaction detected');
      }
    };

    if (isMobile) {
      document.addEventListener('touchstart', handleFirstInteraction, { once: true });
      document.addEventListener('click', handleFirstInteraction, { once: true });
    }

    return () => {
      document.removeEventListener('touchstart', handleFirstInteraction);
      document.removeEventListener('click', handleFirstInteraction);
    };
  }, [isMobile]);

  // Format timer display
  const formatTimer = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Handle hang up
  const handleHangUp = useCallback(() => {
    logger.log('📞 User initiated hang up');
    stopListening();
    stopSpeaking();
    endSession('user_hangup');
    navigate('/dashboard');
  }, [endSession, navigate, stopListening, stopSpeaking]);

  // Mobile-specific microphone handling
  const handleMicrophonePress = useCallback(async () => {
    if (!interactionDetectedRef.current) {
      logger.warn('📱 User interaction required first');
      return;
    }

    try {
      if (isPushToTalk) {
        // Push-to-talk mode
        if (!micButtonPressed) {
          logger.log('📱 Starting push-to-talk');
          setMicButtonPressed(true);
          await startListening({
            onResult: (transcript, confidence) => {
              logger.log('📱 Push-to-talk result:', transcript);
              if (transcript.trim().length > 2) {
                handleUserResponse(transcript);
              }
            },
            onError: (error) => {
              logger.error('📱 Push-to-talk error:', error);
              setMicButtonPressed(false);
            }
          });
        }
      } else {
        // Toggle mode
        if (isListening) {
          stopListening();
        } else {
          await startListening({
            onResult: (transcript, confidence) => {
              logger.log('📱 Voice result:', transcript);
              if (transcript.trim().length > 2) {
                handleUserResponse(transcript);
              }
            },
            onError: (error) => {
              logger.error('📱 Voice error:', error);
            }
          });
        }
      }
    } catch (error) {
      logger.error('📱 Microphone error:', error);
      setMicButtonPressed(false);
    }
  }, [isPushToTalk, micButtonPressed, isListening, startListening, stopListening, handleUserResponse]);

  const handleMicrophoneRelease = useCallback(() => {
    if (isPushToTalk && micButtonPressed) {
      logger.log('📱 Ending push-to-talk');
      setMicButtonPressed(false);
      stopListening();
    }
  }, [isPushToTalk, micButtonPressed, stopListening]);

  // Handle manual text input
  const handleManualSubmit = useCallback(() => {
    if (manualInput.trim()) {
      logger.log('📱 Manual input submitted:', manualInput);
      handleUserResponse(manualInput.trim());
      setManualInput('');
      setShowManualInput(false);
    }
  }, [manualInput, handleUserResponse]);

  // Handle mute toggle
  const handleMuteToggle = useCallback(() => {
    setIsMuted(prev => !prev);
    if (isMuted) {
      // Unmute
      logger.log('📱 Unmuting');
    } else {
      // Mute
      logger.log('📱 Muting');
      stopListening();
    }
  }, [isMuted, stopListening]);

  // Handle volume toggle
  const handleVolumeToggle = useCallback(() => {
    const newVolume = volume > 0 ? 0 : 1.0;
    setVolume(newVolume);
    if (newVolume === 0) {
      stopSpeaking();
    }
  }, [volume, stopSpeaking]);

  // Get call status display
  const getCallStatus = useCallback(() => {
    switch (callState) {
      case 'idle':
        return 'Ready';
      case 'dialing':
        return 'Dialing...';
      case 'connected':
        return 'Connected';
      case 'ended':
        return 'Call Ended';
      default:
        return 'Unknown';
    }
  }, [callState]);

  // Get voice status display
  const getVoiceStatus = useCallback(() => {
    if (voiceError) {
      return `Error: ${voiceError}`;
    }
    
    if (!voiceInitialized) {
      return 'Initializing...';
    }
    
    if (isProcessing) {
      return 'Processing...';
    }
    
    if (isSpeaking) {
      return 'AI is speaking...';
    }
    
    if (isListening) {
      return isPushToTalk ? 'Recording...' : 'Listening...';
    }
    
    if (isMuted) {
      return 'Muted';
    }
    
    if (conversationActive) {
      return isMobile ? 'Tap mic to speak' : 'Your turn to speak';
    }
    
    return 'Ready';
  }, [voiceError, voiceInitialized, isProcessing, isSpeaking, isListening, isMuted, conversationActive, isMobile, isPushToTalk]);

  // Get character info
  const getCharacterInfo = useCallback(() => {
    if (currentSession?.character) {
      return currentSession.character;
    }
    return {
      name: 'Loading...',
      title: '',
      company: ''
    };
  }, [currentSession]);

  // Show loading state
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl">Initializing mobile roleplay...</p>
          {isMobile && (
            <p className="text-sm mt-2 text-blue-200">Optimized for mobile</p>
          )}
        </div>
      </div>
    );
  }

  const character = getCharacterInfo();
  const stats = getSessionStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900">
      {/* Header */}
      <div className="p-4 text-center text-white">
        <h1 className="text-xl font-bold mb-1">
          {type.replace('_', ' ').toUpperCase()}
        </h1>
        <p className="text-sm text-blue-200">{mode.toUpperCase()} Mode</p>
        {isMobile && (
          <div className="text-xs text-yellow-300 mt-1">
            📱 Mobile optimized - {isPushToTalk ? 'Push to talk' : 'Tap to toggle'}
          </div>
        )}
      </div>

      {/* Phone Interface */}
      <div className="flex justify-center px-4">
        <div className="bg-black rounded-3xl p-4 w-full max-w-sm shadow-2xl">
          
          {/* Status Bar */}
          <div className="text-white text-center mb-4">
            <div className="text-sm opacity-75 mb-1">{getCallStatus()}</div>
            <div className="text-xl font-mono">{formatTimer(callTimer)}</div>
          </div>

          {/* Contact Info */}
          <div className="text-center text-white mb-4">
            <div className="w-20 h-20 bg-gray-600 rounded-full mx-auto mb-2 flex items-center justify-center">
              <span className="text-xl font-bold">
                {character.name ? character.name.charAt(0) : '?'}
              </span>
            </div>
            <h2 className="text-lg font-semibold">{character.name}</h2>
            <p className="text-xs opacity-75">{character.title}</p>
            <p className="text-xs opacity-60">{character.company}</p>
          </div>

          {/* Voice Status */}
          <div className="text-center text-white mb-4">
            <div className="bg-gray-800 rounded-lg p-2 mb-2">
              <p className="text-sm">{getVoiceStatus()}</p>
            </div>
            
            {/* Voice Visualizer */}
            <div className="flex justify-center space-x-1 h-6 items-end">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 bg-blue-400 rounded-full transition-all duration-150 ${
                    isListening 
                      ? 'animate-pulse h-4' 
                      : isSpeaking 
                        ? 'h-5' 
                        : 'h-1'
                  }`}
                  style={{
                    animationDelay: `${i * 100}ms`
                  }}
                />
              ))}
            </div>
          </div>

          {/* Mobile Controls */}
          <div className="space-y-3 mb-4">
            {/* Large Microphone Button */}
            <div className="flex justify-center">
              <button
                ref={micButtonRef}
                onTouchStart={handleMicrophonePress}
                onTouchEnd={handleMicrophoneRelease}
                onClick={!isMobile ? handleMicrophonePress : undefined}
                disabled={isMuted || isSpeaking}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 ${
                  isListening || micButtonPressed
                    ? 'bg-red-600 hover:bg-red-700 animate-pulse' 
                    : isMuted
                      ? 'bg-gray-600'
                      : 'bg-blue-600 hover:bg-blue-700'
                } disabled:opacity-50 disabled:cursor-not-allowed shadow-lg`}
              >
                <Mic className="w-8 h-8 text-white" />
              </button>
            </div>

            {/* Instruction Text */}
            <div className="text-center text-white text-xs">
              {isMobile ? (
                isPushToTalk ? 
                  'Hold to speak' : 
                  'Tap to start/stop recording'
              ) : (
                'Click to speak'
              )}
            </div>

            {/* Alternative Input Options */}
            <div className="flex justify-center space-x-2">
              <button
                onClick={() => setShowManualInput(!showManualInput)}
                className="px-3 py-1 bg-gray-700 text-white rounded-full text-xs hover:bg-gray-600"
              >
                <MessageCircle className="w-3 h-3 inline mr-1" />
                Type
              </button>
              
              {isMobile && (
                <button
                  onClick={() => setIsPushToTalk(!isPushToTalk)}
                  className="px-3 py-1 bg-gray-700 text-white rounded-full text-xs hover:bg-gray-600"
                >
                  {isPushToTalk ? 'Push-to-talk' : 'Tap mode'}
                </button>
              )}
            </div>

            {/* Manual Input */}
            {showManualInput && (
              <div className="space-y-2">
                <textarea
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Type your response..."
                  className="w-full p-2 bg-gray-800 text-white rounded text-sm"
                  rows={3}
                />
                <div className="flex space-x-2">
                  <button
                    onClick={handleManualSubmit}
                    disabled={!manualInput.trim()}
                    className="flex-1 bg-blue-600 text-white py-1 px-3 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    Send
                  </button>
                  <button
                    onClick={() => {
                      setShowManualInput(false);
                      setManualInput('');
                    }}
                    className="bg-gray-600 text-white py-1 px-3 rounded text-sm hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Controls */}
          <div className="flex justify-center space-x-4 mb-4">
            {/* Mute Button */}
            <button
              onClick={handleMuteToggle}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                isMuted 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {isMuted ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
            </button>

            {/* Volume Button */}
            <button
              onClick={handleVolumeToggle}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                volume === 0 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {volume === 0 ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
            </button>
          </div>

          {/* Hang Up Button */}
          <div className="flex justify-center mb-4">
            <button
              onClick={handleHangUp}
              className="w-14 h-14 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition-colors shadow-lg"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Session Stats */}
          {stats && (
            <div className="text-center text-white text-xs space-y-1">
              <div>Duration: {Math.floor(stats.duration / 60)}:{(stats.duration % 60).toString().padStart(2, '0')}</div>
              <div>Exchanges: {stats.exchanges}</div>
            </div>
          )}

          {/* Mobile Debug Info */}
          {process.env.NODE_ENV === 'development' && isMobile && (
            <div className="mt-2 text-xs text-gray-400 space-y-1 text-center">
              <div>📱 Mobile Mode: {isPushToTalk ? 'Push-to-talk' : 'Toggle'}</div>
              <div>Interaction: {interactionDetectedRef.current ? '✅' : '❌'}</div>
              <div>Voice: {voiceInitialized ? '✅' : '❌'}</div>
              <div>Listening: {isListening ? '✅' : '❌'}</div>
              <div>Speaking: {isSpeaking ? '✅' : '❌'}</div>
            </div>
          )}
        </div>
      </div>

      {/* Session Results Modal */}
      {sessionResults && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-screen overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Session Complete</h3>
            
            <div className="space-y-3 mb-6">
              <div>Duration: {Math.floor(sessionResults.duration / 60)}:{(sessionResults.duration % 60).toString().padStart(2, '0')}</div>
              <div>Exchanges: {Math.floor(sessionResults.conversation.length / 2)}</div>
              <div>Result: {sessionResults.passed ? '✅ Passed' : '❌ Failed'}</div>
            </div>

            {sessionResults.coaching && (
              <div className="mb-6">
                <h4 className="font-semibold mb-2">Coaching Feedback:</h4>
                <div className="text-sm space-y-2">
                  <div><strong>Sales:</strong> {sessionResults.coaching.sales}</div>
                  <div><strong>Grammar:</strong> {sessionResults.coaching.grammar}</div>
                  <div><strong>Vocabulary:</strong> {sessionResults.coaching.vocabulary}</div>
                  <div><strong>Pronunciation:</strong> {sessionResults.coaching.pronunciation}</div>
                </div>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex-1 bg-gray-600 text-white py-2 px-4 rounded hover:bg-gray-700"
              >
                Dashboard
              </button>
              <button
                onClick={() => {
                  resetSession();
                  window.location.reload();
                }}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobilePhoneInterface;