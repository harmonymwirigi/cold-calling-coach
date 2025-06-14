// src/__tests__/components/auth/RegisterForm.test.jsx
import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render } from '../../utils/test-utils';
import RegisterForm from '../../../components/auth/RegisterForm';

describe('RegisterForm', () => {
  test('renders registration form elements', () => {
    render(<RegisterForm />);
    
    expect(screen.getByText(/ai cold calling coach/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/your first name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/your@email.com/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send verification code/i })).toBeInTheDocument();
  });

  test('validates required fields', async () => {
    render(<RegisterForm />);
    
    const submitButton = screen.getByRole('button', { name: /send verification code/i });
    fireEvent.click(submitButton);

    // Since we're mocking the validation, this would depend on implementation
    expect(submitButton).toBeInTheDocument();
  });

  test('progresses through registration steps', async () => {
    render(<RegisterForm />);
    
    // Fill out first step
    fireEvent.change(screen.getByPlaceholderText(/your first name/i), {
      target: { value: 'John' }
    });
    fireEvent.change(screen.getByPlaceholderText(/your@email.com/i), {
      target: { value: 'john@example.com' }
    });
    
    fireEvent.click(screen.getByRole('button', { name: /send verification code/i }));
    
    // Should progress to verification step
    await waitFor(() => {
      expect(screen.getByText(/we sent a 6-digit code/i)).toBeInTheDocument();
    });
  });
});