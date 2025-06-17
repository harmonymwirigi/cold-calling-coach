// src/components/debug/ConversationDebugger.jsx
// Add this component temporarily to test the conversation flow

import React, { useState, useEffect } from 'react';
import { useRoleplay } from '../../contexts/RoleplayContext';
import logger from '../../utils/logger';

const ConversationDebugger = () => {
  const {
    currentSession,
    callState,
    isProcessing,
    currentMessage,
    currentStage,
    handleUserResponse,
    conversationHistory
  } = useRoleplay();

  const [testInput, setTestInput] = useState('');
  const [debugLogs, setDebugLogs] = useState([]);

  // Capture debug logs
  useEffect(() => {
    const originalLog = logger.log;
    const originalError = logger.error;

    logger.log = (...args) => {
      originalLog(...args);
      setDebugLogs(prev => [...prev.slice(-20), { type: 'log', message: args.join(' '), time: new Date().toLocaleTimeString() }]);
    };

    logger.error = (...args) => {
      originalError(...args);
      setDebugLogs(prev => [...prev.slice(-20), { type: 'error', message: args.join(' '), time: new Date().toLocaleTimeString() }]);
    };

    return () => {
      logger.log = originalLog;
      logger.error = originalError;
    };
  }, []);

  const sendTestMessage = async () => {
    if (!testInput.trim()) return;
    
    try {
      await handleUserResponse(testInput);
      setTestInput('');
    } catch (error) {
      console.error('Test message failed:', error);
    }
  };

  if (!currentSession) {
    return (
      <div className="fixed bottom-4 right-4 bg-white border rounded-lg p-4 shadow-lg max-w-md">
        <h3 className="font-bold text-red-600">Debug: No Active Session</h3>
        <p className="text-sm text-gray-600">Start a roleplay to see debug info</p>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border rounded-lg p-4 shadow-lg max-w-md max-h-96 overflow-y-auto">
      <h3 className="font-bold mb-2">🐛 Conversation Debugger</h3>
      
      {/* Current State */}
      <div className="mb-3 text-xs">
        <div><strong>Call State:</strong> {callState}</div>
        <div><strong>Stage:</strong> {currentStage}</div>
        <div><strong>Processing:</strong> {isProcessing ? 'Yes' : 'No'}</div>
        <div><strong>History:</strong> {conversationHistory.length} messages</div>
      </div>

      {/* Current Message */}
      {currentMessage && (
        <div className="mb-3 p-2 bg-blue-50 rounded text-xs">
          <strong>AI Said:</strong> "{currentMessage}"
        </div>
      )}

      {/* Test Input */}
      <div className="mb-3">
        <input
          type="text"
          value={testInput}
          onChange={(e) => setTestInput(e.target.value)}
          placeholder="Test user input..."
          className="w-full p-2 border rounded text-xs"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              sendTestMessage();
            }
          }}
        />
        <button
          onClick={sendTestMessage}
          disabled={!testInput.trim() || isProcessing}
          className="w-full mt-1 bg-blue-600 text-white p-1 rounded text-xs disabled:opacity-50"
        >
          Send Test Message
        </button>
      </div>

      {/* Conversation History */}
      <div className="mb-3">
        <strong className="text-xs">Conversation:</strong>
        <div className="max-h-32 overflow-y-auto text-xs">
          {conversationHistory.map((entry, index) => (
            <div key={index} className={`p-1 mb-1 rounded ${
              entry.speaker === 'user' ? 'bg-green-50' : 'bg-blue-50'
            }`}>
              <strong>{entry.speaker}:</strong> {entry.message}
            </div>
          ))}
        </div>
      </div>

      {/* Debug Logs */}
      <div>
        <strong className="text-xs">Recent Logs:</strong>
        <div className="max-h-32 overflow-y-auto text-xs">
          {debugLogs.slice(-10).map((log, index) => (
            <div key={index} className={`text-xs ${
              log.type === 'error' ? 'text-red-600' : 'text-gray-600'
            }`}>
              [{log.time}] {log.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ConversationDebugger;