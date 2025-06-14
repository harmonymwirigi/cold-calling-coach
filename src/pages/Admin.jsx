// src/pages/Admin.jsx
import React, { useState, useEffect } from 'react';
import { Users, Settings, BarChart3, Clock, Shield, Search, Filter, Download, Edit, Trash2 } from 'lucide-react';

// Admin Dashboard Component
const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);

  // Mock data - replace with actual API calls
  const mockStats = {
    totalUsers: 1247,
    activeUsers: 892,
    trialUsers: 654,
    unlimitedUsers: 193,
    dailyUsage: 45.2,
    monthlyUsage: 1238,
    conversionRate: 15.5
  };

  const mockUsers = [
    {
      id: '1',
      firstName: 'John',
      email: 'john@example.com',
      accessLevel: 'TRIAL',
      prospectJobTitle: 'CEO',
      prospectIndustry: 'Technology',
      usageHours: 12.5,
      lastActive: '2025-06-13T10:30:00Z',
      joinDate: '2025-06-01T09:00:00Z',
      sessionsCompleted: 45,
      averageScore: 3.2
    },
    {
      id: '2',
      firstName: 'Sarah',
      email: 'sarah@example.com',
      accessLevel: 'UNLIMITED',
      prospectJobTitle: 'VP Marketing',
      prospectIndustry: 'Healthcare',
      usageHours: 28.7,
      lastActive: '2025-06-13T14:15:00Z',
      joinDate: '2025-05-15T11:00:00Z',
      sessionsCompleted: 89,
      averageScore: 3.7
    },
    {
      id: '3',
      firstName: 'Mike',
      email: 'mike@example.com',
      accessLevel: 'LIMITED',
      prospectJobTitle: 'Sales Manager',
      prospectIndustry: 'Finance',
      usageHours: 2.1,
      lastActive: '2025-06-10T16:45:00Z',
      joinDate: '2025-06-12T14:30:00Z',
      sessionsCompleted: 8,
      averageScore: 2.9
    }
  ];

  useEffect(() => {
    setStats(mockStats);
    setUsers(mockUsers);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600">AI Cold Calling Coach Management</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>System Online</span>
              </div>
              
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                <Download className="w-4 h-4 inline mr-2" />
                Export Data
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <nav className="flex border-b">
            {[
              { id: 'overview', name: 'Overview', icon: BarChart3 },
              { id: 'users', name: 'Users', icon: Users },
              { id: 'usage', name: 'Usage Analytics', icon: Clock },
              { id: 'settings', name: 'Settings', icon: Settings }
            ].map((tab) => (
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

        {/* Tab Content */}
        {activeTab === 'overview' && <OverviewTab stats={stats} />}
        {activeTab === 'users' && <UsersTab users={users} setUsers={setUsers} />}
        {activeTab === 'usage' && <UsageTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
};

// Overview Tab
const OverviewTab = ({ stats }) => (
  <div className="space-y-6">
    {/* Key Metrics */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">Total Users</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalUsers?.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center">
          <div className="p-2 bg-green-100 rounded-lg">
            <BarChart3 className="w-6 h-6 text-green-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">Active Users</p>
            <p className="text-2xl font-bold text-gray-900">{stats.activeUsers?.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Clock className="w-6 h-6 text-purple-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">Daily Usage</p>
            <p className="text-2xl font-bold text-gray-900">{stats.dailyUsage}h</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center">
          <div className="p-2 bg-yellow-100 rounded-lg">
            <Shield className="w-6 h-6 text-yellow-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
            <p className="text-2xl font-bold text-gray-900">{stats.conversionRate}%</p>
          </div>
        </div>
      </div>
    </div>

    {/* Access Level Distribution */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Access Level Distribution</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Trial Users</span>
            <div className="flex items-center space-x-2">
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '52%' }}></div>
              </div>
              <span className="text-sm font-medium text-gray-900">{stats.trialUsers}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Unlimited Users</span>
            <div className="flex items-center space-x-2">
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: '15%' }}></div>
              </div>
              <span className="text-sm font-medium text-gray-900">{stats.unlimitedUsers}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Limited Users</span>
            <div className="flex items-center space-x-2">
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div className="bg-orange-500 h-2 rounded-full" style={{ width: '33%' }}></div>
              </div>
              <span className="text-sm font-medium text-gray-900">400</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {[
            { action: 'New user registered', user: 'john@example.com', time: '2 minutes ago' },
            { action: 'Marathon completed', user: 'sarah@example.com', time: '15 minutes ago' },
            { action: 'Legend achieved', user: 'mike@example.com', time: '1 hour ago' },
            { action: 'Trial converted', user: 'anna@example.com', time: '2 hours ago' }
          ].map((activity, index) => (
            <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
              <div>
                <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                <p className="text-xs text-gray-500">{activity.user}</p>
              </div>
              <span className="text-xs text-gray-400">{activity.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// Users Tab
const UsersTab = ({ users, setUsers }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showBulkActions, setShowBulkActions] = useState(false);

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterLevel === 'ALL' || user.accessLevel === filterLevel;
    return matchesSearch && matchesFilter;
  });

  const handleAccessLevelChange = (userId, newLevel) => {
    setUsers(users.map(user => 
      user.id === userId ? { ...user, accessLevel: newLevel } : user
    ));
  };

  const handleBulkAction = (action) => {
    if (action === 'upgrade_trial') {
      setUsers(users.map(user => 
        selectedUsers.includes(user.id) && user.accessLevel === 'TRIAL'
          ? { ...user, accessLevel: 'UNLIMITED' }
          : user
      ));
    }
    setSelectedUsers([]);
    setShowBulkActions(false);
  };

  const getAccessLevelBadge = (level) => {
    const colors = {
      UNLIMITED: 'bg-green-100 text-green-800',
      TRIAL: 'bg-blue-100 text-blue-800',
      LIMITED: 'bg-orange-100 text-orange-800'
    };
    return `px-2 py-1 rounded-full text-xs font-medium ${colors[level]}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Filters and Search */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">User Management</h3>
          {selectedUsers.length > 0 && (
            <button
              onClick={() => setShowBulkActions(!showBulkActions)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Bulk Actions ({selectedUsers.length})
            </button>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Access Levels</option>
            <option value="UNLIMITED">Unlimited</option>
            <option value="TRIAL">Trial</option>
            <option value="LIMITED">Limited</option>
          </select>
        </div>

        {/* Bulk Actions */}
        {showBulkActions && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-blue-900">Bulk Actions:</span>
              <button
                onClick={() => handleBulkAction('upgrade_trial')}
                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
              >
                Upgrade to Unlimited
              </button>
              <button
                onClick={() => handleBulkAction('send_email')}
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              >
                Send Email
              </button>
              <button
                onClick={() => setSelectedUsers([])}
                className="text-gray-600 hover:text-gray-800 text-sm"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <input
                  type="checkbox"
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedUsers(filteredUsers.map(u => u.id));
                    } else {
                      setSelectedUsers([]);
                    }
                  }}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Access Level</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performance</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Active</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUsers([...selectedUsers, user.id]);
                      } else {
                        setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                </td>
                <td className="px-6 py-4">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{user.firstName}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                    <div className="text-xs text-gray-400">
                      {user.prospectJobTitle} • {user.prospectIndustry}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <select
                    value={user.accessLevel}
                    onChange={(e) => handleAccessLevelChange(user.id, e.target.value)}
                    className={`${getAccessLevelBadge(user.accessLevel)} border-none bg-transparent`}
                  >
                    <option value="UNLIMITED">Unlimited</option>
                    <option value="TRIAL">Trial</option>
                    <option value="LIMITED">Limited</option>
                  </select>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">{user.usageHours}h</div>
                  <div className="text-xs text-gray-500">{user.sessionsCompleted} sessions</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">Avg: {user.averageScore}/4</div>
                  <div className="w-16 bg-gray-200 rounded-full h-1 mt-1">
                    <div 
                      className="bg-blue-500 h-1 rounded-full" 
                      style={{ width: `${(user.averageScore / 4) * 100}%` }}
                    ></div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {new Date(user.lastActive).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <button className="text-blue-600 hover:text-blue-800">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button className="text-red-600 hover:text-red-800">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Usage Analytics Tab
const UsageTab = () => (
  <div className="space-y-6">
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Analytics</h3>
      <p className="text-gray-600">Detailed usage analytics and reporting will be implemented here.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div className="border rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Peak Usage Hours</h4>
          <p className="text-sm text-gray-600">9:00 AM - 11:00 AM (EST)</p>
        </div>
        
        <div className="border rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Most Popular Roleplay</h4>
          <p className="text-sm text-gray-600">Opener + Early Objections</p>
        </div>
      </div>
    </div>
  </div>
);

// Settings Tab
const SettingsTab = () => {
  const [settings, setSettings] = useState({
    maxUsageHours: 50,
    sessionTimeout: 30,
    autoArchiveDays: 90,
    emailNotifications: true,
    maintenanceMode: false
  });

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">System Settings</h3>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Usage Hours (Monthly)
              </label>
              <input
                type="number"
                value={settings.maxUsageHours}
                onChange={(e) => handleSettingChange('maxUsageHours', parseInt(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session Timeout (minutes)
              </label>
              <input
                type="number"
                value={settings.sessionTimeout}
                onChange={(e) => handleSettingChange('sessionTimeout', parseInt(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Email Notifications</h4>
                <p className="text-sm text-gray-500">Send system notifications to users</p>
              </div>
              <input
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={(e) => handleSettingChange('emailNotifications', e.target.checked)}
                className="rounded border-gray-300"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Maintenance Mode</h4>
                <p className="text-sm text-gray-500">Temporarily disable user access</p>
              </div>
              <input
                type="checkbox"
                checked={settings.maintenanceMode}
                onChange={(e) => handleSettingChange('maintenanceMode', e.target.checked)}
                className="rounded border-gray-300"
              />
            </div>
          </div>
          
          <div className="pt-4 border-t">
            <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;