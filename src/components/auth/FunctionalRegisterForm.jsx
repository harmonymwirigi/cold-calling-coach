// src/components/auth/FunctionalRegisterForm.jsx - Using Custom Verification Code System
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { apiHelpers } from '../../config/api';

const FunctionalRegisterForm = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    password: '',
    confirmPassword: '',
    verificationCode: '',
    prospectJobTitle: '',
    prospectIndustry: '',
    customBehaviorNotes: ''
  });

  const { signUp } = useAuth();
  const navigate = useNavigate();

  const JOB_TITLES = [
    'Brand/Communications Manager',
    'CEO (Chief Executive Officer)',
    'CFO (Chief Financial Officer)',
    'CIO (Chief Information Officer)',
    'COO (Chief Operating Officer)',
    'Content Marketing Manager',
    'CTO (Chief Technology Officer)',
    'Demand Generation Manager',
    'Digital Marketing Manager',
    'Engineering Manager',
    'Finance Director',
    'Founder / Owner / Managing Director (MD)',
    'Head of Product',
    'Purchasing Manager',
    'R&D/Product Development Manager',
    'Sales Manager',
    'Sales Operations Manager',
    'Social Media Manager',
    'UX/UI Design Lead',
    'VP of Finance',
    'VP of HR',
    'VP of IT/Engineering',
    'VP of Marketing',
    'VP of Sales',
    'Other (Please specify)'
  ];

  const INDUSTRIES = [
    'Education & e-Learning',
    'Energy & Utilities',
    'Finance & Banking',
    'Government & Public Sector',
    'Healthcare & Life Sciences',
    'Hospitality & Travel',
    'Information Technology & Services',
    'Logistics, Transportation & Supply Chain',
    'Manufacturing & Industrial',
    'Media & Entertainment',
    'Non-Profit & Associations',
    'Professional Services (Legal, Accounting, Consulting)',
    'Real Estate & Property Management',
    'Retail & e-Commerce',
    'Telecommunications',
    'Other (Please specify)'
  ];

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Validate password strength
  const validatePassword = (password) => {
    if (password.length < 6) {
      return 'Password must be at least 6 characters long';
    }
    if (!/[A-Za-z]/.test(password)) {
      return 'Password must contain at least one letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  // Use API helpers for verification
  const { sendVerificationCode, verifyEmailCode } = apiHelpers;

  const handleSubmitEmail = async () => {
    // Validate required fields
    if (!formData.firstName.trim() || !formData.email.trim() || !formData.password.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    // Validate password
    const passwordError = validatePassword(formData.password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    // Validate password confirmation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('Sending verification code to:', formData.email);
      const result = await sendVerificationCode(formData.email, formData.firstName);
      
      if (result.success) {
        console.log('Verification code sent successfully');
        setStep(2);
      } else {
        console.error('Failed to send verification code:', result.error);
        setError(result.error || 'Failed to send verification code');
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!formData.verificationCode.trim()) {
      setError('Please enter the verification code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('Verifying code:', formData.verificationCode);
      const result = await verifyEmailCode(formData.email, formData.verificationCode);
      
      if (result.success) {
        console.log('Code verified successfully');
        setStep(3);
      } else {
        console.error('Code verification failed:', result.error);
        setError(result.error || 'Invalid verification code');
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteRegistration = async () => {
    if (!formData.prospectJobTitle || !formData.prospectIndustry) {
      setError('Please complete your practice profile');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const profileData = {
        first_name: formData.firstName,
        prospect_job_title: formData.prospectJobTitle,
        prospect_industry: formData.prospectIndustry,
        custom_behavior_notes: formData.customBehaviorNotes
      };

      console.log('Creating user account with verified email');
      // Now create the user account since email is verified
      const result = await signUp(formData.email, formData.password, profileData);
      
      if (result.success) {
        console.log('Account created successfully');
        // Registration successful - redirect to dashboard
        navigate('/dashboard');
      } else {
        console.error('Account creation failed:', result.error);
        setError(result.error || 'Failed to create account');
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            AI Cold Calling Coach
          </h1>
          <p className="text-gray-600">
            Master English sales calls with AI-powered roleplay
          </p>
        </div>

        {/* Step 1: Email, Name, and Password */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                First Name *
              </label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => updateFormData('firstName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your first name"
                data-cy="first-name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => updateFormData('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="your@email.com"
                data-cy="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password *
              </label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => updateFormData('password', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Create a password"
                data-cy="password"
              />
              <p className="text-xs text-gray-500 mt-1">
                At least 6 characters with letters and numbers
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password *
              </label>
              <input
                type="password"
                required
                value={formData.confirmPassword}
                onChange={(e) => updateFormData('confirmPassword', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Confirm your password"
                data-cy="confirm-password"
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmitEmail}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              data-cy="submit-email"
            >
              {loading ? 'Sending Code...' : 'Send Verification Code'}
            </button>
          </div>
        )}

        {/* Step 2: Verification Code */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-4xl mb-4">📧</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Check Your Email
              </h3>
              <p className="text-gray-600 mb-4">
                We sent a 6-digit verification code to
              </p>
              <p className="font-medium text-gray-900 mb-4">{formData.email}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Verification Code
              </label>
              <input
                type="text"
                required
                maxLength="6"
                value={formData.verificationCode}
                onChange={(e) => updateFormData('verificationCode', e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg tracking-widest"
                placeholder="123456"
                data-cy="verification-code"
              />
              <p className="text-xs text-gray-500 mt-1 text-center">
                Code expires in 10 minutes
              </p>
            </div>

            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}

            <button
              onClick={handleVerifyCode}
              disabled={loading || formData.verificationCode.length !== 6}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              data-cy="verify-code"
            >
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>

            <div className="text-center">
              <button
                onClick={() => setStep(1)}
                className="text-gray-600 hover:text-gray-800 text-sm"
              >
                ← Back to registration
              </button>
              <span className="mx-2 text-gray-400">|</span>
              <button
                onClick={handleSubmitEmail}
                disabled={loading}
                className="text-blue-600 hover:text-blue-800 text-sm disabled:opacity-50"
              >
                Resend code
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Profile Setup */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <div className="text-4xl mb-4">✅</div>
              <h3 className="text-lg font-semibold text-gray-900">
                Email Verified!
              </h3>
              <p className="text-gray-600 text-sm mb-6">
                Now let's set up your practice profile
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prospect Job Title *
              </label>
              <select
                required
                value={formData.prospectJobTitle}
                onChange={(e) => updateFormData('prospectJobTitle', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-cy="job-title"
              >
                <option value="">Select job title...</option>
                {JOB_TITLES.map((title) => (
                  <option key={title} value={title}>{title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prospect Industry *
              </label>
              <select
                required
                value={formData.prospectIndustry}
                onChange={(e) => updateFormData('prospectIndustry', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-cy="industry"
              >
                <option value="">Select industry...</option>
                {INDUSTRIES.map((industry) => (
                  <option key={industry} value={industry}>{industry}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Behavior Notes (Optional)
              </label>
              <textarea
                value={formData.customBehaviorNotes}
                onChange={(e) => updateFormData('customBehaviorNotes', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
                placeholder="e.g., Very busy, skeptical of new tools, prefers data-driven decisions..."
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}

            <button
              onClick={handleCompleteRegistration}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              data-cy="complete-registration"
            >
              {loading ? 'Creating Account...' : 'Complete Registration'}
            </button>

            <button
              onClick={() => setStep(2)}
              className="w-full text-gray-600 hover:text-gray-800"
            >
              ← Back to verification
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FunctionalRegisterForm;