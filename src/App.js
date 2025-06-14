// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { RoleplayProvider } from './contexts/RoleplayContext';
import { ProgressProvider } from './contexts/ProgressContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/layout/Layout';
import LoadingSpinner from './components/ui/LoadingSpinner';
import ErrorBoundary from './components/ui/ErrorBoundary';

// Page imports
import Landing from './pages/Landing';
import Register from './pages/Register';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Roleplay from './pages/Roleplay';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import './index.css';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ProgressProvider>
          <Router>
            <RoleplayProvider>
              <div className="App">
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<Landing />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/login" element={<Login />} />
                  
                  {/* Protected Routes */}
                  <Route path="/dashboard" element={
                    <ProtectedRoute>
                      <Layout>
                        <Dashboard />
                      </Layout>
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/roleplay/:type/:mode" element={
                    <ProtectedRoute>
                      <Roleplay />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/profile" element={
                    <ProtectedRoute>
                      <Layout>
                        <Profile />
                      </Layout>
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/admin" element={
                    <ProtectedRoute requireAdmin>
                      <Layout>
                        <Admin />
                      </Layout>
                    </ProtectedRoute>
                  } />
                  
                  {/* Fallback */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            </RoleplayProvider>
          </Router>
        </ProgressProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;