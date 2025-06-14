// src/components/layout/Sidebar.jsx
import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Home, Play, User, BarChart3, Settings } from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Training', href: '/training', icon: Play },
    { name: 'Progress', href: '/progress', icon: BarChart3 },
    { name: 'Profile', href: '/profile', icon: User },
  ];

  const isActive = (href) => location.pathname === href;

  return (
    <div className="w-64 bg-white shadow-sm border-r h-screen sticky top-16">
      <nav className="mt-8 px-4">
        <ul className="space-y-2">
          {navigation.map((item) => (
            <li key={item.name}>
              <Link
                to={item.href}
                className={`
                  flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors
                  ${isActive(item.href)
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }
                `}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;