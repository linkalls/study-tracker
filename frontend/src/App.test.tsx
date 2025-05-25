import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import App from './App';
import * as sessionApi from './services/sessionApi'; // To mock its functions

// Mock the entire sessionApi module
vi.mock('./services/sessionApi', async (importOriginal) => {
  const actual = await importOriginal<typeof sessionApi>();
  return {
    ...actual,
    getCurrentUser: vi.fn(),
    loginUser: vi.fn(),
    registerUser: vi.fn(),
    logoutUser: vi.fn(),
    getActiveSession: vi.fn(),
    listSessions: vi.fn(), // Also mock this if App calls it directly or indirectly on load
    createSession: vi.fn(),
    updateSession: vi.fn(),
  };
});

const mockedGetCurrentUser = sessionApi.getCurrentUser as vi.MockedFunction<typeof sessionApi.getCurrentUser>;
const mockedLoginUser = sessionApi.loginUser as vi.MockedFunction<typeof sessionApi.loginUser>;
const mockedRegisterUser = sessionApi.registerUser as vi.MockedFunction<typeof sessionApi.registerUser>;
const mockedLogoutUser = sessionApi.logoutUser as vi.MockedFunction<typeof sessionApi.logoutUser>;
const mockedGetActiveSession = sessionApi.getActiveSession as vi.MockedFunction<typeof sessionApi.getActiveSession>;
const mockedListSessions = sessionApi.listSessions as vi.MockedFunction<typeof sessionApi.listSessions>;


// Mock PomodoroTimer, StudyLogger, StudyHistory to simplify App.tsx tests focused on auth
vi.mock('./components/PomodoroTimer', () => ({
  __esModule: true,
  default: (props: any) => <div data-testid="pomodoro-timer" onClick={() => props.onWorkSessionStart?.(new Date())}>PomodoroTimer</div>,
}));
vi.mock('./components/StudyLogger', () => ({
  __esModule: true,
  default: (props: any) => <div data-testid="study-logger" onClick={() => props.onSessionStart?.({id: 1, user_id:1, start_time: new Date().toISOString()}, "test task from logger")}>StudyLogger</div>,
}));
vi.mock('./components/StudyHistory', () => ({
  __esModule: true,
  default: () => <div data-testid="study-history">StudyHistory</div>,
}));


describe('App Component - Authentication Flow', () => {
  beforeEach(() => {
    // Reset mocks and localStorage before each test (localStorage is cleared by setupTests.ts)
    vi.clearAllMocks(); // Clears call counts, etc.
    mockedGetActiveSession.mockResolvedValue({ session: null }); // Default for most tests
    mockedListSessions.mockResolvedValue({ sessions: [] }); // Default for StudyHistory
  });

  it('shows loading state initially, then login form if no token', async () => {
    mockedGetCurrentUser.mockResolvedValue({ user: null });
    render(<App />);
    expect(screen.getByText(/Checking authentication.../i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Login or Register/i)).toBeInTheDocument();
      expect(screen.queryByTestId('pomodoro-timer')).not.toBeInTheDocument();
    });
  });

  it('shows main app content if token exists and user is fetched', async () => {
    localStorage.setItem('jwtToken', 'fake.jwt.token');
    mockedGetCurrentUser.mockResolvedValue({ user: { id: 1, username: 'testuser' } });
    
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText(/Hi, testuser!/i)).toBeInTheDocument();
      expect(screen.getByTestId('pomodoro-timer')).toBeInTheDocument();
      expect(screen.getByTestId('study-logger')).toBeInTheDocument();
      expect(screen.getByTestId('study-history')).toBeInTheDocument();
    });
    expect(mockedGetActiveSession).toHaveBeenCalled(); // Check if session data is fetched for logged-in user
  });

  it('handles invalid token by showing login form', async () => {
    localStorage.setItem('jwtToken', 'invalid.token');
    mockedGetCurrentUser.mockResolvedValue({ user: null }); // Simulate /me returning no user for invalid token
    
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText(/Login or Register/i)).toBeInTheDocument();
    });
    // Check if localStorage.removeItem was called (implicitly by fetchApi or explicitly by App)
    // This needs spyOn localStorage.removeItem if not already handled by global mock.
    // The current localStorage mock in setupTests.ts doesn't track calls, but it would be cleared.
  });

  it('handles login correctly', async () => {
    mockedGetCurrentUser.mockResolvedValueOnce({ user: null }); // Initial check
    mockedLoginUser.mockResolvedValueOnce({ 
      message: 'Login successful', 
      token: 'new.fake.token', 
      user: { id: 1, username: 'newuser' } 
    });
    // Subsequent getCurrentUser call after login
    mockedGetCurrentUser.mockResolvedValueOnce({ user: { id: 1, username: 'newuser' } });

    render(<App />);
    
    // Wait for login form
    await waitFor(() => screen.getByLabelText(/Username/i));
    
    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: 'newuser' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: /Login/i }));

    await waitFor(() => {
      expect(mockedLoginUser).toHaveBeenCalledWith('newuser', 'password');
      expect(localStorage.getItem('jwtToken')).toBe('new.fake.token');
      expect(screen.getByText(/Hi, newuser!/i)).toBeInTheDocument();
    });
  });
  
  it('handles registration correctly (logs in user and shows app)', async () => {
    mockedGetCurrentUser.mockResolvedValueOnce({ user: null }); // Initial check
    mockedRegisterUser.mockResolvedValueOnce({ 
      message: 'Registration successful', 
      token: 'registered.fake.token', 
      user: { id: 2, username: 'reggeduser' } 
    });
    mockedGetCurrentUser.mockResolvedValueOnce({ user: { id: 2, username: 'reggeduser' } }); // After registration

    render(<App />);
    await waitFor(() => screen.getByLabelText(/Username/i));
    
    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: 'reggeduser' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'newpass' } });
    fireEvent.click(screen.getByRole('button', { name: /Register/i }));

    await waitFor(() => {
      expect(mockedRegisterUser).toHaveBeenCalledWith('reggeduser', 'newpass');
      expect(localStorage.getItem('jwtToken')).toBe('registered.fake.token');
      expect(screen.getByText(/Hi, reggeduser!/i)).toBeInTheDocument();
    });
  });


  it('handles logout correctly', async () => {
    // Initial state: logged in
    localStorage.setItem('jwtToken', 'user.to.logout.token');
    mockedGetCurrentUser.mockResolvedValueOnce({ user: { id: 3, username: 'logoutuser' } });
    mockedLogoutUser.mockResolvedValue({ message: 'Logout successful' });

    render(<App />);
    
    // Wait for app to load as logged in user
    await waitFor(() => screen.getByText(/Hi, logoutuser!/i));
    
    fireEvent.click(screen.getByRole('button', { name: /Logout/i }));

    await waitFor(() => {
      expect(mockedLogoutUser).toHaveBeenCalled();
      expect(localStorage.getItem('jwtToken')).toBeNull();
      expect(screen.getByText(/Login or Register/i)).toBeInTheDocument(); // Back to login form
    });
  });
  
  it('displays an error message if login fails', async () => {
    mockedGetCurrentUser.mockResolvedValue({ user: null });
    mockedLoginUser.mockRejectedValue(new Error('Invalid credentials test error'));
    render(<App />);
    await waitFor(() => screen.getByLabelText(/Username/i));

    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: 'baduser' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'badpass' } });
    fireEvent.click(screen.getByRole('button', { name: /Login/i }));

    await waitFor(() => {
      expect(screen.getByText(/Invalid credentials test error/i)).toBeInTheDocument();
    });
  });

});
