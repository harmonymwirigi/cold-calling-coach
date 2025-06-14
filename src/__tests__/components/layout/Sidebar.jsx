import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Sidebar from '../../../components/layout/Sidebar';

describe('Sidebar Component', () => {
  test('renders sidebar navigation', () => {
    render(
      <BrowserRouter>
        <Sidebar />
      </BrowserRouter>
    );
    
    // Test that sidebar renders
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});
