// src/pages/Dashboard.jsx - Real Data Version
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Play, Star, Trophy, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useProgress } from '../contexts/ProgressContext';
import PropTypes from 'prop-types';

const RoleplayCard = ({ 
  roleplayType,
  title, 
  description, 
  access,
  onStartPractice, 
  onStartMarathon, 
  onStartLegend,
  isFirst = false
}) => {
  const isUnlocked = access.unlocked || isFirst;
  const hasTimeLimit = access.unlockExpiry && new Date() < new Date(access.unlockExpiry);
  const marathonPasses = access.marathonPasses || 0;
  const legendCompleted = access.legendCompleted || false;
  
  const timeRemaining = hasTimeLimit ? 
    Math.ceil((new Date(access.unlockExpiry) - new Date()) / (1000 * 60 * 60)) : 0;

  const getUnlockText = () => {
    if (isFirst) return "Always available";
    if (!isUnlocked) return "Complete previous Marathon to unlock";
    if (hasTimeLimit) return `Unlocked for ${timeRemaining}h`;
    return "Permanently unlocked";
  };

  return (
    <div className={`
      bg-white rounded-xl border-2 transition-all duration-200 hover:shadow-lg
      ${isUnlocked ? 'border-blue-200 hover:border-blue-300' : 'border-gray-200 bg-gray-50'}
    `}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg
              ${isUnlocked ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}
            `}>
              {roleplayType.split('_')[0][0].toUpperCase()}
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
        </div>

        {/* Progress Indicators */}
        <div className="flex items-center space-x-4 mb-4">
          <div className="flex items-center space-x-1">
            <CheckCircle className={`w-4 h-4 ${marathonPasses > 0 ? 'text-green-500' : 'text-gray-300'}`} />
            <span className="text-sm text-gray-600">Practice</span>
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

        {/* Unlock Status */}
        <div className="mb-4">
          <div className={`
            text-xs px-2 py-1 rounded-full inline-flex items-center space-x-1
            ${isUnlocked ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}
          `}>
            {hasTimeLimit && <Clock className="w-3 h-3" />}
            <span>{getUnlockText()}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={onStartPractice}
            disabled={!isUnlocked}
            className={`
              w-full py-2 px-4 rounded-lg font-medium transition-colors
              ${isUnlocked 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
            `}
          >
            <Play className="w-4 h-4 inline mr-2" />
            Practice Mode
          </button>
          
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onStartMarathon}
              disabled={!isUnlocked}
              className={`
                py-2 px-4 rounded-lg font-medium transition-colors text-sm
                ${isUnlocked 
                  ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'}
              `}
            >
              <Trophy className="w-4 h-4 inline mr-1" />
              Marathon
            </button>
            
            <button
              onClick={onStartLegend}
              disabled={!isUnlocked || marathonPasses < 6}
              className={`
                py-2 px-4 rounded-lg font-medium transition-colors text-sm
                ${isUnlocked && marathonPasses >= 6
                  ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'}
              `}
            >
              <Star className="w-4 h-4 inline mr-1" />
              Legend
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { userProfile } = useAuth();
  const { 
    loading, 
    error,
    getOverallStats,
    getRecentActivity,
    getRoleplayAccess 
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
      description: "Master your opening and handle immediate pushback"
    },
    {
      type: 'pitch_practice',
      title: "Pitch + Objections + Close",
      description: "Deliver compelling pitches and close for meetings"
    },
    {
      type: 'warmup_challenge',
      title: "Warm-up Challenge",
      description: "25 rapid-fire questions to test your skills"
    },
    {
      type: 'full_simulation',
      title: "Full Cold Call Simulation", 
      description: "Complete call from start to finish"
    },
    {
      type: 'power_hour',
      title: "Power Hour Challenge",
      description: "20 consecutive calls - ultimate test"
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
            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
              Training Active
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {stats.totalHours}h total practice time
            </p>
          </div>
        </div>
      </div>

      {/* Practice Profile */}
      {userProfile && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Practice Profile</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-600">Calling: </span>
              <span className="font-medium text-gray-900">{userProfile.prospect_job_title}</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">Industry: </span>
              <span className="font-medium text-gray-900">{userProfile.prospect_industry}</span>
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
          {roleplays.map((roleplay, index) => (
            <RoleplayCard
              key={roleplay.type}
              roleplayType={roleplay.type}
              title={roleplay.title}
              description={roleplay.description}
              access={getRoleplayAccess(roleplay.type)}
              isFirst={index === 0}
              onStartPractice={() => handleStartRoleplay(roleplay.type, 'practice')}
              onStartMarathon={() => handleStartRoleplay(roleplay.type, 'marathon')}
              onStartLegend={() => handleStartRoleplay(roleplay.type, 'legend')}
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
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {activity.roleplay_type.replace('_', ' ')} - {activity.mode}
                  </p>
                  <p className="text-xs text-gray-500">
                    Score: {activity.score}/4 • {activity.passed ? 'Passed' : 'Try Again'}
                  </p>
                </div>
                <span className="text-xs text-gray-400">{activity.timeAgo}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips Section */}
      <div className="bg-blue-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">💡 Quick Tips</h3>
        <ul className="space-y-2 text-blue-800 text-sm">
          <li>• Start with Practice Mode to learn the rubrics</li>
          <li>• Pass Marathon (6/10) to unlock the next module for 24 hours</li>
          <li>• Legend Mode is sudden death - all calls must pass!</li>
          <li>• Focus on tone and empathy - they&apos;re key to passing</li>
        </ul>
      </div>
    </div>
  );
};

Dashboard.propTypes = {
  roleplayType: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  access: PropTypes.shape({
    unlocked: PropTypes.bool.isRequired,
    unlockExpiry: PropTypes.string,
    marathonPasses: PropTypes.number.isRequired,
    legendCompleted: PropTypes.bool.isRequired
  }).isRequired,
  onStartPractice: PropTypes.func.isRequired,
  onStartMarathon: PropTypes.func.isRequired,
  onStartLegend: PropTypes.func.isRequired,
  isFirst: PropTypes.bool.isRequired
};

export default Dashboard;