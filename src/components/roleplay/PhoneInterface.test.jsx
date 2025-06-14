// src/__tests__/components/roleplay/PhoneInterface.test.jsx
import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render } from '../../utils/test-utils';
import PhoneInterface from '../../../components/roleplay/PhoneInterface';

const mockProps = {
  roleplayType: 'opener_practice',
  prospectJobTitle: 'CEO',
  prospectIndustry: 'Technology',
  onCallEnd: jest.fn()
};

describe('PhoneInterface', () => {
  test('renders phone interface elements', () => {
    render(<PhoneInterface {...mockProps} />);
    
    expect(screen.getByText(/cold call practice/i)).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument(); // Hang up button
  });

  test('starts call automatically', async () => {
    render(<PhoneInterface {...mockProps} />);
    
    // Should show dialing state initially
    expect(screen.getByText(/connecting to prospect/i)).toBeInTheDocument();
    
    // Should connect after delay
    await waitFor(() => {
      expect(screen.getByText(/connected/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  test('handles hang up action', () => {
    render(<PhoneInterface {...mockProps} />);
    
    const hangUpButton = screen.getByRole('button');
    fireEvent.click(hangUpButton);
    
    expect(mockProps.onCallEnd).toHaveBeenCalled();
  });
});