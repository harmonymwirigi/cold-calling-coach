// src/pages/Roleplay.jsx - UPDATED WITH MOBILE DETECTION
import React, { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import FixedPhoneInterface from '../components/roleplay/FixedPhoneInterface';
import MobilePhoneInterface from '../components/roleplay/MobilePhoneInterface';
import { useAuth } from '../contexts/AuthContext';
import { useProgress } from '../contexts/ProgressContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import logger from '../utils/logger';

const Roleplay = () => {
  const { type, mode } = useParams();
  const { userProfile, loading: authLoading } = useAuth();
  const { getRoleplayAccess, loading: progressLoading } = useProgress();
  
  // Mobile detection state
  const [isMobile, setIsMobile] = useState(false);
  const [deviceDetected, setDeviceDetected] = useState(false);

  // Detect mobile device
  useEffect(() => {
    const detectMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const mobileCheck = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      
      // Additional checks for mobile behavior
      const screenCheck = window.innerWidth <= 768;
      const touchCheck = 'ontouchstart' in window;
      
      const isMobileDevice = mobileCheck || (screenCheck && touchCheck);
      
      setIsMobile(isMobileDevice);
      setDeviceDetected(true);
      
      logger.log(`📱 Device detection: ${isMobileDevice ? 'MOBILE' : 'DESKTOP'}`, {
        userAgent: mobileCheck,
        screen: screenCheck,
        touch: touchCheck,
        width: window.innerWidth
      });
    };

    detectMobile();
    
    // Re-detect on window resize
    window.addEventListener('resize', detectMobile);
    
    return () => {
      window.removeEventListener('resize', detectMobile);
    };
  }, []);

  const validRoleplayTypes = [
    'opener_practice',
    'pitch_practice', 
    'warmup_challenge',
    'full_simulation',
    'power_hour'
  ];

  const validModes = ['practice', 'marathon', 'legend'];

  // Show loading while detecting device or loading auth/progress
  if (!deviceDetected || authLoading || progressLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 flex items-center justify-center">
        <div className="text-center text-white">
          <LoadingSpinner size="large" color="white" />
          <p className="mt-4 text-blue-200">
            {!deviceDetected ? 'Detecting device...' : 'Loading roleplay...'}
          </p>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return <Navigate to="/login" replace />;
  }

  if (!validRoleplayTypes.includes(type) || !validModes.includes(mode)) {
    logger.error('Invalid roleplay parameters:', { type, mode });
    return <Navigate to="/dashboard" replace />;
  }

  const access = getRoleplayAccess(type);
  if (!access?.unlocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔒</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600 mb-4">
            {access?.reason || 'You need to unlock this roleplay first.'}
          </p>
          <button
            onClick={() => window.history.back()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Show mobile-specific warning/instructions
  if (isMobile) {
    return (
      <>
        {/* Mobile Instructions Modal */}
        <MobileInstructionsModal />
        {/* Mobile Interface */}
        <MobilePhoneInterface />
      </>
    );
  }

  // Desktop interface
  return <FixedPhoneInterface />;
};

// Mobile Instructions Component
const MobileInstructionsModal = () => {
  const [showInstructions, setShowInstructions] = useState(true);

  if (!showInstructions) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full">
        <div className="text-center mb-4">
          <span className="text-4xl mb-2 block">📱</span>
          <h3 className="text-xl font-bold text-gray-900">Mobile Roleplay Mode</h3>
        </div>
        
        <div className="space-y-3 text-sm text-gray-700 mb-6">
          <div className="flex items-start space-x-2">
            <span className="text-blue-600 font-bold">1.</span>
            <p>Allow microphone access when prompted</p>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-blue-600 font-bold">2.</span>
            <p>Use the large blue button to speak (push-to-talk or tap mode)</p>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-blue-600 font-bold">3.</span>
            <p>You can type responses using the "Type" button if voice doesn't work</p>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-blue-600 font-bold">4.</span>
            <p>Use headphones for better audio quality</p>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <p className="text-xs text-yellow-800">
            <strong>Note:</strong> Mobile speech recognition has limitations. 
            If voice doesn't work well, use the text input option.
          </p>
        </div>

        <button
          onClick={() => setShowInstructions(false)}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Start Roleplay
        </button>
      </div>
    </div>
  );
};

export default Roleplay;