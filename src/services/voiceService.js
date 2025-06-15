// src/services/voiceService.js - FIXED VERSION WITH ELEVENLABS
import logger from '../utils/logger';

export class VoiceService {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.isSpeaking = false;
    this.silenceTimer = null;
    this.currentUtterance = null;
    this.synthesis = null;
    this.audioContext = null;
    this.isInitialized = false;
    this.voices = [];
    this.initializationPromise = null;
    
    // Voice provider configuration
    this.voiceProvider = 'browser'; // 'elevenlabs', 'aws', or 'browser'
    this.elevenLabsApiKey = process.env.REACT_APP_ELEVENLABS_API_KEY;
    this.elevenLabsVoiceId = process.env.REACT_APP_ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // Sarah voice
    
    // Audio queue for smooth playback
    this.audioQueue = [];
    this.isPlayingAudio = false;
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.startListening = this.startListening.bind(this);
    this.stopListening = this.stopListening.bind(this);
    this.speakText = this.speakText.bind(this);
    this.cleanup = this.cleanup.bind(this);
  }

  // Initialize the voice service
  async initialize() {
    try {
      if (this.initializationPromise) {
        return await this.initializationPromise;
      }

      if (this.isInitialized === true) {
        logger.log('🎤 Voice service already initialized');
        return true;
      }

      this.initializationPromise = this._performInitialization();
      const result = await this.initializationPromise;
      this.initializationPromise = null;
      
      return result;

    } catch (error) {
      this.initializationPromise = null;
      logger.error('❌ Voice service initialization failed:', error);
      this.isInitialized = false;
      // Don't throw - continue with degraded functionality
      return false;
    }
  }

  async _performInitialization() {
    logger.log('🎤 Starting voice service initialization...');

    // Check browser compatibility
    const compatibility = this.checkCompatibility();
    if (!compatibility.compatible) {
      logger.warn(`Browser not compatible: ${compatibility.issues.join(', ')}`);
    }

    // Initialize speech synthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
      logger.log('✅ Speech synthesis available');
    }

    // Initialize speech recognition
    try {
      await this.initializeSpeechRecognition();
      logger.log('✅ Speech recognition initialized');
    } catch (recognitionError) {
      logger.warn('⚠️ Speech recognition failed:', recognitionError);
    }

    // Initialize audio context
    if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        logger.log('✅ Audio context initialized');
      } catch (audioError) {
        logger.warn('⚠️ Audio context initialization failed:', audioError);
      }
    }

    // Determine voice provider
    await this.determineVoiceProvider();

    // Load browser voices
    try {
      await this.loadVoicesWithTimeout(3000);
      logger.log('✅ Browser voices loaded');
    } catch (voiceError) {
      logger.warn('⚠️ Voice loading failed:', voiceError);
    }

    this.isInitialized = true;
    logger.log(`✅ Voice service initialized with ${this.voiceProvider} provider`);
    return true;
  }

  // Determine which voice provider to use
  async determineVoiceProvider() {
    // Check ElevenLabs first (preferred)
    if (this.elevenLabsApiKey) {
      try {
        const response = await fetch('https://api.elevenlabs.io/v1/voices', {
          headers: {
            'xi-api-key': this.elevenLabsApiKey
          }
        });
        
        if (response.ok) {
          this.voiceProvider = 'elevenlabs';
          logger.log('✅ ElevenLabs API key valid - using ElevenLabs for voice synthesis');
          return;
        }
      } catch (error) {
        logger.warn('⚠️ ElevenLabs check failed:', error);
      }
    }

    // Fallback to browser
    this.voiceProvider = 'browser';
    logger.log('ℹ️ Using browser speech synthesis');
  }

  // Initialize speech recognition
  async initializeSpeechRecognition() {
    if (typeof window === 'undefined') {
      throw new Error('Window object not available');
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      throw new Error('Speech recognition not supported');
    }

    this.recognition = new SpeechRecognition();
    
    // Configure for cold calling
    this.recognition.continuous = true;  // Enable continuous listening
    this.recognition.interimResults = true;  // Enable interim results for better UX
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    logger.log('✅ Speech recognition configured');
  }

  // Start listening for speech
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

      if (!this.recognition) {
        throw new Error('Speech recognition not available');
      }

      // Request microphone permission if needed
      if (!options.skipPermissionCheck) {
        await this.requestMicrophonePermission();
      }

      // Resume audio context if suspended
      if (this.audioContext && this.audioContext.state === 'suspended') {
        try {
          await this.audioContext.resume();
        } catch (resumeError) {
          logger.warn('Could not resume audio context:', resumeError);
        }
      }

      return new Promise((resolve, reject) => {
        this.isListening = true;
        logger.log('🎤 Starting speech recognition...');

        const timeout = setTimeout(() => {
          this.stopListening();
          resolve({
            transcript: '',
            confidence: 0,
            isFinal: true,
            error: 'No speech detected'
          });
        }, options.timeout || 10000); // 10 second timeout

        this.recognition.onstart = () => {
          logger.log('🎤 Speech recognition started');
        };

        this.recognition.onresult = (event) => {
          clearTimeout(timeout);
          const result = event.results[event.results.length - 1];  // Get the latest result
          const transcript = result[0].transcript;
          const confidence = result[0].confidence;

          logger.log('📝 Speech recognized:', { transcript, confidence, isFinal: result.isFinal });

          // Only resolve on final results
          if (result.isFinal) {
            this.stopListening(); // Stop listening after getting final result
            resolve({
              transcript: transcript.trim(),
              confidence,
              isFinal: true,
              timestamp: new Date().toISOString()
            });
          } else if (options.onInterim) {
            // Call interim callback if provided
            options.onInterim(transcript);
          }
        };

        this.recognition.onerror = (event) => {
          clearTimeout(timeout);
          logger.error('❌ Speech recognition error:', event.error);
          this.isListening = false;
          
          if (event.error === 'no-speech') {
            resolve({
              transcript: '',
              confidence: 0,
              isFinal: true,
              error: 'No speech detected'
            });
          } else {
            reject(new Error(`Speech recognition error: ${event.error}`));
          }
        };

        this.recognition.onend = () => {
          logger.log('🔚 Speech recognition ended');
          this.isListening = false;
          clearTimeout(timeout);
        };

        try {
          this.recognition.start();
        } catch (error) {
          clearTimeout(timeout);
          this.isListening = false;
          reject(error);
        }
      });

    } catch (error) {
      this.isListening = false;
      logger.error('❌ Error starting speech recognition:', error);
      throw error;
    }
  }

  // Stop listening
  stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
        this.isListening = false;
      } catch (error) {
        logger.warn('⚠️ Error stopping recognition:', error);
      }
    }
  }

  // Speak text using the configured provider
  async speakText(text, options = {}) {
    try {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        logger.warn('⚠️ Empty text provided to speakText');
        return { success: false, error: 'Empty text' };
      }

      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.log(`🗣️ Speaking text with ${this.voiceProvider}:`, text);
      
      let result;
      switch (this.voiceProvider) {
        case 'elevenlabs':
          result = await this.speakWithElevenLabs(text, options);
          break;
        
        case 'browser':
        default:
          result = await this.speakWithBrowser(text, options);
          break;
      }
      
      return result;

    } catch (error) {
      logger.error('❌ Speak text error:', error);
      // Fallback to browser if other methods fail
      if (this.voiceProvider !== 'browser') {
        logger.log('Falling back to browser synthesis...');
        return await this.speakWithBrowser(text, options);
      }
      throw error;
    }
  }

  // Speak using ElevenLabs API
  async speakWithElevenLabs(text, options = {}) {
    if (!this.elevenLabsApiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    try {
      this.isSpeaking = true;
      
      // Call ElevenLabs text-to-speech API
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${this.elevenLabsVoiceId}/stream`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': this.elevenLabsApiKey,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg'
          },
          body: JSON.stringify({
            text: text,
            model_id: 'eleven_monolingual_v1',
            voice_settings: {
              stability: options.stability || 0.5,
              similarity_boost: options.similarity || 0.75
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      // Get audio data
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Play the audio
      await this.playAudio(audioUrl, options);

      // Clean up
      URL.revokeObjectURL(audioUrl);

      logger.log('✅ ElevenLabs speech completed');
      return {
        success: true,
        synthesisType: 'elevenlabs',
        voiceId: this.elevenLabsVoiceId
      };

    } catch (error) {
      logger.error('❌ ElevenLabs synthesis error:', error);
      throw error;
    } finally {
      this.isSpeaking = false;
    }
  }

  // Play audio file
  async playAudio(audioUrl, options = {}) {
    return new Promise((resolve, reject) => {
      const audio = new Audio(audioUrl);
      
      audio.volume = options.volume || 0.8;
      audio.playbackRate = options.rate || 1.0;

      this.currentAudio = audio;

      audio.onended = () => {
        logger.log('✅ Audio playback completed');
        this.currentAudio = null;
        resolve();
      };

      audio.onerror = (error) => {
        logger.error('❌ Audio playback error:', error);
        this.currentAudio = null;
        reject(error);
      };

      audio.play().catch(reject);
    });
  }

  // Browser synthesis fallback
  async speakWithBrowser(text, options = {}) {
    if (!this.synthesis) {
      throw new Error('Browser speech synthesis not supported');
    }

    return new Promise((resolve, reject) => {
      this.stopCurrentAudio();

      const utterance = new SpeechSynthesisUtterance(text);
      
      utterance.rate = options.rate || 0.9;
      utterance.pitch = options.pitch || 1.0;
      utterance.volume = options.volume || 0.8;
      utterance.lang = 'en-US';

      // Find best voice
      const preferredVoice = this.voices.find(voice => 
        voice.lang.includes('en-US') && 
        (voice.name.toLowerCase().includes('samantha') || 
         voice.name.toLowerCase().includes('karen') ||
         voice.name.toLowerCase().includes('female'))
      ) || this.voices.find(voice => voice.lang.includes('en-US')) || this.voices[0];
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      this.currentUtterance = utterance;
      this.isSpeaking = true;

      const timeout = setTimeout(() => {
        this.stopCurrentAudio();
        reject(new Error('Speech synthesis timed out'));
      }, 30000);

      utterance.onstart = () => {
        logger.log('🗣️ Browser synthesis started');
      };

      utterance.onend = () => {
        clearTimeout(timeout);
        logger.log('✅ Browser synthesis completed');
        this.isSpeaking = false;
        this.currentUtterance = null;
        resolve({
          success: true,
          synthesisType: 'browser',
          duration: this.estimateSpeechDuration(text)
        });
      };

      utterance.onerror = (event) => {
        clearTimeout(timeout);
        logger.error('❌ Browser synthesis error:', event.error);
        this.isSpeaking = false;
        this.currentUtterance = null;
        reject(new Error(`Browser synthesis error: ${event.error}`));
      };

      try {
        this.synthesis.speak(utterance);
      } catch (error) {
        clearTimeout(timeout);
        this.isSpeaking = false;
        this.currentUtterance = null;
        reject(error);
      }
    });
  }

  // Stop current audio/speech
  stopCurrentAudio() {
    // Stop ElevenLabs audio if playing
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio = null;
      } catch (error) {
        logger.warn('Error stopping audio:', error);
      }
    }

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

  // Stop speaking (alias)
  stopSpeaking() {
    this.stopCurrentAudio();
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
      
      stream.getTracks().forEach(track => track.stop());
      logger.log('✅ Microphone permission granted');
      return true;

    } catch (error) {
      logger.error('❌ Microphone permission denied:', error);
      throw new Error('Microphone access is required for voice training');
    }
  }

  // Load browser voices
  async loadVoicesWithTimeout(timeoutMs = 3000) {
    return new Promise((resolve) => {
      if (!this.synthesis) {
        resolve();
        return;
      }

      let attempts = 0;
      const maxAttempts = 5;
      let timeoutId;

      timeoutId = setTimeout(() => {
        logger.warn('Voice loading timed out');
        resolve();
      }, timeoutMs);

      const loadVoicesHelper = () => {
        attempts++;
        this.voices = this.synthesis.getVoices() || [];
        
        if (this.voices.length > 0) {
          logger.log(`✅ Loaded ${this.voices.length} voices`);
          clearTimeout(timeoutId);
          resolve();
        } else if (attempts < maxAttempts) {
          setTimeout(loadVoicesHelper, 200);
        } else {
          logger.warn('Could not load voices after max attempts');
          clearTimeout(timeoutId);
          resolve();
        }
      };

      if (this.synthesis.onvoiceschanged !== undefined) {
        this.synthesis.onvoiceschanged = () => {
          clearTimeout(timeoutId);
          loadVoicesHelper();
        };
      }
      
      loadVoicesHelper();
    });
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
      audioContext: 'AudioContext' in window || 'webkitAudioContext' in window
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

  // Clean up resources
  cleanup() {
    logger.log('🧹 Cleaning up voice service...');
    
    this.stopListening();
    this.stopCurrentAudio();
    
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
      hasAudioContext: !!this.audioContext,
      voiceProvider: this.voiceProvider,
      elevenLabsConfigured: !!this.elevenLabsApiKey
    };
  }

  // Test speech
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

// Create and export singleton instance
export const voiceService = new VoiceService();