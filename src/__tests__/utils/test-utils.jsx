// src/__tests__/utils/test-utils.jsx
import React from 'react';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import { ProgressProvider } from '../contexts/ProgressContext';
import { RoleplayProvider } from '../contexts/RoleplayContext';

const AllTheProviders = ({ children }) => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProgressProvider>
          <RoleplayProvider>
            {children}
          </RoleplayProvider>
        </ProgressProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

const customRender = (ui, options) =>
  render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything
export * from '@testing-library/react';
export { customRender as render }