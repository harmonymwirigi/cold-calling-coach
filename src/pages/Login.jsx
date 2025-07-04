// src/pages/Login.jsx - Updated with Admin Redirect
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import logger from '../utils/logger';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Get the intended destination from state, or default to dashboard
  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate inputs
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      return;
    }

    try {
      setError('');
      setLoading(true);
      
      logger.log('Attempting to sign in:', email);
      const result = await signIn(email, password);
      
      if (result.success) {
        logger.log('Login successful, checking user role...');
        
        // Small delay to ensure user profile is loaded
        setTimeout(() => {
          // Check if user is admin and redirect accordingly
          if (isAdmin()) {
            logger.log('Admin user detected, redirecting to admin or intended page');
            // If they were trying to access admin page, go there, otherwise dashboard
            if (from === '/admin' || email.includes('admin')) {
              navigate('/admin');
            } else {
              navigate(from);
            }
          } else {
            logger.log('Regular user, redirecting to:', from === '/admin' ? '/dashboard' : from);
            // Non-admin users can't access admin page, redirect to dashboard
            navigate(from === '/admin' ? '/dashboard' : from);
          }
        }, 1000);
      } else {
        logger.error('Login failed:', result.error);
        setError(result.error || 'Failed to sign in');
      }
    } catch (err) {
      logger.error('Login error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome Back
          </h1>
          <p className="text-gray-600">
            Sign in to continue your cold calling training
          </p>
          {from === '/admin' && (
            <div className="mt-2 p-2 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                🔐 Admin access required
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="your@email.com"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your password"
              disabled={loading}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <div className="text-sm text-gray-600">
            Don&apos;t have an account?{' '}
            <Link 
              to="/register" 
              className="font-medium text-blue-600 hover:text-blue-500 hover:underline"
            >
              Sign up here
            </Link>
          </div>
        </div>

        {/* Optional: Add forgot password link */}
        <div className="mt-4 text-center">
          <div className="text-sm">
            <button
              type="button" 
              className="font-medium text-gray-500 hover:text-gray-700 hover:underline"
              onClick={(e) => {
                e.preventDefault();
                // TODO: Implement forgot password functionality
                alert('Forgot password functionality will be implemented soon!');
              }}
            >
              Forgot your password?
            </button>
          </div>
        </div>

        {/* Development helper */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Development Info:</h4>
            <p className="text-xs text-gray-600">
              Intended destination: {from}
            </p>
            <p className="text-xs text-gray-600">
              Admin access required: {from === '/admin' ? 'Yes' : 'No'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;