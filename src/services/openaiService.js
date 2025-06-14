// src/services/voiceService.js - ENHANCED VERSION WITH AWS POLLY
import logger from '../utils/logger';
import AWS from 'aws-sdk';

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
    this.initializationPromise = null;
    
    // AWS Polly configuration
    this.polly = null;
    this.pollyEnabled = false;
    this.preferredVoiceId = 'Joanna'; // Natural sounding US English voice
    
    // Audio queue for smooth playback
    this.audioQueue = [];
    this.isPlayingAudio = false;
    
    // Continuous recognition for interruptions
    this.continuousMode = false;
    this.onInterruptCallback = null;
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.startListening = this.startListening.bind(this);
    this.stopListening = this.stopListening.bind(this);
    this.speakText = this.speakText.bind(this);
    this.cleanup = this.cleanup.bind(this);
  }

  // Initialize the voice service with AWS Polly support
  async initialize() {
    try {
      if (this.initializationPromise) {
        logger.log('🎤 Voice service initialization already in progress');
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
      throw error;
    }
  }

  async _performInitialization() {
    logger.log('🎤 Starting voice service initialization...');

    // Check browser compatibility
    const compatibility = this.checkCompatibility();
    if (!compatibility.compatible) {
      throw new Error(`Browser not compatible: ${compatibility.issues.join(', ')}`);
    }

    // Initialize speech synthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
      logger.log('✅ Speech synthesis available');
    }

    // Initialize speech recognition with continuous mode support
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

    // Initialize AWS Polly if credentials are available
    await this.initializeAWSPolly();

    // Load voices
    try {
      await this.loadVoicesWithTimeout(3000);
      logger.log('✅ Voices loaded successfully');
    } catch (voiceError) {
      logger.warn('⚠️ Voice loading failed:', voiceError);
    }

    this.isInitialized = true;
    logger.log('✅ Voice service initialized successfully');
    return true;
  }

  // Initialize AWS Polly
  async initializeAWSPolly() {
    try {
      // Check if AWS credentials are available
      const accessKeyId = process.env.REACT_APP_AWS_ACCESS_KEY_ID;
      const secretAccessKey = process.env.REACT_APP_AWS_SECRET_ACCESS_KEY;
      const region = process.env.REACT_APP_AWS_REGION || 'us-east-1';

      if (!accessKeyId || !secretAccessKey) {
        logger.warn('⚠️ AWS credentials not found, Polly will not be available');
        return false;
      }

      // Configure AWS
      AWS.config.update({
        accessKeyId,
        secretAccessKey,
        region
      });

      // Create Polly service object
      this.polly = new AWS.Polly();

      // Test Polly connection
      try {
        const voices = await this.polly.describeVoices({ LanguageCode: 'en-US' }).promise();
        logger.log(`✅ AWS Polly initialized with ${voices.Voices.length} English voices`);
        this.pollyEnabled = true;
        return true;
      } catch (testError) {
        logger.error('❌ AWS Polly test failed:', testError);
        this.pollyEnabled = false;
        return false;
      }

    } catch (error) {
      logger.error('❌ AWS Polly initialization failed:', error);
      this.pollyEnabled = false;
      return false;
    }
  }

  // Initialize speech recognition with continuous mode
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
      
      // Configure for natural conversation
      this.recognition.continuous = true; // Enable continuous mode for interruptions
      this.recognition.interimResults = true; // Get results while speaking
      this.recognition.lang = 'en-US';
      this.recognition.maxAlternatives = 1;

      logger.log('✅ Speech recognition initialized with continuous mode');
      return this.recognition;
    } catch (error) {
      logger.error('Speech recognition initialization failed:', error);
      throw error;
    }
  }

  // Start listening with interruption support
  async startListening(options = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (this.isListening) {
        logger.log('Already listening');
        return;
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

      this.isListening = true;
      this.continuousMode = options.continuous || false;
      
      return new Promise((resolve, reject) => {
        let finalTranscript = '';
        let interimTranscript = '';
        let recognitionTimeout;

        // Set up timeout
        const resetTimeout = () => {
          if (recognitionTimeout) clearTimeout(recognitionTimeout);
          recognitionTimeout = setTimeout(() => {
            if (!this.continuousMode) {
              this.stopListening();
              resolve({
                transcript: finalTranscript.trim(),
                confidence: 0.9,
                isFinal: true,
                timestamp: new Date().toISOString()
              });
            }
          }, options.timeout || 3000); // 3 second timeout after last speech
        };

        this.recognition.onstart = () => {
          logger.log('🎤 Speech recognition started');
          resetTimeout();
        };

        this.recognition.onresult = (event) => {
          interimTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcript = result[0].transcript;
            
            if (result.isFinal) {
              finalTranscript += transcript + ' ';
              
              // Check for interruption during AI speech
              if (this.isSpeaking && this.onInterruptCallback) {
                logger.log('🛑 User interruption detected');
                this.stopSpeaking();
                this.onInterruptCallback(transcript);
              }
              
              // Call the result callback if provided
              if (options.onResult) {
                options.onResult(transcript, result[0].confidence);
              }
            } else {
              interimTranscript += transcript;
              
              // Provide interim results for real-time feedback
              if (options.onInterim) {
                options.onInterim(interimTranscript);
              }
            }
          }
          
          resetTimeout();
          
          logger.log('📝 Speech recognized:', { 
            final: finalTranscript.trim(), 
            interim: interimTranscript 
          });
        };

        this.recognition.onerror = (event) => {
          logger.error('❌ Speech recognition error:', event.error);
          this.isListening = false;
          
          if (event.error === 'no-speech') {
            // No speech detected is not an error in continuous mode
            if (!this.continuousMode) {
              resolve({
                transcript: finalTranscript.trim() || '',
                confidence: 0,
                isFinal: true,
                timestamp: new Date().toISOString()
              });
            }
          } else {
            const errorMessages = {
              'not-allowed': 'Microphone access denied',
              'audio-capture': 'Microphone not available',
              'network': 'Network error',
              'aborted': 'Recognition cancelled'
            };
            const errorMessage = errorMessages[event.error] || `Recognition error: ${event.error}`;
            reject(new Error(errorMessage));
          }
        };

        this.recognition.onend = () => {
          logger.log('🔚 Speech recognition ended');
          this.isListening = false;
          
          if (!this.continuousMode || finalTranscript.trim()) {
            resolve({
              transcript: finalTranscript.trim(),
              confidence: 0.9,
              isFinal: true,
              timestamp: new Date().toISOString()
            });
          }
        };

        // Start recognition
        try {
          this.recognition.start();
        } catch (error) {
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
      } catch (error) {
        logger.warn('⚠️ Error stopping recognition:', error);
      }
    }
    this.isListening = false;
    this.continuousMode = false;
  }

  // Speak text using AWS Polly or browser fallback
  async speakText(text, options = {}) {
    try {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        logger.warn('⚠️ Empty text provided to speakText');
        return { success: false, error: 'Empty text' };
      }

      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.log('🗣️ Speaking text:', text);
      
      // Try AWS Polly first if enabled
      if (this.pollyEnabled && this.polly) {
        try {
          return await this.speakWithPolly(text, options);
        } catch (pollyError) {
          logger.warn('⚠️ Polly synthesis failed, falling back to browser:', pollyError);
        }
      }
      
      // Fallback to browser synthesis
      return await this.speakWithBrowser(text, options);

    } catch (error) {
      logger.error('❌ Speak text error:', error);
      throw error;
    }
  }

  // Speak using AWS Polly
  async speakWithPolly(text, options = {}) {
    if (!this.polly) {
      throw new Error('AWS Polly not initialized');
    }

    return new Promise((resolve, reject) => {
      const params = {
        Text: text,
        OutputFormat: 'mp3',
        VoiceId: options.voiceId || this.preferredVoiceId,
        Engine: 'neural', // Use neural voice for more natural speech
        SampleRate: '24000',
        TextType: 'text'
      };

      // Add SSML support if needed
      if (text.includes('<speak>')) {
        params.TextType = 'ssml';
      }

      this.polly.synthesizeSpeech(params, async (err, data) => {
        if (err) {
          logger.error('❌ Polly synthesis error:', err);
          reject(err);
          return;
        }

        try {
          // Convert audio stream to blob
          const audioBlob = new Blob([data.AudioStream], { type: 'audio/mpeg' });
          const audioUrl = URL.createObjectURL(audioBlob);

          // Play the audio
          await this.playAudio(audioUrl, options);

          // Clean up
          URL.revokeObjectURL(audioUrl);

          resolve({
            success: true,
            synthesisType: 'aws-polly',
            voiceId: params.VoiceId
          });

        } catch (playError) {
          logger.error('❌ Error playing Polly audio:', playError);
          reject(playError);
        }
      });
    });
  }

  // Play audio with interruption support
  async playAudio(audioUrl, options = {}) {
    return new Promise((resolve, reject) => {
      const audio = new Audio(audioUrl);
      
      // Configure audio
      audio.volume = options.volume || 0.8;
      audio.playbackRate = options.rate || 1.0;

      this.isSpeaking = true;
      this.currentAudio = audio;

      audio.onended = () => {
        logger.log('✅ Audio playback completed');
        this.isSpeaking = false;
        this.currentAudio = null;
        resolve();
      };

      audio.onerror = (error) => {
        logger.error('❌ Audio playback error:', error);
        this.isSpeaking = false;
        this.currentAudio = null;
        reject(error);
      };

      // Play the audio
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
      
      // Configure for natural speech
      utterance.rate = options.rate || 0.9;
      utterance.pitch = options.pitch || 1.0;
      utterance.volume = options.volume || 0.8;
      utterance.lang = 'en-US';

      // Find best voice
      const preferredVoice = this.voices.find(voice => 
        voice.lang.includes('en-US') && voice.name.toLowerCase().includes('natural')
      ) || this.voices.find(voice => 
        voice.lang.includes('en-US')
      ) || this.voices[0];
      
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
    // Stop Polly audio if playing
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

  // Stop speaking (alias for stopCurrentAudio)
  stopSpeaking() {
    this.stopCurrentAudio();
  }

  // Set interruption callback
  setInterruptCallback(callback) {
    this.onInterruptCallback = callback;
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

  // Load available voices
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
      pollyEnabled: this.pollyEnabled || false
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