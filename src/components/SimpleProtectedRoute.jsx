// src/components/SimpleProtectedRoute.jsx - EMERGENCY FIX
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const SimpleProtectedRoute = ({ children }) => {
  const { user, userProfile, loading } = useAuth();

  console.log('🔍 Debug Auth State:', { 
    hasUser: !!user, 
    hasProfile: !!userProfile, 
    loading 
  });

  // Show loading spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Simple check: if no user, redirect to login
  if (!user) {
    console.log('🔒 No user found, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  // If user exists, allow access
  console.log('✅ User authenticated, allowing access');
  return children;
};

export default SimpleProtectedRoute;