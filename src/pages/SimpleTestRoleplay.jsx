// src/pages/SimpleTestRoleplay.jsx - BASIC WORKING VERSION
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PhoneOff, Mic, MessageCircle } from 'lucide-react';

const SimpleTestRoleplay = () => {
  const { type, mode } = useParams();
  const navigate = useNavigate();
  
  const [callState, setCallState] = useState('idle');
  const [currentMessage, setCurrentMessage] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  
  const recognitionRef = useRef(null);
  const isProcessingRef = useRef(false);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const result = event.results[event.resultIndex];
        const transcript = result[0].transcript.trim();
        const isFinal = result.isFinal;

        if (isFinal && transcript.length > 2 && !isProcessingRef.current) {
          handleUserInput(transcript);
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        // Restart listening if call is active
        if (callState === 'connected' && !isProcessingRef.current) {
          setTimeout(() => {
            startListening();
          }, 1000);
        }
      };
    }
  }, [callState]);

  // Start the roleplay
  useEffect(() => {
    setTimeout(() => {
      setCallState('connected');
      const greeting = "Hello, this is Sarah from TechCorp. Who am I speaking with?";
      setCurrentMessage(greeting);
      addMessage('ai', greeting);
      speakText(greeting);
    }, 2000);
  }, []);

  // Add message to conversation
  const addMessage = (speaker, message) => {
    const entry = {
      speaker,
      message,
      timestamp: Date.now()
    };
    setConversationHistory(prev => [...prev, entry]);
  };

  // Handle user input
  const handleUserInput = async (userInput) => {
    if (isProcessingRef.current) return;
    
    try {
      isProcessingRef.current = true;
      console.log('User said:', userInput);
      
      // Add user message
      addMessage('user', userInput);
      
      // Generate simple AI response
      const objections = [
        "What's this about?",
        "I'm not interested.",
        "We don't take cold calls.",
        "Now is not a good time.",
        "Is this a sales call?",
        "Who gave you this number?",
        "Can you send me an email instead?",
        "We're happy with our current provider.",
        "I'm busy right now."
      ];
      
      const aiResponse = objections[Math.floor(Math.random() * objections.length)];
      
      // Wait a moment, then respond
      setTimeout(() => {
        setCurrentMessage(aiResponse);
        addMessage('ai', aiResponse);
        speakText(aiResponse);
        isProcessingRef.current = false;
      }, 1000);
      
    } catch (error) {
      console.error('Error processing input:', error);
      isProcessingRef.current = false;
    }
  };

  // Speak text
  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 0.8;
      
      utterance.onend = () => {
        // Restart listening after AI speaks
        if (callState === 'connected') {
          setTimeout(() => {
            startListening();
          }, 1000);
        }
      };
      
      speechSynthesis.speak(utterance);
    }
  };

  // Start listening
  const startListening = () => {
    if (recognitionRef.current && !isListening && !isProcessingRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        console.log('Started listening');
      } catch (error) {
        console.error('Error starting recognition:', error);
      }
    }
  };

  // Stop listening
  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  // Handle manual submit
  const handleManualSubmit = () => {
    if (manualInput.trim()) {
      handleUserInput(manualInput.trim());
      setManualInput('');
      setShowManualInput(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900">
      {/* Header */}
      <div className="p-4 flex items-center justify-between text-white">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-white/80 hover:text-white"
        >
          ← Back
        </button>
        <h1 className="font-semibold">SIMPLE TEST ROLEPLAY</h1>
        <div className="w-16" />
      </div>

      {/* Debug Info */}
      <div className="bg-yellow-600 text-white p-2 text-center text-xs">
        Call: {callState} | Listening: {isListening ? 'yes' : 'no'} | Processing: {isProcessingRef.current ? 'yes' : 'no'}
      </div>

      {/* Main Interface */}
      <div className="flex justify-center px-4">
        <div className="bg-black/80 backdrop-blur rounded-3xl p-6 w-full max-w-md shadow-2xl">
          
          {/* Character */}
          <div className="text-center text-white mb-6">
            <div className="w-24 h-24 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full mx-auto mb-3 flex items-center justify-center">
              <span className="text-2xl font-bold">S</span>
            </div>
            <h2 className="text-xl font-semibold">Sarah Mitchell</h2>
            <p className="text-sm opacity-75">VP of Marketing</p>
          </div>

          {/* Current Message */}
          {currentMessage && (
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 mb-6 text-center">
              <p className="text-xs text-blue-200 mb-2">💬 AI says:</p>
              <p className="text-white text-sm">"{currentMessage}"</p>
            </div>
          )}

          {/* Status */}
          <div className="text-center text-white mb-6">
            {isProcessingRef.current ? (
              <p className="text-sm text-yellow-300">🤖 Processing...</p>
            ) : isListening ? (
              <p className="text-sm text-red-300">🎤 Listening...</p>
            ) : (
              <p className="text-sm text-green-300">Ready</p>
            )}
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {/* Microphone Button */}
            <div className="flex justify-center">
              <button
                onClick={isListening ? stopListening : startListening}
                disabled={isProcessingRef.current}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                  isListening
                    ? 'bg-red-600 hover:bg-red-700 animate-pulse' 
                    : 'bg-blue-600 hover:bg-blue-700'
                } disabled:opacity-50`}
              >
                <Mic className="w-8 h-8 text-white" />
              </button>
            </div>

            {/* Text Input Toggle */}
            <div className="flex justify-center">
              <button
                onClick={() => setShowManualInput(!showManualInput)}
                className="w-12 h-12 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center"
              >
                <MessageCircle className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Manual Input */}
            {showManualInput && (
              <div className="space-y-3">
                <textarea
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Type your response..."
                  className="w-full p-3 bg-gray-800 text-white rounded-lg text-sm"
                  rows={3}
                />
                <button
                  onClick={handleManualSubmit}
                  disabled={!manualInput.trim()}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg disabled:opacity-50"
                >
                  Send Response
                </button>
              </div>
            )}

            {/* Hangup */}
            <div className="flex justify-center pt-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="w-16 h-16 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center"
              >
                <PhoneOff className="w-8 h-8 text-white" />
              </button>
            </div>
          </div>

          {/* Conversation History */}
          <div className="mt-6 max-h-40 overflow-y-auto text-xs text-white space-y-2">
            {conversationHistory.map((entry, index) => (
              <div key={index} className={`p-2 rounded ${
                entry.speaker === 'user' ? 'bg-green-900/50' : 'bg-blue-900/50'
              }`}>
                <strong>{entry.speaker}:</strong> {entry.message}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleTestRoleplay;