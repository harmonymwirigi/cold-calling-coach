// src/components/roleplay/FixedPhoneInterface.jsx - COMPLETE WORKING VERSION
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoleplay } from '../../contexts/RoleplayContext';
import { useVoice } from '../../hooks/useVoice';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import logger from '../../utils/logger';

const FixedPhoneInterface = () => {
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
    conversationActive
  } = useRoleplay();

  // Voice context
  const {
    isListening,
    isSpeaking,
    isInitialized: voiceInitialized,
    error: voiceError,
    initializeVoiceService,
    startListening,
    stopListening,
    speakText,
    stopSpeaking
  } = useVoice();

  // Local state
  const [isInitializing, setIsInitializing] = useState(true);
  const [callTimer, setCallTimer] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1.0);

  // Initialize roleplay session on mount
  useEffect(() => {
    const initializeSession = async () => {
      try {
        setIsInitializing(true);
        logger.log('🎬 Initializing roleplay session:', { type, mode });

        // Generate character for session
        const character = {
          name: 'Sarah Mitchell',
          title: 'VP of Marketing',
          company: 'TechCorp Solutions',
          personality: 'professional, busy, skeptical'
        };

        // Start the roleplay session
        await startRoleplaySession(type, mode, { character });
        
        logger.log('✅ Roleplay session started successfully');
        
      } catch (error) {
        logger.error('❌ Failed to initialize roleplay session:', error);
        // Don't navigate away, show error state instead
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
  }, [type, mode]); // Only depend on route params

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

  // Format timer display
  const formatTimer = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Handle hang up
  const handleHangUp = useCallback(() => {
    logger.log('📞 User initiated hang up');
    endSession('user_hangup');
    navigate('/dashboard');
  }, [endSession, navigate]);

  // Handle mute toggle
  const handleMuteToggle = useCallback(() => {
    setIsMuted(prev => !prev);
    if (isMuted) {
      // Unmute - resume listening if conversation is active
      if (conversationActive && !isListening) {
        startListening();
      }
    } else {
      // Mute - stop listening
      stopListening();
    }
  }, [isMuted, conversationActive, isListening, startListening, stopListening]);

  // Handle volume toggle
  const handleVolumeToggle = useCallback(() => {
    const newVolume = volume > 0 ? 0 : 1.0;
    setVolume(newVolume);
    // Could integrate with voice service volume control here
  }, [volume]);

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
      return 'Initializing voice...';
    }
    
    if (isProcessing) {
      return 'Processing...';
    }
    
    if (isSpeaking) {
      return 'AI is speaking...';
    }
    
    if (isListening) {
      return 'Listening...';
    }
    
    if (isMuted) {
      return 'Muted';
    }
    
    if (conversationActive) {
      return 'Your turn to speak';
    }
    
    return 'Ready';
  }, [voiceError, voiceInitialized, isProcessing, isSpeaking, isListening, isMuted, conversationActive]);

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
          <p className="text-xl">Initializing roleplay...</p>
        </div>
      </div>
    );
  }

  const character = getCharacterInfo();
  const stats = getSessionStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900">
      {/* Header */}
      <div className="p-6 text-center text-white">
        <h1 className="text-2xl font-bold mb-2">
          {type.replace('_', ' ').toUpperCase()} - {mode.toUpperCase()}
        </h1>
        <p className="text-blue-200">Practice your cold calling skills</p>
      </div>

      {/* Phone Interface */}
      <div className="flex justify-center px-4">
        <div className="bg-black rounded-3xl p-6 w-full max-w-sm shadow-2xl">
          
          {/* Status Bar */}
          <div className="text-white text-center mb-6">
            <div className="text-sm opacity-75 mb-1">{getCallStatus()}</div>
            <div className="text-2xl font-mono">{formatTimer(callTimer)}</div>
          </div>

          {/* Contact Info */}
          <div className="text-center text-white mb-6">
            <div className="w-24 h-24 bg-gray-600 rounded-full mx-auto mb-3 flex items-center justify-center">
              <span className="text-2xl font-bold">
                {character.name ? character.name.charAt(0) : '?'}
              </span>
            </div>
            <h2 className="text-xl font-semibold">{character.name}</h2>
            <p className="text-sm opacity-75">{character.title}</p>
            <p className="text-xs opacity-60">{character.company}</p>
          </div>

          {/* Voice Status */}
          <div className="text-center text-white mb-6">
            <div className="bg-gray-800 rounded-lg p-3 mb-2">
              <p className="text-sm">{getVoiceStatus()}</p>
            </div>
            
            {/* Voice Visualizer */}
            <div className="flex justify-center space-x-1 h-8 items-end">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`w-2 bg-blue-400 rounded-full transition-all duration-150 ${
                    isListening 
                      ? 'animate-pulse h-4' 
                      : isSpeaking 
                        ? 'h-6' 
                        : 'h-2'
                  }`}
                  style={{
                    animationDelay: `${i * 100}ms`
                  }}
                />
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-center space-x-6 mb-6">
            {/* Mute Button */}
            <button
              onClick={handleMuteToggle}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                isMuted 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {isMuted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
            </button>

            {/* Volume Button */}
            <button
              onClick={handleVolumeToggle}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                volume === 0 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {volume === 0 ? <VolumeX className="w-6 h-6 text-white" /> : <Volume2 className="w-6 h-6 text-white" />}
            </button>
          </div>

          {/* Hang Up Button */}
          <div className="flex justify-center">
            <button
              onClick={handleHangUp}
              className="w-16 h-16 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition-colors shadow-lg"
            >
              <PhoneOff className="w-8 h-8 text-white" />
            </button>
          </div>

          {/* Session Stats */}
          {stats && (
            <div className="mt-6 text-center text-white text-xs space-y-1">
              <div>Duration: {Math.floor(stats.duration / 60)}:{(stats.duration % 60).toString().padStart(2, '0')}</div>
              <div>Exchanges: {stats.exchanges}</div>
              <div>Stage: {stats.currentStage}</div>
            </div>
          )}

          {/* Debug Info (development only) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 text-xs text-gray-400 space-y-1">
              <div>Voice Init: {voiceInitialized ? '✅' : '❌'}</div>
              <div>Listening: {isListening ? '✅' : '❌'}</div>
              <div>Speaking: {isSpeaking ? '✅' : '❌'}</div>
              <div>Conversation: {conversationActive ? '✅' : '❌'}</div>
              <div>Processing: {isProcessing ? '✅' : '❌'}</div>
              {conversation && <div>Messages: {conversation.length}</div>}
            </div>
          )}
        </div>
      </div>

      {/* Session Results Modal */}
      {sessionResults && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
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
                Back to Dashboard
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

export default FixedPhoneInterface;