
// src/__tests__/components/Dashboard.test.jsx
import React from 'react';
import { screen } from '@testing-library/react';
import { render } from '../../utils/test-utils';
import Dashboard from '../../pages/Dashboard';

// Mock the contexts
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    userProfile: {
      first_name: 'Test User',
      prospect_job_title: 'CEO',
      prospect_industry: 'Technology'
    }
  })
}));

jest.mock('../../contexts/ProgressContext', () => ({
  useProgress: () => ({
    getRoleplayAccess: () => ({ unlocked: true }),
    getOverallStats: () => ({
      totalSessions: 0,
      totalHours: 0,
      practicesCompleted: 0,
      marathonsCompleted: 0,
      legendsCompleted: 0
    }),
    getRecentActivity: () => [],
    loading: false,
    error: null
  })
}));

describe('Dashboard', () => {
  test('renders welcome message', () => {
    render(<Dashboard />);
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
  });

  test('displays user profile information', () => {
    render(<Dashboard />);
    expect(screen.getByText(/CEO/)).toBeInTheDocument();
    expect(screen.getByText(/Technology/)).toBeInTheDocument();
  });

  test('shows training modules', () => {
    render(<Dashboard />);
    expect(screen.getByText(/training modules/i)).toBeInTheDocument();
  });
});
