// src/pages/Roleplay.jsx
import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import FunctionalPhoneInterface from '../components/roleplay/FunctionalPhoneInterface';
import { useAuth } from '../contexts/AuthContext';
import { useProgress } from '../contexts/ProgressContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import logger from '../utils/logger';

const Roleplay = () => {
  const { type, mode } = useParams();
  const { userProfile, loading: authLoading } = useAuth();
  const { getRoleplayAccess, loading: progressLoading } = useProgress();

  // Validate roleplay type and mode
  const validRoleplayTypes = [
    'opener_practice',
    'pitch_practice', 
    'warmup_challenge',
    'full_simulation',
    'power_hour'
  ];

  const validModes = ['practice', 'marathon', 'legend'];

  const isValidRoleplay = validRoleplayTypes.includes(type);
  const isValidMode = validModes.includes(mode);

  // Show loading while checking authentication and progress
  if (authLoading || progressLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 flex items-center justify-center">
        <div className="text-center text-white">
          <LoadingSpinner size="large" color="white" />
          <p className="mt-4 text-blue-200">Loading roleplay...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!userProfile) {
    return <Navigate to="/login" replace />;
  }

  // Redirect if invalid parameters
  if (!isValidRoleplay || !isValidMode) {
    logger.error('Invalid roleplay parameters:', { type, mode });
    return <Navigate to="/dashboard" replace />;
  }

  // Check access to this roleplay
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

  // Render the functional phone interface
  return <FunctionalPhoneInterface />;
};

export default Roleplay;