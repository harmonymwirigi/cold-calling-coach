// src/services/voiceService.js - FIXED VERSION WITH CONTINUOUS LISTENING
import logger from '../utils/logger';

export class VoiceService {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.isSpeaking = false;
        this.continuousListening = false;
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
        this.elevenLabsVoiceId = process.env.REACT_APP_ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';
        
        // CRITICAL FIX: Add conversation callbacks
        this.onUserSpeechCallback = null;
        this.onSilenceCallback = null;
        
        // Bind methods
        this.initialize = this.initialize.bind(this);
        this.startListening = this.startListening.bind(this);
        this.stopListening = this.stopListening.bind(this);
        this.speakText = this.speakText.bind(this);
        this.cleanup = this.cleanup.bind(this);
    }

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
            return false;
        }
    }

    async _performInitialization() {
        logger.log('🎤 Starting voice service initialization...');

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

    async initializeSpeechRecognition() {
        if (typeof window === 'undefined') {
            throw new Error('Window object not available');
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            throw new Error('Speech recognition not supported');
        }

        this.recognition = new SpeechRecognition();
        
        // CRITICAL FIX: Configure for continuous conversation
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        this.recognition.maxAlternatives = 1;

        this.recognition.onstart = () => {
            logger.log('🎤 Speech recognition started');
            this.isListening = true;
        };

        this.recognition.onresult = (event) => {
            const result = event.results[event.results.length - 1];
            const transcript = result[0].transcript.trim();
            const confidence = result[0].confidence || 0.8;
            
            logger.log('📝 Speech recognized:', { transcript, confidence, isFinal: result.isFinal });

            // CRITICAL FIX: Only process final results
            if (result.isFinal && transcript.length > 2) {
                this.handleUserSpeech(transcript, confidence);
            }
        };

        this.recognition.onerror = (event) => {
            logger.error('❌ Speech recognition error:', event.error);
            this.handleSpeechError(event.error);
        };

        this.recognition.onend = () => {
            logger.log('🔚 Speech recognition ended');
            this.isListening = false;
            
            // CRITICAL FIX: Restart if continuous listening is enabled
            if (this.continuousListening && !this.isSpeaking) {
                setTimeout(() => {
                    if (this.continuousListening && !this.isSpeaking) {
                        this.startListening();
                    }
                }, 100);
            }
        };

        logger.log('✅ Speech recognition configured for continuous listening');
    }

    // CRITICAL FIX: Handle user speech and trigger AI response
    handleUserSpeech(transcript, confidence) {
        logger.log('🗣️ Processing user speech:', transcript);
        
        // Stop listening temporarily while processing
        this.stopListening();
        
        // Clear any silence timers
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
        
        // Callback to roleplay context with user input
        if (this.onUserSpeechCallback) {
            this.onUserSpeechCallback(transcript, confidence);
        }
    }

    // CRITICAL FIX: Start continuous listening with callbacks
    startContinuousListening(onUserSpeech, onSilence) {
        this.onUserSpeechCallback = onUserSpeech;
        this.onSilenceCallback = onSilence;
        this.continuousListening = true;
        
        this.startListening();
        
        // CRITICAL FIX: Start silence detection
        this.startSilenceDetection();
    }

    stopContinuousListening() {
        this.continuousListening = false;
        this.onUserSpeechCallback = null;
        this.onSilenceCallback = null;
        this.stopListening();
        this.stopSilenceDetection();
    }

    // CRITICAL FIX: Add silence detection
    startSilenceDetection() {
        this.stopSilenceDetection();
        
        this.silenceTimer = setTimeout(() => {
            if (this.isListening && this.onSilenceCallback) {
                logger.log('⏰ Silence detected');
                this.onSilenceCallback();
            }
        }, 10000); // 10 second silence timeout
    }

    stopSilenceDetection() {
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
    }

    async startListening() {
        if (!this.recognition || this.isListening || this.isSpeaking) {
            return;
        }

        try {
            await this.requestMicrophonePermission();
            this.recognition.start();
        } catch (error) {
            logger.error('❌ Failed to start listening:', error);
            throw error;
        }
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            try {
                this.recognition.stop();
            } catch (error) {
                logger.warn('⚠️ Error stopping recognition:', error);
            }
        }
        this.stopSilenceDetection();
    }

    // CRITICAL FIX: Improved speech synthesis with ElevenLabs
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
            
            this.isSpeaking = true;
            
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
            
            // CRITICAL FIX: Resume listening after speaking
            setTimeout(() => {
                this.isSpeaking = false;
                if (this.continuousListening) {
                    this.startListening();
                }
            }, 500);
            
            return result;

        } catch (error) {
            logger.error('❌ Speak text error:', error);
            this.isSpeaking = false;
            
            // Fallback to browser if other methods fail
            if (this.voiceProvider !== 'browser') {
                logger.log('Falling back to browser synthesis...');
                return await this.speakWithBrowser(text, options);
            }
            throw error;
        }
    }

    // CRITICAL FIX: Improved ElevenLabs integration
    async speakWithElevenLabs(text, options = {}) {
        if (!this.elevenLabsApiKey) {
            throw new Error('ElevenLabs API key not configured');
        }

        try {
            logger.log('🎵 Using ElevenLabs TTS');
            
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
                            similarity_boost: options.similarity || 0.75,
                            style: options.style || 0.0,
                            use_speaker_boost: true
                        }
                    })
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                logger.error('ElevenLabs API error:', response.status, errorText);
                throw new Error(`ElevenLabs API error: ${response.status}`);
            }

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
        }
    }

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

    // Determine voice provider
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

            const timeout = setTimeout(() => {
                this.stopCurrentAudio();
                reject(new Error('Speech synthesis timed out'));
            }, 30000);

            utterance.onend = () => {
                clearTimeout(timeout);
                logger.log('✅ Browser synthesis completed');
                this.currentUtterance = null;
                resolve({
                    success: true,
                    synthesisType: 'browser'
                });
            };

            utterance.onerror = (event) => {
                clearTimeout(timeout);
                logger.error('❌ Browser synthesis error:', event.error);
                this.currentUtterance = null;
                reject(new Error(`Browser synthesis error: ${event.error}`));
            };

            try {
                this.synthesis.speak(utterance);
            } catch (error) {
                clearTimeout(timeout);
                this.currentUtterance = null;
                reject(error);
            }
        });
    }

    stopCurrentAudio() {
        if (this.currentAudio) {
            try {
                this.currentAudio.pause();
                this.currentAudio = null;
            } catch (error) {
                logger.warn('Error stopping audio:', error);
            }
        }

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
    }

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

    handleSpeechError(error) {
        logger.error('Speech recognition error:', error);
        
        const errorMessages = {
            'not-allowed': 'Microphone access denied. Please allow microphone access.',
            'no-speech': 'No speech detected. Please speak clearly.',
            'network': 'Network error. Please check your connection.',
            'audio-capture': 'Microphone not available. Please check your device.',
            'aborted': 'Speech recognition was stopped.',
            'service-not-allowed': 'Speech recognition service not allowed.'
        };
        
        const message = errorMessages[error] || 'Speech recognition error occurred.';
        
        // Auto-restart on recoverable errors
        if (error === 'no-speech' && this.continuousListening) {
            setTimeout(() => {
                if (this.continuousListening && !this.isSpeaking) {
                    this.startListening();
                }
            }, 1000);
        }
    }

    getState() {
        return {
            isListening: this.isListening || false,
            isSpeaking: this.isSpeaking || false,
            isInitialized: this.isInitialized || false,
            continuousListening: this.continuousListening || false,
            voiceProvider: this.voiceProvider,
            elevenLabsConfigured: !!this.elevenLabsApiKey
        };
    }

    cleanup() {
        logger.log('🧹 Cleaning up voice service...');
        
        this.stopContinuousListening();
        this.stopCurrentAudio();
        
        if (this.recognition) {
            this.recognition = null;
        }

        this.isInitialized = false;
        this.initializationPromise = null;
    }
}

// Create and export singleton instance
export const voiceService = new VoiceService();