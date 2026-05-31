import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import Login from '../src/pages/Login';
import * as AuthContext from '../src/components/AuthContext';
import * as ThemeContext from '../src/components/ThemeContext';

jest.mock('../src/components/AuthContext', () => ({
  useAuth: jest.fn()
}));

jest.mock('../src/components/ThemeContext', () => ({
  useTheme: jest.fn()
}));

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock routeConfig to avoid error
jest.mock('../src/routes/routeConfig', () => ({
  preloadRoute: jest.fn(),
}));

describe('Login Component', () => {
  let mockLogin;
  let mockToggleDarkMode;

  beforeEach(() => {
    mockLogin = jest.fn().mockResolvedValue({ success: true });
    mockToggleDarkMode = jest.fn();

    jest.spyOn(AuthContext, 'useAuth').mockReturnValue({
      login: mockLogin,
    });
    jest.spyOn(ThemeContext, 'useTheme').mockReturnValue({
      darkMode: false,
      toggleDarkMode: mockToggleDarkMode,
    });
    mockNavigate.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders without crashing and shows key UI elements', () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    // Check headings and inputs
    expect(screen.getByText('HR Management System')).toBeInTheDocument();
    expect(screen.getByText('Email Address')).toBeInTheDocument();
    expect(screen.getByText('Password')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('name@biat.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
  });

  it('handles input changes', () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    const emailInput = screen.getByPlaceholderText('name@biat.com');
    const passwordInput = screen.getByPlaceholderText('Enter your password');

    fireEvent.change(emailInput, { target: { value: 'test@biat.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    expect(emailInput.value).toBe('test@biat.com');
    expect(passwordInput.value).toBe('password123');
  });

  it('shows error for invalid email domain on submit', async () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    const emailInput = screen.getByPlaceholderText('name@biat.com');
    fireEvent.change(emailInput, { target: { value: 'test@gmail.com' } });

    const submitBtn = screen.getByRole('button', { name: /Sign In/i });
    fireEvent.submit(submitBtn.closest('form'));

    expect(await screen.findByText('Email must end with @biat.com')).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('toggles dark mode when button is clicked', () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    const toggleBtn = screen.getByText('Retro Dark Mode');
    fireEvent.click(toggleBtn);
    expect(mockToggleDarkMode).toHaveBeenCalledTimes(1);
  });
});
