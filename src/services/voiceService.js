// src/services/voiceService.js
import React from 'react';
import AWS from 'aws-sdk';

// Configure AWS - make sure to set these environment variables
AWS.config.update({
  accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY,
  region: process.env.REACT_APP_AWS_REGION || 'us-east-1'
});

const polly = new AWS.Polly();

export class VoiceService {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.isSpeaking = false;
    this.silenceTimer = null;
    this.silenceStartTime = null;
    this.onSilenceCallback = null;
    this.onHangupCallback = null;
    this.currentAudio = null;
    this.synthesis = window.speechSynthesis;
    this.audioContext = null;
    this.isInitialized = false;
  }

  // Initialize the voice service
  async initialize() {
    try {
      if (this.isInitialized) return true;

      console.log('🎤 Initializing voice service...');

      // Check browser compatibility
      const compatibility = this.checkCompatibility();
      if (!compatibility.compatible) {
        throw new Error(`Browser not compatible: ${compatibility.issues.join(', ')}`);
      }

      // Initialize speech recognition
      await this.initializeSpeechRecognition();

      // Initialize audio context for better audio handling
      if (window.AudioContext || window.webkitAudioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      // Test AWS Polly connection only if credentials are provided
      if (process.env.REACT_APP_AWS_ACCESS_KEY_ID && process.env.REACT_APP_AWS_SECRET_ACCESS_KEY) {
        await this.testPollyConnection();
      } else {
        console.log('🔍 AWS credentials not provided, skipping Polly test and using browser synthesis');
      }

      this.isInitialized = true;
      console.log('✅ Voice service initialized successfully');
      return true;

    } catch (error) {
      console.error('❌ Voice service initialization failed:', error);
      throw error;
    }
  }

  // Test AWS Polly connection
  async testPollyConnection() {
    try {
      // Skip AWS Polly test if credentials are not provided
      if (!process.env.REACT_APP_AWS_ACCESS_KEY_ID || !process.env.REACT_APP_AWS_SECRET_ACCESS_KEY) {
        console.log('🔍 AWS credentials not provided, using browser synthesis');
        return false;
      }

      console.log('🧪 Testing AWS Polly connection...');
      
      const params = {
        Text: 'Test',
        OutputFormat: 'mp3',
        VoiceId: 'Joanna',
        Engine: 'standard'
      };

      await polly.synthesizeSpeech(params).promise();
      console.log('✅ AWS Polly connection successful');
      return true;

    } catch (error) {
      console.warn('⚠️ AWS Polly not available, falling back to browser synthesis:', error.message);
      return false;
    }
  }

  // Initialize speech recognition
  async initializeSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      throw new Error('Speech recognition not supported in this browser');
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    // Configure recognition for cold calling
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;
    // Note: Don't set grammars property - leave it as default

    console.log('✅ Speech recognition initialized');
    return this.recognition;
  }

  // Start listening for speech with enhanced error handling
  async startListening(options = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (this.isListening) {
        console.log('Already listening, stopping first...');
        this.stopListening();
        await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay
      }

      // Request microphone permission if needed
      if (!options.skipPermissionCheck) {
        await this.requestMicrophonePermission();
      }

      // Resume audio context if suspended (iOS requirement)
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      return new Promise((resolve, reject) => {
        this.isListening = true;
        this.startSilenceTimer();

        // Configure recognition callbacks
        this.recognition.onstart = () => {
          console.log('🎤 Speech recognition started');
          this.clearSilenceTimer();
        };

        this.recognition.onresult = (event) => {
          this.clearSilenceTimer();
          
          const result = event.results[0];
          const transcript = result[0].transcript;
          const confidence = result[0].confidence;

          console.log('📝 Speech recognized:', { transcript, confidence });

          // Log pronunciation issues for coaching
          if (confidence < 0.7) {
            console.log('⚠️ Low confidence speech detected:', confidence);
          }

          resolve({
            transcript: transcript.trim(),
            confidence,
            isFinal: result.isFinal,
            timestamp: new Date().toISOString()
          });
        };

        this.recognition.onerror = (event) => {
          console.error('❌ Speech recognition error:', event.error);
          this.isListening = false;
          this.clearSilenceTimer();
          
          const errorMessages = {
            'not-allowed': 'Microphone access denied. Please allow microphone access.',
            'no-speech': 'No speech detected. Please speak clearly into your microphone.',
            'audio-capture': 'Microphone not available. Please check your microphone.',
            'network': 'Network error. Please check your internet connection.',
            'aborted': 'Speech recognition was cancelled.',
            'language-not-supported': 'Language not supported.',
            'service-not-allowed': 'Speech recognition service not allowed.'
          };

          const errorMessage = errorMessages[event.error] || `Speech recognition error: ${event.error}`;
          reject(new Error(errorMessage));
        };

        this.recognition.onend = () => {
          console.log('🔚 Speech recognition ended');
          this.isListening = false;
          this.clearSilenceTimer();
        };

        // Start recognition
        try {
          this.recognition.start();
        } catch (error) {
          this.isListening = false;
          this.clearSilenceTimer();
          reject(error);
        }
      });

    } catch (error) {
      this.isListening = false;
      this.clearSilenceTimer();
      console.error('❌ Error starting speech recognition:', error);
      throw error;
    }
  }

  // Stop listening
  stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (error) {
        console.warn('⚠️ Error stopping recognition:', error);
      }
    }
    this.isListening = false;
    this.clearSilenceTimer();
  }

  // Request microphone permission
  async requestMicrophonePermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop());
      console.log('✅ Microphone permission granted');
      return true;

    } catch (error) {
      console.error('❌ Microphone permission denied:', error);
      throw new Error('Microphone access is required for voice training. Please allow microphone access and try again.');
    }
  }

  // Synthesize speech using AWS Polly with fallback
  async synthesizeSpeech(text, options = {}) {
    try {
      console.log('🗣️ Synthesizing speech:', text.substring(0, 50) + '...');

      // Try AWS Polly first
      try {
        return await this.synthesizeWithPolly(text, options);
      } catch (pollyError) {
        console.warn('⚠️ Polly synthesis failed, falling back to browser:', pollyError.message);
        return await this.synthesizeWithBrowser(text, options);
      }

    } catch (error) {
      console.error('❌ All speech synthesis methods failed:', error);
      throw new Error('Speech synthesis failed. Please check your internet connection.');
    }
  }

  // AWS Polly synthesis
  async synthesizeWithPolly(text, options = {}) {
    const params = {
      Text: text,
      OutputFormat: options.format || 'mp3',
      VoiceId: options.voiceId || 'Joanna', // Female US English voice
      Engine: options.engine || 'standard',
      SampleRate: options.sampleRate || '22050'
    };

    const data = await polly.synthesizeSpeech(params).promise();
    
    // Create audio blob and URL
    const audioBlob = new Blob([data.AudioStream], { type: 'audio/mp3' });
    const audioUrl = URL.createObjectURL(audioBlob);
    
    return {
      success: true,
      audioUrl,
      audioBlob,
      text,
      synthesisType: 'polly',
      duration: this.estimateSpeechDuration(text)
    };
  }

  // Browser synthesis fallback
  async synthesizeWithBrowser(text, options = {}) {
    if (!this.synthesis) {
      throw new Error('Browser speech synthesis not supported');
    }

    return new Promise((resolve, reject) => {
      // Cancel any ongoing synthesis first
      this.synthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      
      // Configure utterance for natural speech
      utterance.rate = options.rate || 0.9;
      utterance.pitch = options.pitch || 1;
      utterance.volume = options.volume || 1;
      utterance.lang = 'en-US';

      // Find appropriate voice (prefer female US English)
      const voices = this.synthesis.getVoices();
      
      // Wait for voices to load if they're not available yet
      if (voices.length === 0) {
        this.synthesis.addEventListener('voiceschanged', () => {
          const newVoices = this.synthesis.getVoices();
          const preferredVoice = newVoices.find(voice => 
            voice.lang.includes('en-US') && voice.name.toLowerCase().includes('female')
          ) || newVoices.find(voice => voice.lang.includes('en-US')) || newVoices[0];
          
          if (preferredVoice) {
            utterance.voice = preferredVoice;
          }
        }, { once: true });
      } else {
        const preferredVoice = voices.find(voice => 
          voice.lang.includes('en-US') && voice.name.toLowerCase().includes('female')
        ) || voices.find(voice => voice.lang.includes('en-US')) || voices[0];
        
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
      }

      utterance.onstart = () => {
        console.log('🗣️ Browser synthesis started');
        this.isSpeaking = true;
      };

      utterance.onend = () => {
        console.log('✅ Browser synthesis completed');
        this.isSpeaking = false;
        resolve({
          success: true,
          audioUrl: null, // Browser synthesis doesn't provide URL
          text,
          synthesisType: 'browser',
          duration: this.estimateSpeechDuration(text)
        });
      };

      utterance.onerror = (event) => {
        console.error('❌ Browser synthesis error:', event.error);
        this.isSpeaking = false;
        reject(new Error(`Browser speech synthesis error: ${event.error}`));
      };

      // Start speaking
      console.log('🗣️ Starting browser synthesis for:', text);
      this.synthesis.speak(utterance);
    });
  }

  // Play synthesized audio
  async playAudio(audioUrl, options = {}) {
    try {
      this.stopCurrentAudio();

      if (!audioUrl) {
        // Browser synthesis case - already playing
        return { success: true, playbackType: 'browser' };
      }

      return new Promise((resolve, reject) => {
        this.currentAudio = new Audio(audioUrl);
        
        // Configure audio for better playback
        this.currentAudio.preload = 'auto';
        this.currentAudio.volume = options.volume || 1.0;

        this.currentAudio.onloadeddata = () => {
          console.log('🔊 Audio loaded, duration:', this.currentAudio.duration);
        };

        this.currentAudio.onplay = () => {
          this.isSpeaking = true;
        };

        this.currentAudio.onended = () => {
          console.log('✅ Audio playback completed');
          this.isSpeaking = false;
          this.currentAudio = null;
          resolve({ success: true, playbackType: 'audio' });
        };

        this.currentAudio.onerror = (event) => {
          console.error('❌ Audio playback error:', event);
          this.isSpeaking = false;
          this.currentAudio = null;
          reject(new Error('Audio playback failed'));
        };

        // Start playback
        this.currentAudio.play().catch(error => {
          console.error('❌ Play promise rejected:', error);
          this.isSpeaking = false;
          reject(error);
        });
      });

    } catch (error) {
      console.error('❌ Play audio error:', error);
      throw error;
    }
  }

  // Stop currently playing audio
  stopCurrentAudio() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }

    // Stop browser synthesis
    if (this.synthesis && this.synthesis.speaking) {
      this.synthesis.cancel();
    }

    this.isSpeaking = false;
  }

  // Speak text (synthesis + playback combined)
  async speakText(text, options = {}) {
    try {
      if (!text || text.trim().length === 0) {
        console.warn('⚠️ Empty text provided to speakText');
        return { success: false, error: 'Empty text' };
      }

      console.log('🗣️ Speaking text:', text);
      
      const synthResult = await this.synthesizeSpeech(text, options);
      
      if (!synthResult.success) {
        throw new Error(synthResult.error);
      }

      if (synthResult.audioUrl) {
        await this.playAudio(synthResult.audioUrl, options);
      }

      // Clean up blob URL after delay
      if (synthResult.audioUrl) {
        setTimeout(() => {
          try {
            URL.revokeObjectURL(synthResult.audioUrl);
          } catch (error) {
            console.warn('⚠️ Failed to revoke blob URL:', error);
          }
        }, 60000); // Clean up after 1 minute
      }

      return synthResult;

    } catch (error) {
      console.error('❌ Speak text error:', error);
      throw error;
    }
  }

  // Start silence detection timer (follows roleplay instructions: 10s warning, 15s hangup)
  startSilenceTimer() {
    this.clearSilenceTimer();
    this.silenceStartTime = Date.now();
    
    this.silenceTimer = setInterval(() => {
      const silenceDuration = Date.now() - this.silenceStartTime;
      const silenceSeconds = Math.floor(silenceDuration / 1000);
      
      if (silenceSeconds === 10) {
        // First warning at 10 seconds
        console.log('⚠️ 10 second silence warning');
        if (this.onSilenceCallback) {
          this.onSilenceCallback(silenceSeconds);
        }
      } else if (silenceSeconds >= 15) {
        // Hang up at 15 seconds total
        console.log('⏰ 15 second silence timeout - hanging up');
        this.clearSilenceTimer();
        if (this.onHangupCallback) {
          this.onHangupCallback('silence_timeout');
        }
      }
    }, 1000);
  }

  // Clear silence timer
  clearSilenceTimer() {
    if (this.silenceTimer) {
      clearInterval(this.silenceTimer);
      this.silenceTimer = null;
    }
    this.silenceStartTime = null;
  }

  // Set silence callbacks
  setSilenceCallbacks(onSilence, onHangup) {
    this.onSilenceCallback = onSilence;
    this.onHangupCallback = onHangup;
  }

  // Estimate speech duration (rough calculation)
  estimateSpeechDuration(text) {
    // Average speaking rate: ~150 words per minute for natural speech
    const words = text.split(/\s+/).length;
    const wordsPerSecond = 150 / 60; // ~2.5 words per second
    return Math.ceil(words / wordsPerSecond);
  }

  // Check browser compatibility
  checkCompatibility() {
    const compatibility = {
      speechRecognition: 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window,
      speechSynthesis: 'speechSynthesis' in window,
      mediaDevices: 'mediaDevices' in navigator,
      audioContext: 'AudioContext' in window || 'webkitAudioContext' in window,
      promises: 'Promise' in window
    };

    const issues = [];
    if (!compatibility.speechRecognition) issues.push('Speech recognition not supported');
    if (!compatibility.speechSynthesis) issues.push('Speech synthesis not supported');
    if (!compatibility.mediaDevices) issues.push('Media devices not supported');

    return {
      compatible: issues.length === 0,
      issues,
      features: compatibility
    };
  }

  // Get available voices
  getAvailableVoices() {
    if (!this.synthesis) return [];
    
    return this.synthesis.getVoices().map(voice => ({
      name: voice.name,
      lang: voice.lang,
      gender: voice.name.toLowerCase().includes('female') ? 'female' : 'male',
      isDefault: voice.default
    }));
  }

  // Clean up resources
  cleanup() {
    console.log('🧹 Cleaning up voice service...');
    
    this.stopListening();
    this.stopCurrentAudio();
    this.clearSilenceTimer();
    
    if (this.recognition) {
      this.recognition = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }

    this.isInitialized = false;
  }

  // Get current state
  getState() {
    return {
      isListening: this.isListening,
      isSpeaking: this.isSpeaking,
      isInitialized: this.isInitialized,
      hasAudioContext: !!this.audioContext
    };
  }

  // Test speech synthesis (for debugging)
  async testSpeech(text = "Hello, this is a test of the speech synthesis system.") {
    try {
      console.log('🧪 Testing speech synthesis...');
      const result = await this.speakText(text);
      console.log('✅ Speech test successful:', result);
      return result;
    } catch (error) {
      console.error('❌ Speech test failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const voiceService = new VoiceService();

// React hook for voice functionality
export const useVoice = () => {
  const [isListening, setIsListening] = React.useState(false);
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [isInitialized, setIsInitialized] = React.useState(false);

  // Initialize voice service on mount
  React.useEffect(() => {
    const initializeVoice = async () => {
      try {
        await voiceService.initialize();
        setIsInitialized(true);
      } catch (error) {
        console.error('Voice service initialization failed:', error);
        setError(error.message);
      }
    };

    initializeVoice();

    // Update state based on voice service state
    const updateState = () => {
      const state = voiceService.getState();
      setIsListening(state.isListening);
      setIsSpeaking(state.isSpeaking);
    };

    const interval = setInterval(updateState, 500);
    
    return () => {
      clearInterval(interval);
      voiceService.cleanup();
    };
  }, []);

  const startListening = React.useCallback(async (options = {}) => {
    try {
      setError(null);
      const result = await voiceService.startListening(options);
      return result;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  }, []);

  const stopListening = React.useCallback(() => {
    voiceService.stopListening();
  }, []);

  const speakText = React.useCallback(async (text, options = {}) => {
    try {
      setError(null);
      const result = await voiceService.speakText(text, options);
      return result;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  }, []);

  const stopSpeaking = React.useCallback(() => {
    voiceService.stopCurrentAudio();
  }, []);

  return {
    isListening,
    isSpeaking,
    isInitialized,
    error,
    startListening,
    stopListening,
    speakText,
    stopSpeaking,
    voiceService
  };
};

export default voiceService;