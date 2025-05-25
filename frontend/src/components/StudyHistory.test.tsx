import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import StudyHistory from './StudyHistory'; // Adjust path as needed
import * as sessionApi from '../services/sessionApi'; // To mock its functions
import { SessionData } from '../services/sessionApi'; // Import type

// Mock the sessionApi module
vi.mock('../services/sessionApi', async (importOriginal) => {
  const actual = await importOriginal<typeof sessionApi>();
  return {
    ...actual,
    listSessions: vi.fn(), // Mock specific function
  };
});

const mockListSessions = sessionApi.listSessions as vi.MockedFunction<typeof sessionApi.listSessions>;

describe('StudyHistory Component', () => {
  const mockSessions: SessionData[] = [
    { id: 1, user_id: 1, start_time: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), end_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), duration_minutes: 60, task_description: 'Task 1: Backend API', pomodoro_cycles: 2 },
    { id: 2, user_id: 1, start_time: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), end_time: new Date(Date.now() - 0.5 * 60 * 60 * 1000).toISOString(), duration_minutes: 30, task_description: 'Task 2: Frontend UI', pomodoro_cycles: 1 },
    { id: 3, user_id: 1, start_time: new Date(Date.now() - 0.2 * 60 * 60 * 1000).toISOString(), end_time: null, duration_minutes: 0, task_description: 'Task 3: Active Session', pomodoro_cycles: 0 },
  ];

  beforeEach(() => {
    mockListSessions.mockReset();
  });

  it('displays loading state initially', () => {
    mockListSessions.mockReturnValue(new Promise(() => {})); // Keep it pending
    render(<StudyHistory />);
    expect(screen.getByText(/Loading study history.../i)).toBeInTheDocument();
    // Check for the spinner (assuming it's identifiable, e.g., by role or a test-id)
    // The current spinner is a div with animation, might not have a specific role.
    // If a more specific check is needed, add a test-id to the spinner div.
    expect(screen.getByText(/Loading study history.../i).nextElementSibling).toHaveClass('animate-spin');
  });

  it('displays sessions when data is fetched successfully', async () => {
    mockListSessions.mockResolvedValue({ sessions: mockSessions });
    render(<StudyHistory />);

    await waitFor(() => {
      expect(screen.getByText(/Task 1: Backend API/i)).toBeInTheDocument();
      expect(screen.getByText(/Task 2: Frontend UI/i)).toBeInTheDocument();
      expect(screen.getByText(/Task 3: Active Session/i)).toBeInTheDocument();
    });
    
    // Check for specific details from formatted output
    expect(screen.getByText(/Duration: 1 hour/i)).toBeInTheDocument(); 
    expect(screen.getByText(/Duration: 30 minutes/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Pomodoros: 2/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Pomodoros: 1/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Pomodoros: 0/i).length).toBeGreaterThanOrEqual(1); // For active session
    expect(screen.getByText(/Active/i)).toBeInTheDocument(); // For active session's end time
  });

  it('displays error message when data fetching fails', async () => {
    const errorMessage = 'Custom Network Error';
    mockListSessions.mockRejectedValue(new Error(errorMessage));
    render(<StudyHistory />);

    await waitFor(() => {
      expect(screen.getByText(/Error loading history/i)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(errorMessage, 'i'))).toBeInTheDocument();
    });
  });

  it('attempts to fetch sessions and includes Authorization header implicitly via fetchApi if token exists', async () => {
    localStorage.setItem('jwtToken', 'test-jwt-token'); // Simulate user is logged in
    mockListSessions.mockResolvedValue({ sessions: mockSessions }); // Successful fetch
    
    render(<StudyHistory />);
    
    await waitFor(() => {
      expect(mockListSessions).toHaveBeenCalledTimes(1);
      // We assume fetchApi correctly includes the token from localStorage.
      // Direct verification of the header here would require deeper fetch mocking.
      expect(screen.getByText(/Task 1: Backend API/i)).toBeInTheDocument();
    });
  });

  it('displays "no sessions" message when no sessions are returned', async () => {
    mockListSessions.mockResolvedValue({ sessions: [] });
    render(<StudyHistory />);

    await waitFor(() => {
      expect(screen.getByText(/No study sessions recorded yet/i)).toBeInTheDocument();
      expect(screen.getByText(/Start a session to build your history!/i)).toBeInTheDocument();
    });
  });
});
