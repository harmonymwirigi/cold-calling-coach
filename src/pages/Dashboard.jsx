// src/pages/Dashboard.jsx - FULLY INTEGRATED WITH NEW ACCESS SYSTEM
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Play, Star, Trophy, Clock, CheckCircle, AlertCircle, Crown, Zap, Target, Award } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useProgress } from '../contexts/ProgressContext';
import PropTypes from 'prop-types';

const RoleplayCard = ({ 
  roleplayType,
  title, 
  description, 
  access,
  progress,
  onStartPractice, 
  onStartMarathon, 
  onStartLegend,
  isFirst = false
}) => {
  const isUnlocked = access.unlocked || isFirst;
  const hasTimeLimit = access.unlockExpiry && new Date() < new Date(access.unlockExpiry);
  const marathonPasses = progress?.marathon_passes || 0;
  const legendCompleted = progress?.legend_completed || false;
  const legendAttemptUsed = progress?.legend_attempt_used !== false;
  const totalAttempts = progress?.total_attempts || 0;
  const totalPasses = progress?.total_passes || 0;
  
  const timeRemaining = hasTimeLimit ? 
    Math.ceil((new Date(access.unlockExpiry) - new Date()) / (1000 * 60 * 60)) : 0;

  // Calculate pass rate
  const passRate = totalAttempts > 0 ? Math.round((totalPasses / totalAttempts) * 100) : 0;

  const getUnlockText = () => {
    if (isFirst) return "Always available";
    if (!isUnlocked) return access.reason || "Complete previous Marathon to unlock";
    if (hasTimeLimit) return `Unlocked for ${timeRemaining}h`;
    if (access.accessLevel === 'unlimited') return "Unlimited access";
    return "Available";
  };

  const getCardBorderColor = () => {
    if (!isUnlocked) return 'border-gray-300';
    if (access.accessLevel === 'unlimited') return 'border-purple-300';
    if (hasTimeLimit) return 'border-yellow-300';
    return 'border-blue-300';
  };

  const getCardBgColor = () => {
    if (!isUnlocked) return 'bg-gray-50';
    if (access.accessLevel === 'unlimited') return 'bg-purple-50';
    if (hasTimeLimit) return 'bg-yellow-50';
    return 'bg-blue-50';
  };

  return (
    <div className={`
      bg-white rounded-xl border-2 transition-all duration-200 hover:shadow-lg
      ${getCardBorderColor()} ${isUnlocked ? 'hover:border-opacity-50' : ''}
    `}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`
              w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg
              ${isUnlocked 
                ? access.accessLevel === 'unlimited' 
                  ? 'bg-purple-100 text-purple-600' 
                  : 'bg-blue-100 text-blue-600'
                : 'bg-gray-100 text-gray-400'
              }
            `}>
              {getModuleIcon(roleplayType)}
            </div>
            <div>
              <h3 className={`font-semibold text-lg ${isUnlocked ? 'text-gray-900' : 'text-gray-500'}`}>
                {title}
              </h3>
              <p className={`text-sm ${isUnlocked ? 'text-gray-600' : 'text-gray-400'}`}>
                {description}
              </p>
            </div>
          </div>
          
          {!isUnlocked && (
            <Lock className="w-6 h-6 text-gray-400" />
          )}
          
          {access.accessLevel === 'unlimited' && isUnlocked && (
            <Crown className="w-6 h-6 text-purple-500" />
          )}
        </div>

        {/* Progress Indicators */}
        <div className="flex items-center space-x-4 mb-4">
          <div className="flex items-center space-x-1">
            <CheckCircle className={`w-4 h-4 ${totalPasses > 0 ? 'text-green-500' : 'text-gray-300'}`} />
            <span className="text-sm text-gray-600">Practice ({totalPasses})</span>
          </div>
          
          <div className="flex items-center space-x-1">
            <Trophy className={`w-4 h-4 ${marathonPasses >= 6 ? 'text-yellow-500' : 'text-gray-300'}`} />
            <span className="text-sm text-gray-600">
              Marathon ({marathonPasses}/10)
            </span>
          </div>
          
          <div className="flex items-center space-x-1">
            <Star className={`w-4 h-4 ${legendCompleted ? 'text-purple-500' : 'text-gray-300'}`} />
            <span className="text-sm text-gray-600">Legend</span>
          </div>
        </div>

        {/* Statistics */}
        {totalAttempts > 0 && (
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <div className="font-semibold text-gray-900">{totalAttempts}</div>
                <div className="text-gray-600">Attempts</div>
              </div>
              <div>
                <div className="font-semibold text-green-600">{totalPasses}</div>
                <div className="text-gray-600">Passed</div>
              </div>
              <div>
                <div className="font-semibold text-blue-600">{passRate}%</div>
                <div className="text-gray-600">Success Rate</div>
              </div>
            </div>
          </div>
        )}

        {/* Unlock Status */}
        <div className="mb-4">
          <div className={`
            text-xs px-3 py-1 rounded-full inline-flex items-center space-x-1
            ${isUnlocked 
              ? access.accessLevel === 'unlimited'
                ? 'bg-purple-100 text-purple-700'
                : hasTimeLimit 
                  ? 'bg-yellow-100 text-yellow-700' 
                  : 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-500'
            }
          `}>
            {hasTimeLimit && <Clock className="w-3 h-3" />}
            {access.accessLevel === 'unlimited' && <Crown className="w-3 h-3" />}
            <span>{getUnlockText()}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          {/* Practice Mode Button */}
          <button
            onClick={onStartPractice}
            disabled={!isUnlocked}
            className={`
              w-full py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center
              ${isUnlocked 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
            `}
          >
            <Play className="w-4 h-4 mr-2" />
            Practice Mode
          </button>
          
          {/* Marathon and Legend Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onStartMarathon}
              disabled={!isUnlocked}
              className={`
                py-2 px-3 rounded-lg font-medium transition-colors text-sm flex items-center justify-center
                ${isUnlocked 
                  ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'}
              `}
            >
              <Trophy className="w-4 h-4 mr-1" />
              Marathon
            </button>
            
            <button
              onClick={onStartLegend}
              disabled={!isUnlocked || marathonPasses < 6 || legendAttemptUsed}
              className={`
                py-2 px-3 rounded-lg font-medium transition-colors text-sm flex items-center justify-center
                ${isUnlocked && marathonPasses >= 6 && !legendAttemptUsed
                  ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'}
              `}
            >
              <Star className="w-4 h-4 mr-1" />
              Legend
            </button>
          </div>
        </div>

        {/* Legend Status */}
        {marathonPasses >= 6 && (
          <div className="mt-3 text-xs text-center">
            {legendAttemptUsed ? (
              <span className="text-gray-500">Legend attempt used - pass Marathon again for another chance</span>
            ) : (
              <span className="text-purple-600 font-medium">🏆 Legend Mode Available!</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function to get module icon
const getModuleIcon = (roleplayType) => {
  const icons = {
    opener_practice: '🚀',
    pitch_practice: '💼',
    warmup_challenge: '⚡',
    full_simulation: '📞',
    power_hour: '🔥'
  };
  return icons[roleplayType] || '📚';
};

// Fix PropTypes
RoleplayCard.propTypes = {
  roleplayType: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  access: PropTypes.shape({
    unlocked: PropTypes.bool.isRequired,
    unlockExpiry: PropTypes.string,
    accessLevel: PropTypes.string,
    reason: PropTypes.string
  }).isRequired,
  progress: PropTypes.shape({
    marathon_passes: PropTypes.number,
    total_attempts: PropTypes.number,
    total_passes: PropTypes.number,
    legend_completed: PropTypes.bool,
    legend_attempt_used: PropTypes.bool
  }),
  onStartPractice: PropTypes.func.isRequired,
  onStartMarathon: PropTypes.func.isRequired,
  onStartLegend: PropTypes.func.isRequired,
  isFirst: PropTypes.bool
};

const Dashboard = () => {
  const { userProfile } = useAuth();
  const { 
    loading, 
    error,
    getOverallStats,
    getRecentActivity,
    getRoleplayAccess,
    accessStatus,
    progress,
    getUserAccessLevel
  } = useProgress();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalSessions: 0,
    totalHours: 0,
    practicesCompleted: 0,
    marathonsCompleted: 0,
    legendsCompleted: 0
  });

  const [recentActivity, setRecentActivity] = useState([]);

  const roleplays = [
    {
      type: 'opener_practice',
      title: "Opener + Early Objections",
      description: "Master your opening and handle immediate pushback with empathy and skill"
    },
    {
      type: 'pitch_practice',
      title: "Pitch + Objections + Close",
      description: "Deliver compelling pitches, handle objections, and close for meetings"
    },
    {
      type: 'warmup_challenge',
      title: "Warm-up Challenge",
      description: "25 rapid-fire questions to test your quick thinking and objection skills"
    },
    {
      type: 'full_simulation',
      title: "Full Cold Call Simulation", 
      description: "Complete end-to-end call from opener to meeting confirmation"
    },
    {
      type: 'power_hour',
      title: "Power Hour Challenge",
      description: "Ultimate test: 20 consecutive calls to prove your mastery"
    }
  ];

  const handleStartRoleplay = (roleplayType, mode) => {
    navigate(`/roleplay/${roleplayType}/${mode}`);
  };

  useEffect(() => {
    if (!loading) {
      setStats(getOverallStats());
      const fetchActivity = async () => {
        const activity = await getRecentActivity();
        setRecentActivity(activity);
      };
      fetchActivity();
    }
  }, [loading, getOverallStats, getRecentActivity]);

  if (loading) {
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

  const userAccessLevel = getUserAccessLevel();

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
              {stats.totalHours}h total practice time
            </p>
          </div>
        </div>
      </div>

      {/* Access Level Info */}
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
                  ? '⚡ Trial Access Active' 
                  : '🎯 Limited Access'
                }
              </h3>
              <p className={`text-sm ${
                userAccessLevel === 'trial' ? 'text-yellow-800' : 'text-blue-800'
              }`}>
                {userAccessLevel === 'trial' 
                  ? 'Complete marathons to unlock new modules for 24 hours. Pass 6/10 calls to unlock the next level!'
                  : 'You have access to the first module. Upgrade to access all features and advanced training modules.'
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

      {/* Progress Overview */}
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
          <div className="text-gray-600 text-sm">Practices Completed</div>
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

      {/* Training Modules */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">Training Modules</h2>
        
        <div className="grid gap-6">
          {roleplays.map((roleplay, index) => {
            const accessInfo = getRoleplayAccess(roleplay.type);
            const progressInfo = progress[roleplay.type];
            
            return (
              <RoleplayCard
                key={roleplay.type}
                roleplayType={roleplay.type}
                title={roleplay.title}
                description={roleplay.description}
                access={accessInfo}
                progress={progressInfo}
                isFirst={index === 0}
                onStartPractice={() => handleStartRoleplay(roleplay.type, 'practice')}
                onStartMarathon={() => handleStartRoleplay(roleplay.type, 'marathon')}
                onStartLegend={() => handleStartRoleplay(roleplay.type, 'legend')}
              />
            );
          })}
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
                      {activity.roleplay_type.replace('_', ' ')} - {activity.mode}
                    </p>
                    <p className="text-xs text-gray-500">
                      Score: {activity.score}/4 • {activity.passed ? 'Passed' : 'Try Again'}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-gray-400">{activity.timeAgo}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips Section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
        <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center">
          <Award className="w-5 h-5 mr-2" />
          💡 Quick Tips
        </h3>
        <ul className="space-y-2 text-blue-800 text-sm">
          <li>• Start with Practice Mode to learn the evaluation rubrics</li>
          <li>• Pass Marathon (6/10) to unlock the next module for 24 hours</li>
          <li>• Legend Mode is sudden death - all calls must pass perfectly!</li>
          <li>• Focus on empathy and natural conversation flow</li>
          <li>• Use contractions and casual tone for better scores</li>
        </ul>
      </div>
    </div>
  );
};

export default Dashboard;