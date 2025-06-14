// src/components/ServiceInitializer.jsx
import React, { useEffect, useState } from 'react';
import LoadingSpinner from './ui/LoadingSpinner';
import { voiceService } from '../services/voiceService';
import { openAIService } from '../services/openaiService';
import logger from '../utils/logger';

const ServiceInitializer = ({ children }) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initializationError, setInitializationError] = useState(null);
  const [servicesReady, setServicesReady] = useState({
    voice: false,
    openai: false
  });

  useEffect(() => {
    const initializeServices = async () => {
      try {
        logger.log('🚀 Starting service initialization...');
        
        const results = {
          voice: false,
          openai: false
        };

        // Initialize Voice Service (optional - can fail gracefully)
        try {
          if (voiceService && typeof voiceService.initialize === 'function') {
            await voiceService.initialize();
            results.voice = true;
            logger.log('✅ Voice service initialized');
          } else {
            logger.warn('⚠️ Voice service not available');
          }
        } catch (voiceError) {
          logger.warn('⚠️ Voice service initialization failed (non-critical):', voiceError);
          // Voice service failure is not critical - continue
        }

        // Initialize OpenAI Service (more critical)
        try {
          if (openAIService && typeof openAIService.initialize === 'function') {
            await openAIService.initialize();
            results.openai = true;
            logger.log('✅ OpenAI service initialized');
          } else {
            logger.warn('⚠️ OpenAI service not available');
          }
        } catch (openaiError) {
          logger.error('❌ OpenAI service initialization failed:', openaiError);
          // OpenAI failure is more critical but don't block the app
          results.openai = false;
        }

        setServicesReady(results);
        logger.log('✅ Service initialization completed:', results);

      } catch (error) {
        logger.error('❌ Service initialization failed:', error);
        setInitializationError(error.message);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeServices();
  }, []);

  // Show loading screen during initialization
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 flex items-center justify-center">
        <div className="text-center text-white">
          <LoadingSpinner size="large" color="white" />
          <h2 className="mt-6 text-xl font-semibold">Initializing Services</h2>
          <p className="mt-2 text-blue-200">Setting up voice and AI services...</p>
        </div>
      </div>
    );
  }

  // Show error if critical services failed
  if (initializationError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Initialization Failed
          </h2>
          <p className="text-gray-600 mb-4">
            {initializationError}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show warning if voice service failed but continue
  const showVoiceWarning = !servicesReady.voice;

  return (
    <>
      {showVoiceWarning && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-yellow-500">⚠️</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Voice features may not be available. The app will work but without speech recognition and synthesis.
                Try refreshing the page or check your browser compatibility.
              </p>
            </div>
          </div>
        </div>
      )}
      {children}
    </>
  );
};

export default ServiceInitializer;