// src/services/voiceService.js
// Browser-based voice service (NO AWS dependencies)
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
    this.synthesis = window.speechSynthesis;
    this.audioContext = null;
    this.isInitialized = false;
    this.voices = [];
  }

  // Initialize the voice service
  async initialize() {
    try {
      if (this.isInitialized) return true;

      logger.log('🎤 Initializing voice service...');

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

      // Load voices
      await this.loadVoices();

      this.isInitialized = true;
      logger.log('✅ Voice service initialized successfully (browser-only)');
      return true;

    } catch (error) {
      logger.error('❌ Voice service initialization failed:', error);
      throw error;
    }
  }

  // Load available voices
  async loadVoices() {
    return new Promise((resolve) => {
      const loadVoicesHelper = () => {
        this.voices = this.synthesis.getVoices();
        
        if (this.voices.length > 0) {
          logger.log(`Loaded ${this.voices.length} voices`);
          resolve();
        } else {
          // Voices not loaded yet, wait a bit
          setTimeout(loadVoicesHelper, 100);
        }
      };

      // Set up voice change listener
      this.synthesis.onvoiceschanged = loadVoicesHelper;
      
      // Try to load immediately
      loadVoicesHelper();
    });
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

    logger.log('✅ Speech recognition initialized');
    return this.recognition;
  }

  // Start listening for speech with enhanced error handling
  async startListening(options = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (this.isListening) {
        logger.log('Already listening, stopping first...');
        this.stopListening();
        await new Promise(resolve => setTimeout(resolve, 100));
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
          logger.log('🎤 Speech recognition started');
          this.clearSilenceTimer();
        };

        this.recognition.onresult = (event) => {
          this.clearSilenceTimer();
          
          const result = event.results[0];
          const transcript = result[0].transcript;
          const confidence = result[0].confidence;

          logger.log('📝 Speech recognized:', { transcript, confidence });

          // Log pronunciation issues for coaching
          if (confidence < 0.7) {
            logger.log('⚠️ Low confidence speech detected:', confidence);
          }

          resolve({
            transcript: transcript.trim(),
            confidence,
            isFinal: result.isFinal,
            timestamp: new Date().toISOString()
          });
        };

        this.recognition.onerror = (event) => {
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
          logger.log('🔚 Speech recognition ended');
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
      logger.log('🗣️ Synthesizing speech:', text.substring(0, 50) + '...');
      return await this.synthesizeWithBrowser(text, options);
    } catch (error) {
      logger.error('❌ Speech synthesis failed:', error);
      throw new Error('Speech synthesis failed. Please check your browser compatibility.');
    }
  }

  // Browser synthesis (ONLY method - no AWS)
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

      // Find appropriate voice (prefer female US English)
      const preferredVoice = this.voices.find(voice => 
        voice.lang.includes('en-US') && voice.name.toLowerCase().includes('female')
      ) || this.voices.find(voice => voice.lang.includes('en-US')) || this.voices[0];
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      this.currentUtterance = utterance;

      utterance.onstart = () => {
        logger.log('🗣️ Browser synthesis started');
        this.isSpeaking = true;
      };

      utterance.onend = () => {
        logger.log('✅ Browser synthesis completed');
        this.isSpeaking = false;
        this.currentUtterance = null;
        resolve({
          success: true,
          audioUrl: null, // Browser synthesis doesn't provide URL
          text,
          synthesisType: 'browser',
          duration: this.estimateSpeechDuration(text)
        });
      };

      utterance.onerror = (event) => {
        logger.error('❌ Browser synthesis error:', event.error);
        this.isSpeaking = false;
        this.currentUtterance = null;
        reject(new Error(`Browser speech synthesis error: ${event.error}`));
      };

      // Start speaking
      logger.log('🗣️ Starting browser synthesis for:', text);
      this.synthesis.speak(utterance);
    });
  }

  // Play synthesized audio (for browser synthesis, it's already playing)
  async playAudio(audioUrl, options = {}) {
    // Browser synthesis case - already playing
    return { success: true, playbackType: 'browser' };
  }

  // Stop currently playing audio
  stopCurrentAudio() {
    // Stop browser synthesis
    if (this.synthesis && this.synthesis.speaking) {
      this.synthesis.cancel();
    }

    if (this.currentUtterance) {
      this.currentUtterance = null;
    }

    this.isSpeaking = false;
  }

  // Speak text (synthesis + playback combined)
  async speakText(text, options = {}) {
    try {
      if (!text || text.trim().length === 0) {
        logger.warn('⚠️ Empty text provided to speakText');
        return { success: false, error: 'Empty text' };
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

  // Start silence detection timer (follows roleplay instructions: 10s warning, 15s hangup)
  startSilenceTimer() {
    this.clearSilenceTimer();
    this.silenceStartTime = Date.now();
    
    this.silenceTimer = setInterval(() => {
      const silenceDuration = Date.now() - this.silenceStartTime;
      const silenceSeconds = Math.floor(silenceDuration / 1000);
      
      if (silenceSeconds === 10) {
        // First warning at 10 seconds
        logger.log('⚠️ 10 second silence warning');
        if (this.onSilenceCallback) {
          this.onSilenceCallback(silenceSeconds);
        }
      } else if (silenceSeconds >= 15) {
        // Hang up at 15 seconds total
        logger.log('⏰ 15 second silence timeout - hanging up');
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
    return this.voices.map(voice => ({
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

// Export singleton instance
export const voiceService = new VoiceService();
export default voiceService; 