// src/services/voiceService.js - MOBILE-OPTIMIZED VERSION
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
        
        // MOBILE FIX: Detect mobile device
        this.isMobile = this.detectMobileDevice();
        this.mobileRecognitionActive = false;
        this.lastRecognitionStart = 0;
        this.recognitionRestartDelay = this.isMobile ? 1000 : 100; // Longer delay on mobile
        
        // Voice provider configuration
        this.voiceProvider = 'browser'; // Default to browser for mobile compatibility
        this.elevenLabsApiKey = process.env.REACT_APP_ELEVENLABS_API_KEY;
        this.elevenLabsVoiceId = process.env.REACT_APP_ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';
        
        // MOBILE FIX: Touch interaction tracking
        this.userHasInteracted = false;
        this.setupMobileInteractionDetection();
        
        // Conversation callbacks
        this.onUserSpeechCallback = null;
        this.onSilenceCallback = null;
        
        logger.log(`🎤 Voice service initialized for ${this.isMobile ? 'MOBILE' : 'DESKTOP'} device`);
    }

    // MOBILE FIX: Detect mobile devices
    detectMobileDevice() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        return /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
    }

    // MOBILE FIX: Setup touch interaction detection
    setupMobileInteractionDetection() {
        if (this.isMobile) {
            const markInteraction = () => {
                this.userHasInteracted = true;
                logger.log('📱 User interaction detected on mobile');
            };
            
            document.addEventListener('touchstart', markInteraction, { once: true });
            document.addEventListener('click', markInteraction, { once: true });
        } else {
            this.userHasInteracted = true; // Desktop doesn't need this
        }
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
        logger.log(`🎤 Starting voice service initialization for ${this.isMobile ? 'MOBILE' : 'DESKTOP'}...`);

        // Initialize speech synthesis
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            this.synthesis = window.speechSynthesis;
            logger.log('✅ Speech synthesis available');
        }

        // Initialize speech recognition with mobile considerations
        try {
            await this.initializeSpeechRecognition();
            logger.log('✅ Speech recognition initialized');
        } catch (recognitionError) {
            logger.warn('⚠️ Speech recognition failed:', recognitionError);
            if (this.isMobile) {
                logger.warn('📱 Mobile speech recognition has limited support');
            }
        }

        // Mobile-specific voice provider logic
        if (this.isMobile) {
            this.voiceProvider = 'browser'; // Always use browser on mobile
            logger.log('📱 Using browser synthesis for mobile compatibility');
        } else {
            await this.determineVoiceProvider();
        }

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
        
        // MOBILE FIX: Different configuration for mobile
        this.recognition.continuous = !this.isMobile; // Disable continuous on mobile
        this.recognition.interimResults = !this.isMobile; // Disable interim on mobile
        this.recognition.lang = 'en-US';
        this.recognition.maxAlternatives = 1;

        this.recognition.onstart = () => {
            this.lastRecognitionStart = Date.now();
            logger.log(`🎤 Speech recognition started (${this.isMobile ? 'MOBILE' : 'DESKTOP'} mode)`);
            this.isListening = true;
            this.mobileRecognitionActive = true;
        };

        this.recognition.onresult = (event) => {
            const result = event.results[event.results.length - 1];
            const transcript = result[0].transcript.trim();
            const confidence = result[0].confidence || 0.8;
            
            logger.log('📝 Speech recognized:', { 
                transcript: transcript.substring(0, 50), 
                confidence, 
                isFinal: result.isFinal,
                mobile: this.isMobile 
            });

            // MOBILE FIX: Process both final and interim results on mobile
            if (result.isFinal || this.isMobile) {
                if (transcript.length > 2) {
                    this.handleUserSpeech(transcript, confidence);
                }
            }
        };

        this.recognition.onerror = (event) => {
            logger.error('❌ Speech recognition error:', event.error);
            this.mobileRecognitionActive = false;
            this.handleSpeechError(event.error);
        };

        this.recognition.onend = () => {
            logger.log('🔚 Speech recognition ended');
            this.isListening = false;
            this.mobileRecognitionActive = false;
            
            // MOBILE FIX: Controlled restart logic
            if (this.continuousListening && !this.isSpeaking) {
                const timeSinceStart = Date.now() - this.lastRecognitionStart;
                
                // MOBILE FIX: Only restart if enough time has passed and we're still in continuous mode
                if (timeSinceStart > 500) { // Minimum 500ms between restarts
                    setTimeout(() => {
                        if (this.continuousListening && !this.isSpeaking && !this.mobileRecognitionActive) {
                            logger.log('🔄 Restarting speech recognition...');
                            this.startListening();
                        }
                    }, this.recognitionRestartDelay);
                }
            }
        };

        logger.log(`✅ Speech recognition configured for ${this.isMobile ? 'MOBILE' : 'DESKTOP'}`);
    }

    // MOBILE FIX: Handle user speech with mobile considerations
    handleUserSpeech(transcript, confidence) {
        logger.log('🗣️ Processing user speech:', transcript.substring(0, 50));
        
        // MOBILE FIX: Stop listening immediately on mobile to prevent restart loop
        if (this.isMobile) {
            this.stopListening();
        }
        
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

    // MOBILE FIX: Mobile-aware continuous listening
    startContinuousListening(onUserSpeech, onSilence) {
        this.onUserSpeechCallback = onUserSpeech;
        this.onSilenceCallback = onSilence;
        
        if (this.isMobile) {
            logger.log('📱 Starting MANUAL listening mode for mobile');
            this.continuousListening = false; // Don't auto-restart on mobile
            // Instead, we'll use manual trigger system
        } else {
            logger.log('🖥️ Starting CONTINUOUS listening mode for desktop');
            this.continuousListening = true;
        }
        
        this.startListening();
        
        // MOBILE FIX: Different silence detection for mobile
        if (!this.isMobile) {
            this.startSilenceDetection();
        }
    }

    stopContinuousListening() {
        this.continuousListening = false;
        this.onUserSpeechCallback = null;
        this.onSilenceCallback = null;
        this.stopListening();
        this.stopSilenceDetection();
    }

    // MOBILE FIX: Mobile-aware silence detection
    startSilenceDetection() {
        this.stopSilenceDetection();
        
        // MOBILE FIX: Longer silence timeout for mobile
        const silenceTimeout = this.isMobile ? 15000 : 10000;
        
        this.silenceTimer = setTimeout(() => {
            if (this.isListening && this.onSilenceCallback) {
                logger.log(`⏰ Silence detected (${this.isMobile ? 'mobile' : 'desktop'})`);
                this.onSilenceCallback();
            }
        }, silenceTimeout);
    }

    stopSilenceDetection() {
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
    }

    async startListening() {
        // MOBILE FIX: Check for user interaction on mobile
        if (this.isMobile && !this.userHasInteracted) {
            logger.warn('📱 Mobile requires user interaction before starting microphone');
            throw new Error('Please tap the screen first to enable microphone on mobile');
        }

        if (!this.recognition || this.isListening || this.isSpeaking) {
            return;
        }

        // MOBILE FIX: Prevent rapid restarts
        const timeSinceLastStart = Date.now() - this.lastRecognitionStart;
        if (timeSinceLastStart < this.recognitionRestartDelay) {
            logger.log('🚫 Preventing rapid recognition restart');
            return;
        }

        try {
            await this.requestMicrophonePermission();
            this.recognition.start();
        } catch (error) {
            logger.error('❌ Failed to start listening:', error);
            this.mobileRecognitionActive = false;
            throw error;
        }
    }

    stopListening() {
        if (this.recognition && (this.isListening || this.mobileRecognitionActive)) {
            try {
                this.recognition.stop();
                this.mobileRecognitionActive = false;
            } catch (error) {
                logger.warn('⚠️ Error stopping recognition:', error);
            }
        }
        this.stopSilenceDetection();
    }

    // MOBILE FIX: Mobile-optimized speech synthesis
    async speakText(text, options = {}) {
        try {
            if (!text || typeof text !== 'string' || text.trim().length === 0) {
                logger.warn('⚠️ Empty text provided to speakText');
                return { success: false, error: 'Empty text' };
            }

            if (!this.isInitialized) {
                await this.initialize();
            }

            logger.log(`🗣️ Speaking text (${this.isMobile ? 'mobile' : 'desktop'}):`, text.substring(0, 50));
            
            this.isSpeaking = true;
            
            let result;
            // MOBILE FIX: Always use browser synthesis on mobile for better compatibility
            if (this.isMobile || this.voiceProvider === 'browser') {
                result = await this.speakWithBrowser(text, options);
            } else {
                try {
                    result = await this.speakWithElevenLabs(text, options);
                } catch (elevenLabsError) {
                    logger.warn('ElevenLabs failed, falling back to browser:', elevenLabsError);
                    result = await this.speakWithBrowser(text, options);
                }
            }
            
            // MOBILE FIX: Different post-speech behavior for mobile
            setTimeout(() => {
                this.isSpeaking = false;
                if (this.continuousListening && !this.isMobile) {
                    // Only auto-restart on desktop
                    this.startListening();
                } else if (this.isMobile && this.onUserSpeechCallback) {
                    // On mobile, user needs to manually trigger next input
                    logger.log('📱 Mobile: Waiting for manual input trigger');
                }
            }, 500);
            
            return result;

        } catch (error) {
            logger.error('❌ Speak text error:', error);
            this.isSpeaking = false;
            throw error;
        }
    }

    // Mobile-optimized browser synthesis
    async speakWithBrowser(text, options = {}) {
        if (!this.synthesis) {
            throw new Error('Browser speech synthesis not supported');
        }

        return new Promise((resolve, reject) => {
            this.stopCurrentAudio();

            const utterance = new SpeechSynthesisUtterance(text);
            
            // MOBILE FIX: Mobile-optimized settings
            utterance.rate = this.isMobile ? 0.8 : (options.rate || 0.9);
            utterance.pitch = options.pitch || 1.0;
            utterance.volume = options.volume || 0.8;
            utterance.lang = 'en-US';

            // Find best voice for mobile
            const preferredVoice = this.voices.find(voice => 
                voice.lang.includes('en-US') && 
                (this.isMobile ? true : voice.name.toLowerCase().includes('female'))
            ) || this.voices.find(voice => voice.lang.includes('en-US')) || this.voices[0];
            
            if (preferredVoice) {
                utterance.voice = preferredVoice;
            }

            this.currentUtterance = utterance;

            // MOBILE FIX: Shorter timeout for mobile
            const timeout = setTimeout(() => {
                this.stopCurrentAudio();
                reject(new Error('Speech synthesis timed out'));
            }, this.isMobile ? 15000 : 30000);

            utterance.onend = () => {
                clearTimeout(timeout);
                logger.log('✅ Browser synthesis completed');
                this.currentUtterance = null;
                resolve({
                    success: true,
                    synthesisType: 'browser',
                    mobile: this.isMobile
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

    // ElevenLabs synthesis (desktop only)
    async speakWithElevenLabs(text, options = {}) {
        if (this.isMobile) {
            throw new Error('ElevenLabs not supported on mobile');
        }

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
                throw new Error(`ElevenLabs API error: ${response.status}`);
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);

            await this.playAudio(audioUrl, options);
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

    // Voice provider selection (desktop only)
    async determineVoiceProvider() {
        if (this.isMobile) {
            this.voiceProvider = 'browser';
            return;
        }

        // Check ElevenLabs first (desktop only)
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

        this.voiceProvider = 'browser';
        logger.log('ℹ️ Using browser speech synthesis');
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
        
        // MOBILE FIX: Don't auto-restart on mobile errors
        if (error === 'no-speech' && this.continuousListening && !this.isMobile) {
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
            elevenLabsConfigured: !!this.elevenLabsApiKey,
            isMobile: this.isMobile,
            userHasInteracted: this.userHasInteracted
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
        this.mobileRecognitionActive = false;
    }
}

// Create and export singleton instance
export const voiceService = new VoiceService();