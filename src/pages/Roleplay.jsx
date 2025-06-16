// src/pages/Roleplay.jsx - CLEAN ENTRY POINT
import React, { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import UnifiedPhoneInterface from '../components/roleplay/UnifiedPhoneInterface';
import { useAuth } from '../contexts/AuthContext';
import { useProgress } from '../contexts/ProgressContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import logger from '../utils/logger';

const Roleplay = () => {
  const { type, mode } = useParams();
  const { userProfile, loading: authLoading } = useAuth();
  const { getRoleplayAccess, loading: progressLoading } = useProgress();
  
  const [validationError, setValidationError] = useState(null);
  const [isValidating, setIsValidating] = useState(true);

  // Valid roleplay types and modes
  const validRoleplayTypes = [
    'opener_practice',
    'pitch_practice', 
    'warmup_challenge',
    'full_simulation',
    'power_hour'
  ];

  const validModes = ['practice', 'marathon', 'legend'];

  // Validate parameters and access
  useEffect(() => {
    const validateAccess = async () => {
      try {
        setIsValidating(true);
        setValidationError(null);

        // Wait for auth and progress to load
        if (authLoading || progressLoading) {
          return;
        }

        // Check if user is authenticated
        if (!userProfile) {
          logger.warn('User not authenticated for roleplay');
          return; // Will redirect to login
        }

        // Validate roleplay type and mode
        if (!validRoleplayTypes.includes(type)) {
          throw new Error(`Invalid roleplay type: ${type}`);
        }

        if (!validModes.includes(mode)) {
          throw new Error(`Invalid mode: ${mode}`);
        }

        // Check access permissions
        const access = getRoleplayAccess(type);
        if (!access?.unlocked) {
          throw new Error(access?.reason || 'You need to unlock this roleplay first.');
        }

        logger.log('✅ Roleplay access validated:', { type, mode, access });

      } catch (error) {
        logger.error('❌ Roleplay validation failed:', error);
        setValidationError(error.message);
      } finally {
        setIsValidating(false);
      }
    };

    validateAccess();
  }, [type, mode, userProfile, authLoading, progressLoading, getRoleplayAccess]);

  // Show loading while validating
  if (authLoading || progressLoading || isValidating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 flex items-center justify-center">
        <div className="text-center text-white">
          <LoadingSpinner size="large" color="white" />
          <p className="mt-4 text-blue-200">
            {authLoading ? 'Checking authentication...' : 
             progressLoading ? 'Loading progress...' : 
             'Validating access...'}
          </p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!userProfile) {
    logger.log('Redirecting to login - user not authenticated');
    return <Navigate to="/login" replace />;
  }

  // Show validation error
  if (validationError) {
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
            {validationError}
          </p>
          <div className="space-y-2">
            <button
              onClick={() => window.history.back()}
              className="w-full bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go Back
            </button>
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="w-full bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show invalid parameters error
  if (!validRoleplayTypes.includes(type) || !validModes.includes(mode)) {
    logger.error('Invalid roleplay parameters:', { type, mode });
    return <Navigate to="/dashboard" replace />;
  }

  // Render the phone interface
  return (
    <div className="roleplay-container">
      <UnifiedPhoneInterface />
    </div>
  );
};

export default Roleplay;