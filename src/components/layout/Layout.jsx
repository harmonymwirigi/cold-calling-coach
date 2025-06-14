
// src/components/layout/Layout.jsx
import React from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const Layout = ({ children }) => {
  const location = useLocation();
  
  // Routes that should hide the sidebar
  const hideSidebarRoutes = ['/roleplay'];
  const shouldHideSidebar = hideSidebarRoutes.some(route => 
    location.pathname.startsWith(route)
  );

  if (shouldHideSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 ml-64 mt-16 p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;