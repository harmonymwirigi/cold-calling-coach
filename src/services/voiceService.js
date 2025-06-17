// src/services/voiceService.js - FIXED speech recognition flow
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
      
      // FIXED: Better state tracking
      this.lastSpeechTime = 0;
      this.silenceTimeout = null;
      this.maxSilenceMs = 8000;
      this.isProcessingResult = false;
      this.shouldRestart = false;
      
      console.log('🎤 VoiceService constructor initialized');
    }

    async initialize() {
      if (this.isInitialized) {
        console.log('🎤 VoiceService already initialized');
        return true;
      }

      try {
        console.log('🎤 Initializing VoiceService...');

        if (!this.checkBrowserSupport()) {
          throw new Error('Browser does not support required speech features');
        }

        await this.requestMicrophonePermission();
        await this.initializeSpeechRecognition();
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
        
        // FIXED: Better recognition settings
        this.recognition.continuous = true; // Keep listening
        this.recognition.interimResults = true;
        this.recognition.lang = this.voiceSettings.lang;
        this.recognition.maxAlternatives = 1;

        // FIXED: Improved event handlers
        this.recognition.onstart = () => {
          this.isListening = true;
          this.isProcessingResult = false;
          this.lastSpeechTime = Date.now();
          console.log('🎤 Speech recognition started');
          this.startSilenceTimer();
        };

        this.recognition.onresult = (event) => {
          this.handleSpeechResult(event);
        };

        this.recognition.onend = () => {
          console.log('🎤 Speech recognition ended');
          this.isListening = false;
          this.clearSilenceTimer();
          
          // FIXED: Only restart if conversation is active AND we should restart
          if (this.conversationActive && this.shouldRestart && !this.isSpeaking && !this.isProcessingResult) {
            setTimeout(() => {
              if (this.conversationActive && !this.isSpeaking && !this.isProcessingResult) {
                console.log('🔄 Auto-restarting speech recognition');
                this.startListening();
              }
            }, 500);
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

    // FIXED: Better speech result handling
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
    
        // FIXED: Process final results with proper state management
        if (isFinal && transcript.length > 2 && !this.isProcessingResult) {
          this.isProcessingResult = true;
          this.shouldRestart = false; // Stop auto-restart while processing
          this.lastSpeechTime = Date.now();
          
          console.log('🔄 Processing final result:', transcript);
          
          if (this.onUserSpeechCallback) {
            try {
              // Call the callback immediately
              this.onUserSpeechCallback(transcript, confidence);
              console.log('✅ User speech callback completed');
              
              // FIXED: Don't stop conversation - mark as ready for next input
              setTimeout(() => {
                this.isProcessingResult = false;
                this.shouldRestart = true; // Allow restart after AI responds
                console.log('🔄 Ready for next user input');
              }, 2000); // Wait 2 seconds for AI to respond
              
            } catch (callbackError) {
              console.error('❌ Error in user speech callback:', callbackError);
              this.isProcessingResult = false;
              this.shouldRestart = true;
            }
          } else {
            console.warn('⚠️ No user speech callback set');
            this.isProcessingResult = false;
            this.shouldRestart = true;
          }
        }
      } catch (error) {
        console.error('❌ Error handling speech result:', error);
        this.isProcessingResult = false;
        this.shouldRestart = true;
      }
    }
    
    // ALSO: Modify the speakText method to restart listening after AI speaks
    async speakText(text) {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        console.warn('⚠️ Invalid text for speech:', text);
        return false;
      }
    
      if (this.isSpeaking) {
        console.log('🔇 Stopping current speech to speak new text');
        this.stopSpeaking();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    
      return new Promise((resolve, reject) => {
        try {
          console.log('🗣️ Speaking:', text.substring(0, 100) + '...');
          
          this.isSpeaking = true;
          this.shouldRestart = false; // Don't restart while speaking
          
          if (this.isListening) {
            this.stopListening();
          }
    
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = this.voiceSettings.rate;
          utterance.pitch = this.voiceSettings.pitch;
          utterance.volume = this.voiceSettings.volume;
          utterance.lang = this.voiceSettings.lang;
    
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
            
            // FIXED: Restart listening automatically after AI speaks
            if (this.conversationActive && !this.isProcessingResult) {
              this.shouldRestart = true;
              setTimeout(() => {
                if (this.conversationActive && !this.isSpeaking && !this.isProcessingResult) {
                  console.log('🔄 Restarting listening after speech');
                  this.startListening();
                }
              }, 1000); // Wait 1 second after AI finishes speaking
            }
            
            resolve(true);
          };
    
          utterance.onerror = (event) => {
            console.error('❌ Speech error:', event.error);
            this.isSpeaking = false;
            this.currentUtterance = null;
            this.shouldRestart = true;
            reject(new Error(`Speech synthesis error: ${event.error}`));
          };
    
          this.currentUtterance = utterance;
          speechSynthesis.speak(utterance);
    
        } catch (error) {
          console.error('❌ Error in speakText:', error);
          this.isSpeaking = false;
          this.shouldRestart = true;
          reject(error);
        }
      });
    }
    startSilenceTimer() {
      this.clearSilenceTimer();
      
      this.silenceTimeout = setTimeout(() => {
        if (this.isListening && !this.isProcessingResult) {
          console.log('⏰ Silence timeout - stopping listening');
          this.stopListening();
          
          // FIXED: Only prompt if conversation is still active
          if (this.conversationActive && !this.isProcessingResult) {
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
        
        if (speechSynthesis.getVoices().length === 0) {
          await new Promise(resolve => {
            speechSynthesis.addEventListener('voiceschanged', resolve, { once: true });
            setTimeout(resolve, 1000);
          });
        }
        
        console.log('✅ Speech synthesis ready');
        return true;
      } catch (error) {
        console.error('❌ Speech synthesis test failed:', error);
        throw error;
      }
    }

    // FIXED: Better conversation flow management
    startConversation(onUserSpeechCallback, onErrorCallback) {
      console.log('🎬 Starting conversation flow');
      
      this.onUserSpeechCallback = onUserSpeechCallback;
      this.onErrorCallback = onErrorCallback;
      this.conversationActive = true;
      this.shouldRestart = true;
      this.isProcessingResult = false;
      
      console.log('✅ Conversation callbacks set:', {
        hasUserSpeechCallback: !!this.onUserSpeechCallback,
        hasErrorCallback: !!this.onErrorCallback
      });
      
      return true;
    }

    // FIXED: Complete conversation cleanup
    stopConversation() {
      console.log('🛑 Stopping conversation flow');
      
      this.conversationActive = false;
      this.shouldRestart = false;
      this.isProcessingResult = false;
      
      this.stopListening();
      this.stopSpeaking();
      this.clearSilenceTimer();
      
      this.onUserSpeechCallback = null;
      this.onErrorCallback = null;
      
      console.log('✅ Conversation stopped and cleaned up');
      return true;
    }

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

      if (this.isProcessingResult) {
        console.log('⚠️ Cannot listen while processing result');
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

    // FIXED: Better speech handling with restart logic
    async speakText(text) {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        console.warn('⚠️ Invalid text for speech:', text);
        return false;
      }

      if (this.isSpeaking) {
        console.log('🔇 Stopping current speech to speak new text');
        this.stopSpeaking();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return new Promise((resolve, reject) => {
        try {
          console.log('🗣️ Speaking:', text.substring(0, 100) + '...');
          
          this.isSpeaking = true;
          this.shouldRestart = false; // Don't restart while speaking
          
          if (this.isListening) {
            this.stopListening();
          }

          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = this.voiceSettings.rate;
          utterance.pitch = this.voiceSettings.pitch;
          utterance.volume = this.voiceSettings.volume;
          utterance.lang = this.voiceSettings.lang;

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
            
            // FIXED: Only restart listening if conversation is active and not processing
            if (this.conversationActive && !this.isProcessingResult) {
              this.shouldRestart = true;
              setTimeout(() => {
                if (this.conversationActive && !this.isSpeaking && !this.isProcessingResult) {
                  console.log('🔄 Restarting listening after speech');
                  this.startListening();
                }
              }, 500);
            }
            
            resolve(true);
          };

          utterance.onerror = (event) => {
            console.error('❌ Speech error:', event.error);
            this.isSpeaking = false;
            this.currentUtterance = null;
            this.shouldRestart = true;
            reject(new Error(`Speech synthesis error: ${event.error}`));
          };

          this.currentUtterance = utterance;
          speechSynthesis.speak(utterance);

        } catch (error) {
          console.error('❌ Error in speakText:', error);
          this.isSpeaking = false;
          this.shouldRestart = true;
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

    getState() {
      return {
        isInitialized: this.isInitialized,
        isListening: this.isListening,
        isSpeaking: this.isSpeaking,
        conversationActive: this.conversationActive,
        isProcessingResult: this.isProcessingResult
      };
    }

    // FIXED: Complete cleanup
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
      this.isProcessingResult = false;
      this.shouldRestart = false;
      console.log('✅ Voice service cleanup complete');
    }
  }

  export const voiceService = new VoiceService();
  export default voiceService;