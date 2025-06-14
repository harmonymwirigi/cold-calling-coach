// src/components/debug/DebugPanel.jsx - Helpful for development and troubleshooting
import React, { useState, useEffect } from 'react';
import { useVoice } from '../../hooks/useVoice';
import { useRoleplay } from '../../contexts/RoleplayContext';
import { openAIService } from '../../services/openaiService';
import { AlertCircle, CheckCircle, Mic, Volume2, Brain, Database } from 'lucide-react';

const DebugPanel = ({ show = false }) => {
  const { 
    isListening, 
    isSpeaking, 
    isInitialized, 
    error: voiceError,
    getVoiceState,
    voiceService 
  } = useVoice();
  
  const { 
    currentSession, 
    callState, 
    isProcessing,
    conversation,
    evaluations 
  } = useRoleplay();

  const [debugInfo, setDebugInfo] = useState({
    voiceService: {},
    openAI: {},
    browser: {},
    aws: {}
  });

  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const updateDebugInfo = () => {
      const voiceState = voiceService ? voiceService.getState() : {};
      
      setDebugInfo({
        voiceService: {
          initialized: voiceState.isInitialized || false,
          listening: voiceState.isListening || false,
          speaking: voiceState.isSpeaking || false,
          pollyEnabled: voiceState.pollyEnabled || false,
          hasAudioContext: voiceState.hasAudioContext || false
        },
        openAI: {
          initialized: openAIService?.isInitialized || false,
          currentStage: openAIService?.currentStage || 'unknown',
          conversationLength: openAIService?.conversationHistory?.length || 0,
          usedObjections: openAIService?.usedObjections?.size || 0
        },
        browser: {
          speechRecognition: 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window,
          speechSynthesis: 'speechSynthesis' in window,
          mediaDevices: 'mediaDevices' in navigator,
          audioContext: 'AudioContext' in window || 'webkitAudioContext' in window,
          userAgent: navigator.userAgent
        },
        aws: {
          hasCredentials: !!(process.env.REACT_APP_AWS_ACCESS_KEY_ID && process.env.REACT_APP_AWS_SECRET_ACCESS_KEY),
          region: process.env.REACT_APP_AWS_REGION || 'not set',
          voiceId: process.env.REACT_APP_AWS_POLLY_VOICE_ID || 'not set'
        },
        session: {
          active: !!currentSession,
          callState: callState,
          roleplayType: currentSession?.roleplayType || 'none',
          mode: currentSession?.mode || 'none',
          conversationCount: conversation?.length || 0,
          evaluationCount: evaluations?.length || 0
        }
      });
    };

    updateDebugInfo();
    const interval = setInterval(updateDebugInfo, 1000);
    return () => clearInterval(interval);
  }, [voiceService, currentSession, callState, conversation, evaluations]);

  if (!show && process.env.NODE_ENV === 'production') {
    return null;
  }

  const getStatusIcon = (status) => {
    return status ? 
      <CheckCircle className="w-4 h-4 text-green-500" /> : 
      <AlertCircle className="w-4 h-4 text-red-500" />;
  };

  const getStatusColor = (status) => {
    return status ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-gray-700 transition-colors"
      >
        🐛 Debug {isExpanded ? '▼' : '▲'}
      </button>

      {isExpanded && (
        <div className="absolute bottom-12 right-0 bg-white rounded-lg shadow-2xl p-4 w-96 max-h-96 overflow-y-auto border border-gray-200">
          <h3 className="font-bold text-lg mb-3 text-gray-800">System Status</h3>

          {/* Voice Service Status */}
          <div className="mb-4">
            <h4 className="font-semibold text-sm text-gray-700 mb-2 flex items-center">
              <Mic className="w-4 h-4 mr-1" /> Voice Service
            </h4>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span>Initialized:</span>
                <span className="flex items-center">
                  {getStatusIcon(debugInfo.voiceService.initialized)}
                  <span className={`ml-1 ${getStatusColor(debugInfo.voiceService.initialized)}`}>
                    {debugInfo.voiceService.initialized ? 'Yes' : 'No'}
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Listening:</span>
                <span className={getStatusColor(debugInfo.voiceService.listening)}>
                  {debugInfo.voiceService.listening ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Speaking:</span>
                <span className={getStatusColor(debugInfo.voiceService.speaking)}>
                  {debugInfo.voiceService.speaking ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>AWS Polly:</span>
                <span className={getStatusColor(debugInfo.voiceService.pollyEnabled)}>
                  {debugInfo.voiceService.pollyEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>

          {/* OpenAI Status */}
          <div className="mb-4">
            <h4 className="font-semibold text-sm text-gray-700 mb-2 flex items-center">
              <Brain className="w-4 h-4 mr-1" /> OpenAI Service
            </h4>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span>Initialized:</span>
                <span className="flex items-center">
                  {getStatusIcon(debugInfo.openAI.initialized)}
                  <span className={`ml-1 ${getStatusColor(debugInfo.openAI.initialized)}`}>
                    {debugInfo.openAI.initialized ? 'Yes' : 'No'}
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Current Stage:</span>
                <span className="text-blue-600 font-medium">
                  {debugInfo.openAI.currentStage}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Conversation Length:</span>
                <span>{debugInfo.openAI.conversationLength}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Used Objections:</span>
                <span>{debugInfo.openAI.usedObjections}</span>
              </div>
            </div>
          </div>

          {/* Browser Capabilities */}
          <div className="mb-4">
            <h4 className="font-semibold text-sm text-gray-700 mb-2 flex items-center">
              <Volume2 className="w-4 h-4 mr-1" /> Browser Capabilities
            </h4>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span>Speech Recognition:</span>
                <span className="flex items-center">
                  {getStatusIcon(debugInfo.browser.speechRecognition)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Speech Synthesis:</span>
                <span className="flex items-center">
                  {getStatusIcon(debugInfo.browser.speechSynthesis)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Media Devices:</span>
                <span className="flex items-center">
                  {getStatusIcon(debugInfo.browser.mediaDevices)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Audio Context:</span>
                <span className="flex items-center">
                  {getStatusIcon(debugInfo.browser.audioContext)}
                </span>
              </div>
            </div>
          </div>

          {/* AWS Configuration */}
          <div className="mb-4">
            <h4 className="font-semibold text-sm text-gray-700 mb-2 flex items-center">
              <Database className="w-4 h-4 mr-1" /> AWS Configuration
            </h4>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span>Credentials:</span>
                <span className={getStatusColor(debugInfo.aws.hasCredentials)}>
                  {debugInfo.aws.hasCredentials ? 'Configured' : 'Missing'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Region:</span>
                <span>{debugInfo.aws.region}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Voice ID:</span>
                <span>{debugInfo.aws.voiceId}</span>
              </div>
            </div>
          </div>

          {/* Session Info */}
          <div className="mb-4">
            <h4 className="font-semibold text-sm text-gray-700 mb-2">Session Info</h4>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span>Active:</span>
                <span className={getStatusColor(debugInfo.session.active)}>
                  {debugInfo.session.active ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Call State:</span>
                <span className="font-medium">{debugInfo.session.callState}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Type/Mode:</span>
                <span>{debugInfo.session.roleplayType} / {debugInfo.session.mode}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Exchanges:</span>
                <span>{Math.floor(debugInfo.session.conversationCount / 2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Evaluations:</span>
                <span>{debugInfo.session.evaluationCount}</span>
              </div>
            </div>
          </div>

          {/* Current Errors */}
          {voiceError && (
            <div className="mb-4">
              <h4 className="font-semibold text-sm text-red-700 mb-2">Current Error</h4>
              <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                {voiceError}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="font-semibold text-sm text-gray-700 mb-2">Quick Actions</h4>
            <div className="space-y-2">
              <button
                onClick={() => {
                  if (voiceService) {
                    voiceService.testSpeech("Testing AWS Polly voice synthesis.");
                  }
                }}
                className="w-full text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
              >
                Test Voice Synthesis
              </button>
              <button
                onClick={() => {
                  console.log('Debug Info:', debugInfo);
                  console.log('Voice Service:', voiceService);
                  console.log('OpenAI Service:', openAIService);
                }}
                className="w-full text-xs bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600"
              >
                Log Debug Info to Console
              </button>
              <button
                onClick={() => window.location.reload()}
                className="w-full text-xs bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
              >
                Reload Application
              </button>
            </div>
          </div>

          <div className="mt-4 text-xs text-gray-500 text-center">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
};

export default DebugPanel;