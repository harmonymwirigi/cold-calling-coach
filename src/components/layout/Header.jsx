// src/components/layout/Header.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Bell, Settings, User, LogOut, Menu, X } from 'lucide-react';
import logger from '../../utils/logger'
const Header = () => {
  const { user, userProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      logger.error('Error signing out:', error);
    }
  };

  const getInitials = () => {
    if (userProfile?.first_name) {
      return userProfile.first_name.charAt(0).toUpperCase();
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 relative z-30">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Mobile Menu */}
          <div className="flex items-center">
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            >
              {showMobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            
            <Link to="/dashboard" className="flex items-center ml-2 md:ml-0">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-white font-bold text-sm">🎯</span>
                </div>
                <div>
                  <span className="text-xl font-bold text-gray-900">AI Cold Calling Coach</span>
                  <div className="text-xs text-gray-500 hidden sm:block">
                    Master English sales calls with AI
                  </div>
                </div>
              </div>
            </Link>
          </div>

          {/* User Info and Actions */}
          {user && (
            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <button className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-lg relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400 ring-2 ring-white"></span>
              </button>

              {/* Settings */}
              <Link 
                to="/profile"
                className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-lg"
              >
                <Settings className="w-5 h-5" />
              </Link>

              {/* Profile Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-medium text-sm">{getInitials()}</span>
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="text-sm font-medium text-gray-900">
                      {userProfile?.first_name || 'User'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {userProfile?.prospect_job_title || 'Practitioner'}
                    </div>
                  </div>
                </button>

                {/* Dropdown Menu */}
                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    <div className="px-4 py-2 border-b border-gray-200">
                      <div className="text-sm font-medium text-gray-900">
                        {userProfile?.first_name || 'User'}
                      </div>
                      <div className="text-xs text-gray-500">{user?.email}</div>
                    </div>
                    
                    <Link
                      to="/profile"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setShowProfileMenu(false)}
                    >
                      <User className="w-4 h-4 mr-3" />
                      Profile Settings
                    </Link>
                    
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        handleSignOut();
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <LogOut className="w-4 h-4 mr-3" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-40">
          <div className="px-4 py-2">
            <nav className="space-y-2">
              <Link
                to="/dashboard"
                className="block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                onClick={() => setShowMobileMenu(false)}
              >
                Dashboard
              </Link>
              <Link
                to="/profile"
                className="block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                onClick={() => setShowMobileMenu(false)}
              >
                Profile Settings
              </Link>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;