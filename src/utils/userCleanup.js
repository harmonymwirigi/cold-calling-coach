// src/utils/userCleanup.js - Utility to handle orphaned users
import React, { useState } from 'react';
import { supabase } from '../config/supabase';

export const userCleanupUtils = {
  // Check if user exists in auth but not in users table
  checkUserStatus: async (email) => {
    try {
      // Try to sign in to check if user exists in auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: 'temp-check-password' // This will fail but tell us if user exists
      });

      // If error is "Invalid login credentials", user exists but wrong password
      // If error is "Email not confirmed", user exists but not confirmed
      // If error is something else, user might not exist
      
      const userExistsInAuth = error && (
        error.message.includes('Invalid login credentials') ||
        error.message.includes('Email not confirmed') ||
        error.message.includes('too many requests')
      );

      return {
        existsInAuth: userExistsInAuth,
        authError: error?.message
      };
    } catch (error) {
      console.error('Error checking user status:', error);
      return { existsInAuth: false, error: error.message };
    }
  },

  // Create profile for existing auth user
  createProfileForExistingUser: async (email, profileData) => {
    try {
      // Get current user session
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || user.email !== email) {
        throw new Error('User must be signed in to create profile');
      }

      // Insert into users table
      const { error } = await supabase
        .from('users')
        .upsert([{
          id: user.id,
          email: user.email,
          first_name: profileData.first_name,
          prospect_job_title: profileData.prospect_job_title,
          prospect_industry: profileData.prospect_industry,
          custom_behavior_notes: profileData.custom_behavior_notes || '',
          is_verified: true,
          created_at: new Date().toISOString()
        }]);

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error) {
      console.error('Error creating profile for existing user:', error);
      return { success: false, error: error.message };
    }
  },

  // Clean up verification records for email
  cleanupVerifications: async (email) => {
    try {
      const { error } = await supabase
        .from('email_verifications')
        .delete()
        .eq('email', email);

      if (error) {
        console.warn('Could not clean up verifications:', error.message);
      }

      return { success: !error };
    } catch (error) {
      console.error('Error cleaning up verifications:', error);
      return { success: false };
    }
  }
};

// Component to handle existing user scenario
export const ExistingUserHandler = ({ email, onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [password, setPassword] = useState('');

  const handleExistingUser = async () => {
    if (!password) {
      setShowPasswordInput(true);
      return;
    }

    setLoading(true);
    try {
      // Try to sign in with the password
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        onError(error.message);
        return;
      }

      if (data.user) {
        onSuccess(data.user);
      }
    } catch (error) {
      onError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!showPasswordInput) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900">Account Already Exists</h3>
          <p className="text-gray-600 mt-2">
            An account with <strong>{email}</strong> already exists.
          </p>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={handleExistingUser}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
          >
            Sign In Instead
          </button>
          <button
            onClick={() => onError('Please use a different email address')}
            className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700"
          >
            Use Different Email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900">Enter Your Password</h3>
        <p className="text-gray-600 mt-2">
          Please enter the password for <strong>{email}</strong>
        </p>
      </div>
      
      <div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter your password"
          autoFocus
        />
      </div>
      
      <div className="flex space-x-3">
        <button
          onClick={handleExistingUser}
          disabled={loading || !password}
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Signing In...' : 'Sign In'}
        </button>
        <button
          onClick={() => setShowPasswordInput(false)}
          className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700"
        >
          Back
        </button>
      </div>
      
      <div className="text-center">
        <button
          onClick={() => onError('Please reset your password')}
          className="text-sm text-blue-600 hover:underline"
        >
          Forgot your password?
        </button>
      </div>
    </div>
  );
};