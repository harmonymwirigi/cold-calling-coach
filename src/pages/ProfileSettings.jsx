// src/pages/ProfileSettings.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useProgress } from '../contexts/ProgressContext';
import { User, Settings, Target, Clock, Award, Download, Trash2, Save } from 'lucide-react';

const ProfileSettings = () => {
  const { userProfile, updateProfile, user } = useAuth();
  const { progress, sessions } = useProgress();
  const [activeTab, setActiveTab] = useState('profile');
  const [formData, setFormData] = useState({
    firstName: '',
    prospectJobTitle: '',
    prospectIndustry: '',
    customBehaviorNotes: '',
    emailNotifications: true,
    voiceReminders: false,
    practiceReminders: true
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

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

  useEffect(() => {
    if (userProfile) {
      setFormData({
        firstName: userProfile.first_name || '',
        prospectJobTitle: userProfile.prospect_job_title || '',
        prospectIndustry: userProfile.prospect_industry || '',
        customBehaviorNotes: userProfile.custom_behavior_notes || '',
        emailNotifications: userProfile.email_notifications ?? true,
        voiceReminders: userProfile.voice_reminders ?? false,
        practiceReminders: userProfile.practice_reminders ?? true
      });
    }
  }, [userProfile]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const result = await updateProfile({
        first_name: formData.firstName,
        prospect_job_title: formData.prospectJobTitle,
        prospect_industry: formData.prospectIndustry,
        custom_behavior_notes: formData.customBehaviorNotes,
        email_notifications: formData.emailNotifications,
        voice_reminders: formData.voiceReminders,
        practice_reminders: formData.practiceReminders
      });

      if (result.success) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to update profile' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred while updating your profile' });
    } finally {
      setLoading(false);
    }
  };

  const exportData = () => {
    const exportData = {
      profile: userProfile,
      progress: progress,
      sessions: sessions,
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cold-calling-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getUsageStats = () => {
    if (!sessions.length) return { totalHours: 0, sessionsCount: 0, averageScore: 0 };

    const totalMinutes = sessions.reduce((sum, session) => sum + (session.duration_minutes || 0), 0);
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
    const sessionsWithScores = sessions.filter(s => s.final_score);
    const averageScore = sessionsWithScores.length > 0 
      ? Math.round((sessionsWithScores.reduce((sum, s) => sum + s.final_score, 0) / sessionsWithScores.length) * 10) / 10
      : 0;

    return {
      totalHours,
      sessionsCount: sessions.length,
      averageScore
    };
  };

  const stats = getUsageStats();

  const tabs = [
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'practice', name: 'Practice Settings', icon: Target },
    { id: 'notifications', name: 'Notifications', icon: Settings },
    { id: 'data', name: 'Data & Privacy', icon: Download }
  ];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Manage your profile and preferences</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.totalHours}h</div>
              <div className="text-sm text-gray-600">Practice Time</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <Target className="w-8 h-8 text-green-600 mr-3" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.sessionsCount}</div>
              <div className="text-sm text-gray-600">Sessions</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <Award className="w-8 h-8 text-purple-600 mr-3" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.averageScore}/4</div>
              <div className="text-sm text-gray-600">Avg Score</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-6 py-4 font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-5 h-5 mr-2" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Practice Profile</h3>
                <p className="text-sm text-gray-600 mb-4">
                  This determines how the AI prospect will behave during your practice sessions.
                </p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Prospect Job Title
                    </label>
                    <select
                      value={formData.prospectJobTitle}
                      onChange={(e) => handleInputChange('prospectJobTitle', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select job title...</option>
                      {JOB_TITLES.map((title) => (
                        <option key={title} value={title}>{title}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Prospect Industry
                    </label>
                    <select
                      value={formData.prospectIndustry}
                      onChange={(e) => handleInputChange('prospectIndustry', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select industry...</option>
                      {INDUSTRIES.map((industry) => (
                        <option key={industry} value={industry}>{industry}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custom Behavior Notes
                    </label>
                    <textarea
                      value={formData.customBehaviorNotes}
                      onChange={(e) => handleInputChange('customBehaviorNotes', e.target.value)}
                      placeholder="e.g., Very busy executive, skeptical of new tools, prefers data-driven decisions..."
                      className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      These notes help the AI create more realistic prospect behavior
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Practice Settings Tab */}
          {activeTab === 'practice' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Voice Settings</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">Voice Feedback</h4>
                      <p className="text-sm text-gray-500">Get spoken feedback after each call</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.voiceReminders}
                      onChange={(e) => handleInputChange('voiceReminders', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">Practice Reminders</h4>
                      <p className="text-sm text-gray-500">Daily reminders to keep practicing</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.practiceReminders}
                      onChange={(e) => handleInputChange('practiceReminders', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Training Preferences</h3>
                
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">🎯 Your Focus Areas</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-blue-800">Strongest Skills:</span>
                      <ul className="text-blue-700 mt-1">
                        <li>• Empathy & Rapport</li>
                        <li>• Meeting Closing</li>
                      </ul>
                    </div>
                    <div>
                      <span className="text-blue-800">Areas to Improve:</span>
                      <ul className="text-blue-700 mt-1">
                        <li>• Natural Conversation</li>
                        <li>• Objection Handling</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Email Notifications</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">Progress Updates</h4>
                      <p className="text-sm text-gray-500">Weekly progress reports and achievements</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.emailNotifications}
                      onChange={(e) => handleInputChange('emailNotifications', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">New Features</h4>
                      <p className="text-sm text-gray-500">Announcements about new training modules</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={() => {}}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">Tips & Advice</h4>
                      <p className="text-sm text-gray-500">Cold calling tips and best practices</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={() => {}}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Data & Privacy Tab */}
          {activeTab === 'data' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Export</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Download all your practice data, progress, and session history.
                </p>
                
                <button
                  onClick={exportData}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export My Data
                </button>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Deletion</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
                
                <button className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Account
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Privacy Information</h4>
                <div className="text-sm text-gray-600 space-y-2">
                  <p>• Your voice data is processed in real-time and not stored</p>
                  <p>• Practice sessions are stored for progress tracking only</p>
                  <p>• Data is encrypted in transit and at rest</p>
                  <p>• We never share your data with third parties</p>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {message.text && (
            <div className={`mt-4 p-3 rounded-lg ${
              message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {message.text}
            </div>
          )}

          {/* Save Button */}
          {(activeTab === 'profile' || activeTab === 'practice' || activeTab === 'notifications') && (
            <div className="flex justify-end pt-6 border-t">
              <button
                onClick={handleSave}
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center"
              >
                <Save className="w-4 h-4 mr-2" />
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;