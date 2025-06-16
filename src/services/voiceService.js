// src/services/voiceService.js - COMPLETELY REBUILT FOR RELIABILITY
class VoiceService {
    constructor() {
      this.isInitialized = false;
      this.isListening = false;
      this.isSpeaking = false;
      this.recognition = null;
      this.currentUtterance = null;
      this.onUserSpeechCallback = null;
      this.onErrorCallback = null;
      this.conversationActive = false;
      
      // Voice settings
      this.voiceSettings = {
        rate: 0.9,
        pitch: 1.0,
        volume: 0.8,
        lang: 'en-US'
      };
      
      // State tracking
      this.lastSpeechTime = 0;
      this.silenceTimeout = null;
      this.maxSilenceMs = 8000; // 8 seconds of silence
      
      console.log('🎤 VoiceService constructor initialized');
    }
  
    async initialize() {
      if (this.isInitialized) {
        console.log('🎤 VoiceService already initialized');
        return true;
      }
  
      try {
        console.log('🎤 Initializing VoiceService...');
  
        // Check browser support
        if (!this.checkBrowserSupport()) {
          throw new Error('Browser does not support required speech features');
        }
  
        // Request microphone permission
        await this.requestMicrophonePermission();
  
        // Initialize speech recognition
        await this.initializeSpeechRecognition();
  
        // Test speech synthesis
        await this.testSpeechSynthesis();
  
        this.isInitialized = true;
        console.log('✅ VoiceService initialized successfully');
        return true;
  
      } catch (error) {
        console.error('❌ VoiceService initialization failed:', error);
        this.isInitialized = false;
        throw error;
      }
    }
  
    checkBrowserSupport() {
      const hasRecognition = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
      const hasSynthesis = 'speechSynthesis' in window;
      
      console.log('🔍 Browser support check:', {
        recognition: hasRecognition,
        synthesis: hasSynthesis
      });
      
      return hasRecognition && hasSynthesis;
    }
  
    async requestMicrophonePermission() {
      try {
        console.log('🎤 Requesting microphone permission...');
        
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
        throw new Error('Microphone permission is required for voice features');
      }
    }
  
    async initializeSpeechRecognition() {
      try {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        // Configure recognition
        this.recognition.continuous = false; // Changed to false for better control
        this.recognition.interimResults = true;
        this.recognition.lang = this.voiceSettings.lang;
        this.recognition.maxAlternatives = 1;
  
        // Set up event listeners
        this.recognition.onstart = () => {
          this.isListening = true;
          this.lastSpeechTime = Date.now();
          console.log('🎤 Speech recognition started');
          this.startSilenceTimer();
        };
  
        this.recognition.onresult = (event) => {
          this.handleSpeechResult(event);
        };
  
        this.recognition.onend = () => {
          this.isListening = false;
          console.log('🎤 Speech recognition ended');
          this.clearSilenceTimer();
          
          // Auto-restart if conversation is still active
          if (this.conversationActive && !this.isSpeaking) {
            setTimeout(() => {
              if (this.conversationActive && !this.isSpeaking) {
                this.startListening();
              }
            }, 1000);
          }
        };
  
        this.recognition.onerror = (event) => {
          console.error('❌ Speech recognition error:', event.error);
          this.isListening = false;
          this.clearSilenceTimer();
          
          if (this.onErrorCallback) {
            this.onErrorCallback(`Speech recognition error: ${event.error}`);
          }
        };
  
        console.log('✅ Speech recognition initialized');
      } catch (error) {
        console.error('❌ Speech recognition setup failed:', error);
        throw error;
      }
    }
  
    handleSpeechResult(event) {
      try {
        const result = event.results[event.resultIndex];
        const transcript = result[0].transcript.trim();
        const confidence = result[0].confidence || 0.9;
        const isFinal = result.isFinal;
        
        console.log('📝 Speech result:', { 
          transcript, 
          confidence, 
          isFinal,
          length: transcript.length 
        });
  
        if (isFinal && transcript.length > 2) {
          this.lastSpeechTime = Date.now();
          
          // Send to callback if available
          if (this.onUserSpeechCallback) {
            this.onUserSpeechCallback(transcript, confidence);
          }
          
          // Stop listening since we got a final result
          this.stopListening();
        }
      } catch (error) {
        console.error('❌ Error handling speech result:', error);
      }
    }
  
    startSilenceTimer() {
      this.clearSilenceTimer();
      
      this.silenceTimeout = setTimeout(() => {
        if (this.isListening) {
          console.log('⏰ Silence timeout - stopping listening');
          this.stopListening();
          
          // Prompt user if conversation is active
          if (this.conversationActive) {
            this.speakText("Are you still there?");
          }
        }
      }, this.maxSilenceMs);
    }
  
    clearSilenceTimer() {
      if (this.silenceTimeout) {
        clearTimeout(this.silenceTimeout);
        this.silenceTimeout = null;
      }
    }
  
    async testSpeechSynthesis() {
      try {
        if (!window.speechSynthesis) {
          throw new Error('Speech synthesis not available');
        }
        
        // Wait for voices to load
        if (speechSynthesis.getVoices().length === 0) {
          await new Promise(resolve => {
            speechSynthesis.addEventListener('voiceschanged', resolve, { once: true });
            setTimeout(resolve, 1000); // Fallback timeout
          });
        }
        
        console.log('✅ Speech synthesis ready');
        return true;
      } catch (error) {
        console.error('❌ Speech synthesis test failed:', error);
        throw error;
      }
    }
  
    // START CONVERSATION FLOW
    startConversation(onUserSpeechCallback, onErrorCallback) {
      console.log('🎬 Starting conversation flow');
      
      this.onUserSpeechCallback = onUserSpeechCallback;
      this.onErrorCallback = onErrorCallback;
      this.conversationActive = true;
      
      return true;
    }
  
    stopConversation() {
      console.log('🛑 Stopping conversation flow');
      
      this.conversationActive = false;
      this.stopListening();
      this.stopSpeaking();
      this.onUserSpeechCallback = null;
      this.onErrorCallback = null;
      
      return true;
    }
  
    // LISTENING METHODS
    startListening() {
      if (!this.isInitialized) {
        console.error('❌ Cannot start listening - service not initialized');
        return false;
      }
  
      if (this.isListening) {
        console.log('⚠️ Already listening');
        return true;
      }
  
      if (this.isSpeaking) {
        console.log('⚠️ Cannot listen while speaking');
        return false;
      }
  
      try {
        console.log('🎤 Starting to listen...');
        this.recognition.start();
        return true;
      } catch (error) {
        console.error('❌ Failed to start listening:', error);
        return false;
      }
    }
  
    stopListening() {
      if (!this.isListening) {
        return true;
      }
  
      try {
        console.log('🔇 Stopping listening...');
        this.recognition.stop();
        this.clearSilenceTimer();
        return true;
      } catch (error) {
        console.error('❌ Error stopping listening:', error);
        return false;
      }
    }
  
    // SPEAKING METHODS
    async speakText(text) {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        console.warn('⚠️ Invalid text for speech:', text);
        return false;
      }
  
      if (this.isSpeaking) {
        console.log('🔇 Stopping current speech to speak new text');
        this.stopSpeaking();
        await new Promise(resolve => setTimeout(resolve, 100)); // Brief pause
      }
  
      return new Promise((resolve, reject) => {
        try {
          console.log('🗣️ Speaking:', text.substring(0, 100) + '...');
          
          this.isSpeaking = true;
          
          // Stop listening while speaking
          if (this.isListening) {
            this.stopListening();
          }
  
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = this.voiceSettings.rate;
          utterance.pitch = this.voiceSettings.pitch;
          utterance.volume = this.voiceSettings.volume;
          utterance.lang = this.voiceSettings.lang;
  
          // Try to use a good voice
          const voices = speechSynthesis.getVoices();
          const preferredVoice = voices.find(voice => 
            voice.lang.startsWith('en') && voice.name.includes('Google')
          ) || voices.find(voice => voice.lang.startsWith('en')) || voices[0];
          
          if (preferredVoice) {
            utterance.voice = preferredVoice;
          }
  
          utterance.onstart = () => {
            console.log('🗣️ Speech started');
          };
  
          utterance.onend = () => {
            console.log('✅ Speech completed');
            this.isSpeaking = false;
            this.currentUtterance = null;
            
            // Start listening again if conversation is active
            if (this.conversationActive) {
              setTimeout(() => {
                if (this.conversationActive && !this.isSpeaking) {
                  this.startListening();
                }
              }, 500); // Brief pause before listening
            }
            
            resolve(true);
          };
  
          utterance.onerror = (event) => {
            console.error('❌ Speech error:', event.error);
            this.isSpeaking = false;
            this.currentUtterance = null;
            reject(new Error(`Speech synthesis error: ${event.error}`));
          };
  
          this.currentUtterance = utterance;
          speechSynthesis.speak(utterance);
  
        } catch (error) {
          console.error('❌ Error in speakText:', error);
          this.isSpeaking = false;
          reject(error);
        }
      });
    }
  
    stopSpeaking() {
      if (this.isSpeaking) {
        console.log('🔇 Stopping speech...');
        speechSynthesis.cancel();
        this.isSpeaking = false;
        this.currentUtterance = null;
      }
      return true;
    }
  
    // STATE METHODS
    getState() {
      return {
        isInitialized: this.isInitialized,
        isListening: this.isListening,
        isSpeaking: this.isSpeaking,
        conversationActive: this.conversationActive
      };
    }
  
    // CLEANUP
    cleanup() {
      console.log('🧹 Cleaning up voice service...');
      
      this.stopConversation();
      this.clearSilenceTimer();
      
      if (this.recognition) {
        try {
          this.recognition.stop();
        } catch (error) {
          console.warn('Error stopping recognition during cleanup:', error);
        }
        this.recognition = null;
      }
  
      this.isInitialized = false;
      console.log('✅ Voice service cleanup complete');
    }
  }
  
  // Create singleton instance
  export const voiceService = new VoiceService();
  export default voiceService;