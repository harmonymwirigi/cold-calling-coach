// src/pages/Dashboard.jsx - UPDATED FOR CLIENT SPECIFICATIONS
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Play, Star, Trophy, Clock, CheckCircle, AlertCircle, Crown, Zap, Target, Award, Timer } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useProgress } from '../contexts/ProgressContext';
import { progressTracker } from '../services/progressTracker';
import PropTypes from 'prop-types';
import logger from '../utils/logger';

const ModuleCard = ({ 
  moduleData,
  onStartRoleplay,
  isFirst = false
}) => {
  const { roleplayType, name, access, progress, modes } = moduleData;
  const isUnlocked = access.allowed || isFirst;
  const hasTimeLimit = access.accessInfo?.temporary && access.accessInfo?.unlockExpiry;
  const timeRemaining = hasTimeLimit ? access.accessInfo.hoursRemaining : 0;
  
  // Progress data
  const totalAttempts = progress?.totalAttempts || 0;
  const totalPasses = progress?.totalPasses || 0;
  const marathonPasses = progress?.marathonPasses || 0;
  const legendCompleted = progress?.legendCompleted || false;
  const legendAttemptAvailable = progress?.legendAttemptAvailable !== false;
  const bestScore = progress?.bestScore || 0;
  
  // Calculate pass rate
  const passRate = totalAttempts > 0 ? Math.round((totalPasses / totalAttempts) * 100) : 0;

  const getUnlockStatusDisplay = () => {
    if (isFirst) return { text: "Always available", color: "green", icon: CheckCircle };
    if (!isUnlocked) return { text: access.reason || "Locked", color: "gray", icon: Lock };
    if (access.accessInfo?.accessLevel === 'unlimited') return { text: "Unlimited access", color: "purple", icon: Crown };
    if (hasTimeLimit) return { text: `Unlocked (${timeRemaining}h left)`, color: "yellow", icon: Timer };
    return { text: "Available", color: "blue", icon: CheckCircle };
  };

  const getCardTheme = () => {
    if (!isUnlocked) return { border: 'border-gray-300', bg: 'bg-gray-50', text: 'text-gray-500' };
    if (access.accessInfo?.accessLevel === 'unlimited') return { border: 'border-purple-300', bg: 'bg-purple-50', text: 'text-purple-900' };
    if (hasTimeLimit) return { border: 'border-yellow-300', bg: 'bg-yellow-50', text: 'text-yellow-900' };
    return { border: 'border-blue-300', bg: 'bg-blue-50', text: 'text-blue-900' };
  };

  const statusDisplay = getUnlockStatusDisplay();
  const theme = getCardTheme();
  const StatusIcon = statusDisplay.icon;

  const getModuleIcon = () => {
    const icons = {
      opener_practice: '🚀',
      pitch_practice: '💼', 
      warmup_challenge: '⚡',
      full_simulation: '📞',
      power_hour: '🔥'
    };
    return icons[roleplayType] || '📚';
  };

  const getModuleDescription = () => {
    const descriptions = {
      opener_practice: "Master your opening and handle immediate pushback with empathy and skill",
      pitch_practice: "Deliver compelling pitches, handle objections, and close for meetings",
      warmup_challenge: "25 rapid-fire questions to test your quick thinking and objection skills",
      full_simulation: "Complete end-to-end call from opener to meeting confirmation",
      power_hour: "Ultimate test: 20 consecutive calls to prove your mastery"
    };
    return descriptions[roleplayType] || "Improve your cold calling skills";
  };

  return (
    <div className={`bg-white rounded-xl border-2 transition-all duration-200 hover:shadow-lg ${theme.border} ${isUnlocked ? 'hover:border-opacity-50' : ''}`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
              isUnlocked 
                ? access.accessInfo?.accessLevel === 'unlimited' 
                  ? 'bg-purple-100 text-purple-600' 
                  : 'bg-blue-100 text-blue-600'
                : 'bg-gray-100 text-gray-400'
            }`}>
              {getModuleIcon()}
            </div>
            <div>
              <h3 className={`font-semibold text-lg ${isUnlocked ? 'text-gray-900' : 'text-gray-500'}`}>
                {name}
              </h3>
              <p className={`text-sm ${isUnlocked ? 'text-gray-600' : 'text-gray-400'}`}>
                {getModuleDescription()}
              </p>
            </div>
          </div>
          
          <StatusIcon className={`w-6 h-6 text-${statusDisplay.color}-500`} />
        </div>

        {/* Progress Indicators - Client Specifications */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <Play className={`w-4 h-4 ${totalPasses > 0 ? 'text-green-500' : 'text-gray-300'}`} />
              <span className="text-sm font-medium text-gray-600">Practice</span>
            </div>
            <div className="text-lg font-bold text-gray-900">{totalPasses}</div>
            <div className="text-xs text-gray-500">Completed</div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <Trophy className={`w-4 h-4 ${marathonPasses >= 6 ? 'text-yellow-500' : 'text-gray-300'}`} />
              <span className="text-sm font-medium text-gray-600">Marathon</span>
            </div>
            <div className="text-lg font-bold text-gray-900">{marathonPasses}/10</div>
            <div className="text-xs text-gray-500">Pass Rate</div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <Star className={`w-4 h-4 ${legendCompleted ? 'text-purple-500' : 'text-gray-300'}`} />
              <span className="text-sm font-medium text-gray-600">Legend</span>
            </div>
            <div className="text-lg font-bold text-gray-900">{legendCompleted ? '✓' : '—'}</div>
            <div className="text-xs text-gray-500">Achieved</div>
          </div>
        </div>

        {/* Statistics */}
        {totalAttempts > 0 && (
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <div className="font-semibold text-gray-900">{totalAttempts}</div>
                <div className="text-gray-600">Total Attempts</div>
              </div>
              <div>
                <div className="font-semibold text-green-600">{passRate}%</div>
                <div className="text-gray-600">Success Rate</div>
              </div>
              <div>
                <div className="font-semibold text-blue-600">{bestScore.toFixed(1)}</div>
                <div className="text-gray-600">Best Score</div>
              </div>
            </div>
          </div>
        )}

        {/* Unlock Status */}
        <div className="mb-4">
          <div className={`text-xs px-3 py-1 rounded-full inline-flex items-center space-x-1 bg-${statusDisplay.color}-100 text-${statusDisplay.color}-700`}>
            <StatusIcon className="w-3 h-3" />
            <span>{statusDisplay.text}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          {/* Practice Mode Button */}
          <button
            onClick={() => onStartRoleplay(roleplayType, 'practice')}
            disabled={!isUnlocked}
            className={`w-full py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center ${
              isUnlocked 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Play className="w-4 h-4 mr-2" />
            Practice Mode
          </button>
          
          {/* Marathon and Legend Buttons - Only for modules that support them */}
          {modes.includes('marathon') && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onStartRoleplay(roleplayType, 'marathon')}
                disabled={!isUnlocked}
                className={`py-2 px-3 rounded-lg font-medium transition-colors text-sm flex items-center justify-center ${
                  isUnlocked 
                    ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' 
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Trophy className="w-4 h-4 mr-1" />
                Marathon
              </button>
              
              <button
                onClick={() => onStartRoleplay(roleplayType, 'legend')}
                disabled={!isUnlocked || marathonPasses < 6 || !legendAttemptAvailable}
                className={`py-2 px-3 rounded-lg font-medium transition-colors text-sm flex items-center justify-center ${
                  isUnlocked && marathonPasses >= 6 && legendAttemptAvailable
                    ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' 
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Star className="w-4 h-4 mr-1" />
                Legend
              </button>
            </div>
          )}
        </div>

        {/* Legend Status Message */}
        {modes.includes('legend') && marathonPasses >= 6 && (
          <div className="mt-3 text-xs text-center">
            {!legendAttemptAvailable ? (
              <span className="text-gray-500">Legend attempt used - pass Marathon again for another chance</span>
            ) : (
              <span className="text-purple-600 font-medium">🏆 Legend Mode Available!</span>
            )}
          </div>
        )}

        {/* Unlock Requirements for Locked Modules */}
        {!isUnlocked && (
          <div className="mt-3 text-xs text-center">
            <span className="text-gray-500">{access.reason}</span>
          </div>
        )}
      </div>
    </div>
  );
};

ModuleCard.propTypes = {
  moduleData: PropTypes.shape({
    roleplayType: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    access: PropTypes.object.isRequired,
    progress: PropTypes.object,
    modes: PropTypes.arrayOf(PropTypes.string).isRequired
  }).isRequired,
  onStartRoleplay: PropTypes.func.isRequired,
  isFirst: PropTypes.bool
};

const Dashboard = () => {
  const { userProfile } = useAuth();
  const { loading, error } = useProgress();
  const navigate = useNavigate();

  const [modules, setModules] = useState([]);
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalHours: 0,
    practicesCompleted: 0,
    marathonsCompleted: 0,
    legendsCompleted: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Load dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      if (!userProfile?.id) return;

      try {
        setLoadingData(true);

        // Load all modules with access information
        const modulesData = await progressTracker.getAllModulesWithAccess(userProfile.id);
        setModules(modulesData);

        // Load user statistics
        const userStats = await progressTracker.getUserStats(userProfile.id);
        setStats(userStats);

        // Load recent activity
        const activity = await progressTracker.getRecentActivity(userProfile.id, 10);
        setRecentActivity(activity);

        logger.log('✅ Dashboard data loaded successfully');

      } catch (error) {
        logger.error('❌ Error loading dashboard data:', error);
      } finally {
        setLoadingData(false);
      }
    };

    loadDashboardData();
  }, [userProfile?.id]);

  const handleStartRoleplay = (roleplayType, mode) => {
    navigate(`/roleplay/${roleplayType}/${mode}`);
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your progress...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const userAccessLevel = userProfile?.access_level || 'limited';

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {userProfile?.first_name || 'User'}! 👋
            </h1>
            <p className="text-gray-600 mt-1">
              Ready to improve your cold calling skills?
            </p>
          </div>
          
          <div className="text-right">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              userAccessLevel === 'unlimited' 
                ? 'bg-purple-100 text-purple-700' 
                : userAccessLevel === 'trial'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-blue-100 text-blue-700'
            }`}>
              {userAccessLevel === 'unlimited' && <Crown className="w-4 h-4 mr-1" />}
              {userAccessLevel === 'trial' && <Clock className="w-4 h-4 mr-1" />}
              {userAccessLevel === 'limited' && <Lock className="w-4 h-4 mr-1" />}
              {userAccessLevel.charAt(0).toUpperCase() + userAccessLevel.slice(1)} Access
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {stats.totalHours.toFixed(1)}h total practice time
            </p>
          </div>
        </div>
      </div>

      {/* Access Level Info - Client Specifications */}
      {userAccessLevel !== 'unlimited' && (
        <div className={`rounded-xl p-6 ${
          userAccessLevel === 'trial' 
            ? 'bg-yellow-50 border border-yellow-200' 
            : 'bg-blue-50 border border-blue-200'
        }`}>
          <div className="flex items-start">
            <div className={`p-2 rounded-lg mr-4 ${
              userAccessLevel === 'trial' ? 'bg-yellow-100' : 'bg-blue-100'
            }`}>
              {userAccessLevel === 'trial' ? (
                <Zap className="w-6 h-6 text-yellow-600" />
              ) : (
                <Target className="w-6 h-6 text-blue-600" />
              )}
            </div>
            <div>
              <h3 className={`font-semibold mb-2 ${
                userAccessLevel === 'trial' ? 'text-yellow-900' : 'text-blue-900'
              }`}>
                {userAccessLevel === 'trial' 
                  ? '⚡ Trial Access - Unlock System Active' 
                  : '🎯 Limited Access - First Module Available'
                }
              </h3>
              <p className={`text-sm ${
                userAccessLevel === 'trial' ? 'text-yellow-800' : 'text-blue-800'
              }`}>
                {userAccessLevel === 'trial' 
                  ? 'Complete Marathon modes (6/10 passes) to unlock the next module for 24 hours. Master each level to progress!'
                  : 'You have access to the first module. Upgrade to unlimited access to unlock all features and advanced training modules.'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Practice Profile */}
      {userProfile && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Practice Profile</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-600">Calling: </span>
              <span className="font-medium text-gray-900">{userProfile.prospect_job_title || 'Not set'}</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">Industry: </span>
              <span className="font-medium text-gray-900">{userProfile.prospect_industry || 'Not set'}</span>
            </div>
          </div>
          {userProfile.custom_behavior_notes && (
            <div className="mt-2">
              <span className="text-sm text-gray-600">Notes: </span>
              <span className="text-sm text-gray-900">{userProfile.custom_behavior_notes}</span>
            </div>
          )}
        </div>
      )}

      {/* Progress Overview - Client Specifications */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 text-center shadow-sm">
          <div className="text-3xl font-bold text-blue-600 mb-2">
            {stats.totalSessions}
          </div>
          <div className="text-gray-600 text-sm">Total Sessions</div>
        </div>
        
        <div className="bg-white rounded-xl p-6 text-center shadow-sm">
          <div className="text-3xl font-bold text-green-600 mb-2">
            {stats.practicesCompleted}
          </div>
          <div className="text-gray-600 text-sm">Practices Passed</div>
        </div>
        
        <div className="bg-white rounded-xl p-6 text-center shadow-sm">
          <div className="text-3xl font-bold text-yellow-600 mb-2">
            {stats.marathonsCompleted}
          </div>
          <div className="text-gray-600 text-sm">Marathons Passed</div>
        </div>
        
        <div className="bg-white rounded-xl p-6 text-center shadow-sm">
          <div className="text-3xl font-bold text-purple-600 mb-2">
            {stats.legendsCompleted}
          </div>
          <div className="text-gray-600 text-sm">Legend Achievements</div>
        </div>
      </div>

      {/* Training Modules - Client Specifications */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">Training Modules</h2>
        
        <div className="grid gap-6">
          {modules.map((module, index) => (
            <ModuleCard
              key={module.roleplayType}
              moduleData={module}
              isFirst={index === 0}
              onStartRoleplay={handleStartRoleplay}
            />
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                    activity.passed ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                  }`}>
                    {activity.passed ? '✓' : '✗'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {activity.roleplayType.replace('_', ' ')} - {activity.mode}
                    </p>
                    <p className="text-xs text-gray-500">
                      Score: {activity.score.toFixed(1)}/4 • {activity.passed ? 'Passed' : 'Try Again'}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-gray-400">{activity.timeAgo}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips Section - Client Specifications */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
        <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center">
          <Award className="w-5 h-5 mr-2" />
          💡 Quick Tips - Client Training System
        </h3>
        <ul className="space-y-2 text-blue-800 text-sm">
          <li>• Start with Practice Mode to learn the evaluation rubrics and get comfortable</li>
          <li>• Marathon Mode requires 6/10 calls to pass - unlocks next module for 24 hours</li>
          <li>• Legend Mode is sudden death (6/6 perfect) - you get one attempt per marathon pass</li>
          <li>• Show empathy in openers ("I know this is out of the blue...") for higher scores</li>
          <li>• Use natural contractions (don't, can't, we're) instead of formal language</li>
          <li>• Focus on outcomes in pitches, not features - keep it 1-2 sentences max</li>
          <li>• Handle objections with acknowledgment first, then ask forward-moving questions</li>
        </ul>
      </div>
    </div>
  );
};

export default Dashboard;