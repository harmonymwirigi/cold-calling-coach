// Testing utilities
// src/__tests__/utils/mockData.js
export const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    first_name: 'Test',
    prospect_job_title: 'CEO',
    prospect_industry: 'Technology',
    access_level: 'TRIAL',
    created_at: '2023-01-01T00:00:00Z',
    usage_hours: 5.5,
    last_active: '2023-12-01T10:00:00Z'
  };
  
  export const mockProgress = {
    opener_practice: {
      roleplay_type: 'opener_practice',
      marathon_passes: 6,
      legend_attempt_used: false,
      unlocked: true,
      best_score: 3.4,
      total_attempts: 15
    }
  };
  
  export const mockSessions = [
    {
      id: 1,
      roleplay_type: 'opener_practice',
      mode: 'practice',
      calls_attempted: 1,
      calls_passed: 1,
      final_score: 3.5,
      duration_minutes: 3,
      created_at: '2023-12-01T10:00:00Z'
    }
  ];
  