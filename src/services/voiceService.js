// src/services/voiceService.js - FIXED VERSION
// Browser-based voice service with improved initialization
import logger from '../utils/logger';

export class VoiceService {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.isSpeaking = false;
    this.silenceTimer = null;
    this.silenceStartTime = null;
    this.onSilenceCallback = null;
    this.onHangupCallback = null;
    this.currentUtterance = null;
    this.synthesis = null;
    this.audioContext = null;
    this.isInitialized = false;
    this.voices = [];
    this.initializationPromise = null; // Prevent multiple initializations
    
    // Bind methods to ensure proper context
    this.initialize = this.initialize.bind(this);
    this.startListening = this.startListening.bind(this);
    this.stopListening = this.stopListening.bind(this);
    this.speakText = this.speakText.bind(this);
    this.cleanup = this.cleanup.bind(this);
  }

  // Initialize the voice service with better error handling
  async initialize() {
    try {
      // Return existing promise if initialization is already in progress
      if (this.initializationPromise) {
        logger.log('🎤 Voice service initialization already in progress');
        return await this.initializationPromise;
      }

      // Check if already initialized
      if (this.isInitialized === true) {
        logger.log('🎤 Voice service already initialized');
        return true;
      }

      // Create initialization promise
      this.initializationPromise = this._performInitialization();
      
      const result = await this.initializationPromise;
      this.initializationPromise = null; // Clear promise after completion
      
      return result;

    } catch (error) {
      this.initializationPromise = null; // Clear promise on error
      logger.error('❌ Voice service initialization failed:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  // Separate method for actual initialization logic
  async _performInitialization() {
    logger.log('🎤 Starting voice service initialization...');

    // Check browser compatibility first
    const compatibility = this.checkCompatibility();
    if (!compatibility.compatible) {
      throw new Error(`Browser not compatible: ${compatibility.issues.join(', ')}`);
    }

    // Initialize speech synthesis first (safer and more reliable)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
      logger.log('✅ Speech synthesis available');
    } else {
      logger.warn('⚠️ Speech synthesis not supported - continuing without it');
    }

    // Initialize speech recognition
    try {
      await this.initializeSpeechRecognition();
      logger.log('✅ Speech recognition initialized');
    } catch (recognitionError) {
      logger.warn('⚠️ Speech recognition failed - continuing without it:', recognitionError);
      // Don't throw here - continue without speech recognition
    }

    // Initialize audio context for better audio handling (optional)
    if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        logger.log('✅ Audio context initialized');
      } catch (audioError) {
        logger.warn('⚠️ Audio context initialization failed - continuing without it:', audioError);
        // Continue without audio context - not critical
      }
    }

    // Load voices with timeout
    try {
      await this.loadVoicesWithTimeout(3000); // 3 second timeout for voice loading
      logger.log('✅ Voices loaded successfully');
    } catch (voiceError) {
      logger.warn('⚠️ Voice loading failed - continuing with basic functionality:', voiceError);
      // Continue even if voice loading fails
    }

    this.isInitialized = true;
    logger.log('✅ Voice service initialized successfully (browser-only)');
    return true;
  }

  // Load available voices with timeout and better error handling
  async loadVoicesWithTimeout(timeoutMs = 3000) {
    return new Promise((resolve, reject) => {
      if (!this.synthesis) {
        logger.warn('No synthesis available for voice loading');
        resolve(); // Don't reject - just continue
        return;
      }

      let attempts = 0;
      const maxAttempts = 5; // Reduced from 10
      let timeoutId;

      // Set up timeout
      timeoutId = setTimeout(() => {
        logger.warn('Voice loading timed out - continuing without voices');
        resolve(); // Don't reject on timeout - just continue
      }, timeoutMs);

      const loadVoicesHelper = () => {
        attempts++;
        this.voices = this.synthesis.getVoices() || [];
        
        if (this.voices.length > 0) {
          logger.log(`✅ Loaded ${this.voices.length} voices`);
          clearTimeout(timeoutId);
          resolve();
        } else if (attempts < maxAttempts) {
          // Voices not loaded yet, wait a bit
          setTimeout(loadVoicesHelper, 200); // Increased interval
        } else {
          logger.warn('Could not load voices after max attempts - continuing anyway');
          clearTimeout(timeoutId);
          resolve(); // Don't reject - continue without voices
        }
      };

      // Set up voice change listener (may not work on all browsers)
      try {
        if (this.synthesis.onvoiceschanged !== undefined) {
          this.synthesis.onvoiceschanged = () => {
            clearTimeout(timeoutId);
            loadVoicesHelper();
          };
        }
      } catch (listenerError) {
        logger.warn('Could not set up voice change listener:', listenerError);
      }
      
      // Try to load immediately
      loadVoicesHelper();
    });
  }

  // Initialize speech recognition with better error handling
  async initializeSpeechRecognition() {
    if (typeof window === 'undefined') {
      throw new Error('Window object not available');
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      throw new Error('Speech recognition not supported in this browser');
    }

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      
      // Configure recognition for cold calling
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';
      this.recognition.maxAlternatives = 1;

      // Test that the recognition object works
      if (typeof this.recognition.start !== 'function') {
        throw new Error('Speech recognition start method not available');
      }

      logger.log('✅ Speech recognition initialized');
      return this.recognition;
    } catch (error) {
      logger.error('Speech recognition initialization failed:', error);
      throw error;
    }
  }

  // Start listening for speech with enhanced error handling
  async startListening(options = {}) {
    try {
      // Ensure initialization
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (this.isListening) {
        logger.log('Already listening, stopping first...');
        this.stopListening();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (!this.recognition) {
        throw new Error('Speech recognition not available - please check browser compatibility');
      }

      // Request microphone permission if needed
      if (!options.skipPermissionCheck) {
        await this.requestMicrophonePermission();
      }

      // Resume audio context if suspended (iOS requirement)
      if (this.audioContext && this.audioContext.state === 'suspended') {
        try {
          await this.audioContext.resume();
          logger.log('✅ Audio context resumed');
        } catch (resumeError) {
          logger.warn('Could not resume audio context:', resumeError);
        }
      }

      return new Promise((resolve, reject) => {
        this.isListening = true;
        this.startSilenceTimer();

        // Set up timeout for listening
        const listeningTimeout = setTimeout(() => {
          this.stopListening();
          reject(new Error('Speech recognition timed out'));
        }, 30000); // 30 second timeout

        // Configure recognition callbacks
        this.recognition.onstart = () => {
          logger.log('🎤 Speech recognition started');
          this.clearSilenceTimer();
        };

        this.recognition.onresult = (event) => {
          clearTimeout(listeningTimeout);
          this.clearSilenceTimer();
          
          const result = event.results[0];
          const transcript = result[0].transcript;
          const confidence = result[0].confidence;

          logger.log('📝 Speech recognized:', { transcript, confidence });

          resolve({
            transcript: transcript.trim(),
            confidence,
            isFinal: result.isFinal,
            timestamp: new Date().toISOString()
          });
        };

        this.recognition.onerror = (event) => {
          clearTimeout(listeningTimeout);
          logger.error('❌ Speech recognition error:', event.error);
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
          clearTimeout(listeningTimeout);
          logger.log('🔚 Speech recognition ended');
          this.isListening = false;
          this.clearSilenceTimer();
        };

        // Start recognition
        try {
          this.recognition.start();
        } catch (error) {
          clearTimeout(listeningTimeout);
          this.isListening = false;
          this.clearSilenceTimer();
          reject(error);
        }
      });

    } catch (error) {
      this.isListening = false;
      this.clearSilenceTimer();
      logger.error('❌ Error starting speech recognition:', error);
      throw error;
    }
  }

  // Stop listening
  stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (error) {
        logger.warn('⚠️ Error stopping recognition:', error);
      }
    }
    this.isListening = false;
    this.clearSilenceTimer();
  }

  // Request microphone permission
  async requestMicrophonePermission() {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
        throw new Error('Media devices not supported');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop());
      logger.log('✅ Microphone permission granted');
      return true;

    } catch (error) {
      logger.error('❌ Microphone permission denied:', error);
      throw new Error('Microphone access is required for voice training. Please allow microphone access and try again.');
    }
  }

  // Synthesize speech using browser synthesis (no AWS)
  async synthesizeSpeech(text, options = {}) {
    try {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('Invalid text provided for synthesis');
      }

      logger.log('🗣️ Synthesizing speech:', text.substring(0, 50) + '...');
      return await this.synthesizeWithBrowser(text, options);
    } catch (error) {
      logger.error('❌ Speech synthesis failed:', error);
      throw new Error('Speech synthesis failed. Please check your browser compatibility.');
    }
  }

  // Browser synthesis with timeout
  async synthesizeWithBrowser(text, options = {}) {
    if (!this.synthesis) {
      throw new Error('Browser speech synthesis not supported');
    }

    return new Promise((resolve, reject) => {
      // Cancel any ongoing synthesis first
      this.stopCurrentAudio();

      const utterance = new SpeechSynthesisUtterance(text);
      
      // Configure utterance for natural speech
      utterance.rate = options.rate || 0.9;
      utterance.pitch = options.pitch || 1;
      utterance.volume = options.volume || 0.8;
      utterance.lang = 'en-US';

      // Find appropriate voice
      const preferredVoice = this.voices.find(voice => 
        voice.lang.includes('en-US') && voice.name.toLowerCase().includes('female')
      ) || this.voices.find(voice => voice.lang.includes('en-US')) || this.voices[0];
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      this.currentUtterance = utterance;

      // Set up timeout for synthesis
      const synthesisTimeout = setTimeout(() => {
        this.stopCurrentAudio();
        reject(new Error('Speech synthesis timed out'));
      }, 30000); // 30 second timeout

      utterance.onstart = () => {
        logger.log('🗣️ Browser synthesis started');
        this.isSpeaking = true;
      };

      utterance.onend = () => {
        clearTimeout(synthesisTimeout);
        logger.log('✅ Browser synthesis completed');
        this.isSpeaking = false;
        this.currentUtterance = null;
        resolve({
          success: true,
          audioUrl: null,
          text,
          synthesisType: 'browser',
          duration: this.estimateSpeechDuration(text)
        });
      };

      utterance.onerror = (event) => {
        clearTimeout(synthesisTimeout);
        logger.error('❌ Browser synthesis error:', event.error);
        this.isSpeaking = false;
        this.currentUtterance = null;
        reject(new Error(`Browser speech synthesis error: ${event.error}`));
      };

      // Start speaking
      logger.log('🗣️ Starting browser synthesis for:', text);
      try {
        this.synthesis.speak(utterance);
      } catch (error) {
        clearTimeout(synthesisTimeout);
        this.isSpeaking = false;
        this.currentUtterance = null;
        reject(error);
      }
    });
  }

  // Stop currently playing audio
  stopCurrentAudio() {
    // Stop browser synthesis
    if (this.synthesis && this.synthesis.speaking) {
      try {
        this.synthesis.cancel();
      } catch (error) {
        logger.warn('Error cancelling synthesis:', error);
      }
    }

    if (this.currentUtterance) {
      this.currentUtterance = null;
    }

    this.isSpeaking = false;
  }

  // Speak text (synthesis + playback combined)
  async speakText(text, options = {}) {
    try {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        logger.warn('⚠️ Empty text provided to speakText');
        return { success: false, error: 'Empty text' };
      }

      // Ensure initialization
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.log('🗣️ Speaking text:', text);
      
      const synthResult = await this.synthesizeSpeech(text, options);
      
      if (!synthResult.success) {
        throw new Error(synthResult.error);
      }

      return synthResult;

    } catch (error) {
      logger.error('❌ Speak text error:', error);
      throw error;
    }
  }

  // Start silence detection timer
  startSilenceTimer() {
    this.clearSilenceTimer();
    this.silenceStartTime = Date.now();
    
    this.silenceTimer = setInterval(() => {
      if (!this.silenceStartTime) return;
      
      const silenceDuration = Date.now() - this.silenceStartTime;
      const silenceSeconds = Math.floor(silenceDuration / 1000);
      
      if (silenceSeconds === 10) {
        logger.log('⚠️ 10 second silence warning');
        if (this.onSilenceCallback) {
          try {
            this.onSilenceCallback(silenceSeconds);
          } catch (error) {
            logger.error('Error in silence callback:', error);
          }
        }
      } else if (silenceSeconds >= 15) {
        logger.log('⏰ 15 second silence timeout - hanging up');
        this.clearSilenceTimer();
        if (this.onHangupCallback) {
          try {
            this.onHangupCallback('silence_timeout');
          } catch (error) {
            logger.error('Error in hangup callback:', error);
          }
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

  // Estimate speech duration
  estimateSpeechDuration(text) {
    if (!text || typeof text !== 'string') return 0;
    
    const words = text.split(/\s+/).filter(word => word.length > 0).length;
    const wordsPerSecond = 150 / 60; // ~2.5 words per second
    return Math.ceil(words / wordsPerSecond);
  }

  // Check browser compatibility
  checkCompatibility() {
    if (typeof window === 'undefined') {
      return {
        compatible: false,
        issues: ['Window object not available'],
        features: {}
      };
    }

    const compatibility = {
      speechRecognition: 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window,
      speechSynthesis: 'speechSynthesis' in window,
      mediaDevices: typeof navigator !== 'undefined' && 'mediaDevices' in navigator,
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
    return (this.voices || []).map(voice => ({
      name: voice.name,
      lang: voice.lang,
      gender: voice.name.toLowerCase().includes('female') ? 'female' : 'male',
      isDefault: voice.default
    }));
  }

  // Clean up resources
  cleanup() {
    logger.log('🧹 Cleaning up voice service...');
    
    this.stopListening();
    this.stopCurrentAudio();
    this.clearSilenceTimer();
    
    if (this.recognition) {
      this.recognition = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch (error) {
        logger.warn('Error closing audio context:', error);
      }
    }

    this.isInitialized = false;
    this.initializationPromise = null;
  }

  // Get current state
  getState() {
    return {
      isListening: this.isListening || false,
      isSpeaking: this.isSpeaking || false,
      isInitialized: this.isInitialized || false,
      hasAudioContext: !!this.audioContext
    };
  }

  // Test speech synthesis (for debugging)
  async testSpeech(text = "Hello, this is a test of the speech synthesis system.") {
    try {
      logger.log('🧪 Testing speech synthesis...');
      const result = await this.speakText(text);
      logger.log('✅ Speech test successful:', result);
      return result;
    } catch (error) {
      logger.error('❌ Speech test failed:', error);
      throw error;
    }
  }
}

// Create and export a singleton instance
export const voiceService = new VoiceService();