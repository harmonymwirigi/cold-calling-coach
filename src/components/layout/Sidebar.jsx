// src/components/layout/Sidebar.jsx
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Home, 
  Phone, 
  User, 
  Trophy, 
  BarChart3, 
  Settings, 
  Shield,
  Clock,
  Target,
  Award
} from 'lucide-react';

const Sidebar = () => {
  const { userProfile, isAdmin } = useAuth();
  const location = useLocation();

  const navigation = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: Home,
      description: 'Overview and progress'
    },
    {
      name: 'Training Modules',
      path: '/training',
      icon: Target,
      description: 'Practice sessions',
      subItems: [
        { name: 'Opener Practice', path: '/roleplay/opener_practice/practice' },
        { name: 'Pitch Practice', path: '/roleplay/pitch_practice/practice' },
        { name: 'Full Simulation', path: '/roleplay/full_simulation/practice' }
      ]
    },
    {
      name: 'Progress',
      path: '/progress',
      icon: BarChart3,
      description: 'Your statistics'
    },
    {
      name: 'Achievements',
      path: '/achievements',
      icon: Award,
      description: 'Unlock rewards'
    }
  ];

  const settingsNavigation = [
    {
      name: 'Profile Settings',
      path: '/profile',
      icon: User,
      description: 'Account preferences'
    }
  ];

  if (isAdmin()) {
    settingsNavigation.push({
      name: 'Admin Panel',
      path: '/admin',
      icon: Shield,
      description: 'System management'
    });
  }

  const NavItem = ({ item, isSubItem = false }) => {
    const isActive = location.pathname === item.path || 
                    (item.subItems && item.subItems.some(sub => location.pathname === sub.path));
    
    return (
      <div>
        <NavLink
          to={item.path}
          className={({ isActive: linkActive }) => `
            group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors
            ${linkActive || isActive
              ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-600'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }
            ${isSubItem ? 'ml-6 pl-6' : ''}
          `}
        >
          <item.icon className={`
            mr-3 flex-shrink-0 h-5 w-5
            ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'}
            ${isSubItem ? 'h-4 w-4' : ''}
          `} />
          <div className="flex-1">
            <div className={isSubItem ? 'text-xs' : 'text-sm'}>{item.name}</div>
            {!isSubItem && item.description && (
              <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>
            )}
          </div>
        </NavLink>
        
        {/* Sub Items */}
        {item.subItems && isActive && (
          <div className="mt-1 space-y-1">
            {item.subItems.map((subItem) => (
              <NavItem key={subItem.path} item={subItem} isSubItem={true} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed left-0 top-16 bottom-0 w-64 bg-white border-r border-gray-200 overflow-y-auto z-20">
      <div className="p-4">
        {/* User Profile Summary */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">
                {userProfile?.first_name?.charAt(0) || 'U'}
              </span>
            </div>
            <div className="ml-3">
              <div className="text-sm font-medium text-gray-900">
                {userProfile?.first_name || 'User'}
              </div>
              <div className="text-xs text-gray-500">
                {userProfile?.prospect_job_title || 'Practitioner'}
              </div>
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white/50 rounded px-2 py-1">
              <div className="text-blue-600 font-semibold">0</div>
              <div className="text-gray-600">Sessions</div>
            </div>
            <div className="bg-white/50 rounded px-2 py-1">
              <div className="text-blue-600 font-semibold">0h</div>
              <div className="text-gray-600">Practice</div>
            </div>
          </div>
        </div>

        {/* Main Navigation */}
        <nav className="space-y-2 mb-8">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-3">
            Training
          </div>
          {navigation.map((item) => (
            <NavItem key={item.path} item={item} />
          ))}
        </nav>

        {/* Settings Navigation */}
        <nav className="space-y-2">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-3">
            Settings
          </div>
          {settingsNavigation.map((item) => (
            <NavItem key={item.path} item={item} />
          ))}
        </nav>

        {/* Practice Tip */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-start">
            <Clock className="w-4 h-4 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
            <div>
              <div className="text-xs font-medium text-yellow-800">Daily Tip</div>
              <div className="text-xs text-yellow-700 mt-1">
                Practice 10 minutes daily for best results!
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;