import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import Sidebar from '../src/components/Sidebar';
import * as AuthContext from '../src/components/AuthContext';
import * as ThemeContext from '../src/components/ThemeContext';

jest.mock('../src/components/AuthContext', () => ({
  useAuth: jest.fn()
}));

jest.mock('../src/components/ThemeContext', () => ({
  useTheme: jest.fn()
}));

describe('Sidebar Component', () => {
  let mockLogout;
  let mockToggleDarkMode;

  beforeEach(() => {
    mockLogout = jest.fn();
    mockToggleDarkMode = jest.fn();

    jest.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { name: 'Test User', role: 'ADMIN' },
      logout: mockLogout,
    });
    jest.spyOn(ThemeContext, 'useTheme').mockReturnValue({
      darkMode: false,
      toggleDarkMode: mockToggleDarkMode,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders without crashing and shows brand', () => {
    render(
      <BrowserRouter>
        <Sidebar collapsed={false} setCollapsed={jest.fn()} />
      </BrowserRouter>
    );

    expect(screen.getByText('Perf Track')).toBeInTheDocument();
  });

  it('shows key navigation links for ADMIN', () => {
    render(
      <BrowserRouter>
        <Sidebar collapsed={false} setCollapsed={jest.fn()} />
      </BrowserRouter>
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('handles sign out click', () => {
    render(
      <BrowserRouter>
        <Sidebar collapsed={false} setCollapsed={jest.fn()} />
      </BrowserRouter>
    );

    const signOutBtn = screen.getByTitle('Sign Out');
    fireEvent.click(signOutBtn);
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('handles theme toggle click', () => {
    render(
      <BrowserRouter>
        <Sidebar collapsed={false} setCollapsed={jest.fn()} />
      </BrowserRouter>
    );

    const themeBtn = screen.getByTitle('Dark Mode');
    fireEvent.click(themeBtn);
    expect(mockToggleDarkMode).toHaveBeenCalledTimes(1);
  });
});
