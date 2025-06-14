
// src/pages/Landing.jsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Play, Star, Trophy, CheckCircle, Phone, Users, BarChart3 } from 'lucide-react';

const Landing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // If user is already logged in, redirect to dashboard
  React.useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const features = [
    {
      icon: Phone,
      title: "AI-Powered Roleplay",
      description: "Practice with realistic AI prospects that simulate real cold calling scenarios"
    },
    {
      icon: Star,
      title: "Instant Feedback",
      description: "Get immediate evaluation on your tone, empathy, and conversation flow"
    },
    {
      icon: Trophy,
      title: "Progressive Training",
      description: "Unlock new modules as you improve, from basic openers to advanced closing"
    },
    {
      icon: BarChart3,
      title: "Track Progress",
      description: "Monitor your improvement with detailed analytics and performance metrics"
    }
  ];

  const benefits = [
    "Perfect your cold calling opener and handle early objections",
    "Learn to deliver compelling pitches and close for meetings",
    "Practice with industry-specific prospects and scenarios",
    "Get real-time feedback on tone, empathy, and conversation flow",
    "Track your progress with detailed performance analytics"
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                <span className="text-white font-bold text-sm">🎯</span>
              </div>
              <span className="text-xl font-bold text-gray-900">AI Cold Calling Coach</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <Link
                to="/login"
                className="text-gray-600 hover:text-gray-900 px-3 py-2"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Master English Cold Calling with{' '}
              <span className="text-blue-600">AI-Powered Training</span>
            </h1>
            
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Perfect your sales calls through realistic AI roleplay. Get instant feedback, 
              track your progress, and unlock your potential as a cold calling professional.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
              >
                <Play className="w-5 h-5 mr-2" />
                Start Training Free
              </Link>
              
              <button className="border border-gray-300 text-gray-700 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-50 transition-colors">
                Watch Demo
              </button>
            </div>

            <p className="text-sm text-gray-500 mt-4">
              No credit card required • Start practicing immediately
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Why Choose AI Cold Calling Coach?
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Transform your cold calling skills with our comprehensive AI-powered training platform
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Everything You Need to Excel at Cold Calling
              </h2>
              
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start">
                    <CheckCircle className="w-6 h-6 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                    <p className="text-gray-700">{benefit}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <Link
                  to="/register"
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors inline-flex items-center"
                >
                  Get Started Now
                  <Play className="w-4 h-4 ml-2" />
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Ready to Start?</h3>
                <p className="text-gray-600 mb-6">
                  Join thousands of sales professionals who have improved their cold calling skills
                </p>
                
                <div className="space-y-3">
                  <div className="flex items-center text-sm text-gray-600">
                    <Users className="w-4 h-4 mr-2 text-blue-600" />
                    Over 10,000 practice sessions completed
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Star className="w-4 h-4 mr-2 text-blue-600" />
                    Average 40% improvement in first week
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Trophy className="w-4 h-4 mr-2 text-blue-600" />
                    Industry-specific training scenarios
                  </div>
                </div>

                <Link
                  to="/register"
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors mt-6 block"
                >
                  Start Free Training
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                <span className="text-white font-bold text-sm">🎯</span>
              </div>
              <span className="text-xl font-bold">AI Cold Calling Coach</span>
            </div>
            
            <p className="text-gray-400 mb-4">
              Master English sales calls with AI-powered roleplay training
            </p>
            
            <div className="flex justify-center space-x-6 text-sm text-gray-400">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors">Support</a>
            </div>
            
            <p className="text-xs text-gray-500 mt-6">
              © 2025 AI Cold Calling Coach. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;