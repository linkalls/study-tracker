import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import PomodoroTimer, { PomodoroTimerProps } from './components/PomodoroTimer';
import StudyLogger from './components/StudyLogger';
import StudyHistory from './components/StudyHistory';
// Updated imports for JWT auth
import { 
  SessionData, 
  getActiveSession, 
  createSession, 
  updateSession,
  getCurrentUser, // For auth check
  loginUser,      // For dummy login/register UI
  registerUser,   // For dummy login/register UI
  logoutUser,     // For logout button
  User
} from './services/sessionApi';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState<boolean>(false); // To prevent rendering protected content before check
  const [activeStudySession, setActiveStudySession] = useState<SessionData | null>(null);
  const [appError, setAppError] = useState<string | null>(null);
  const [taskForNextSession, setTaskForNextSession] = useState<string>('');

  // --- Authentication State Management ---
  const checkAuthStatus = useCallback(async () => {
    const token = localStorage.getItem('jwtToken');
    if (token) {
      try {
        const { user } = await getCurrentUser(); // This will use the token from localStorage via fetchApi
        setCurrentUser(user);
        if (!user) localStorage.removeItem('jwtToken'); // Backend says token invalid
      } catch (error) {
        console.error("Auth check failed:", error);
        localStorage.removeItem('jwtToken'); // Clear token on any error during /me
        setCurrentUser(null);
      }
    } else {
      setCurrentUser(null);
    }
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // --- Study Session Management (depends on currentUser) ---
  useEffect(() => {
    if (currentUser) { // Only fetch sessions if user is authenticated
      const fetchCurrentStudySession = async () => {
        try {
          setAppError(null);
          const { session } = await getActiveSession();
          setActiveStudySession(session);
        } catch (error: any) {
          console.error("Failed to fetch active study session:", error);
          // setAppError("Could not load active study session."); // Avoid overriding auth errors
        }
      };
      fetchCurrentStudySession();
    } else {
      setActiveStudySession(null); // Clear session if user logs out
    }
  }, [currentUser]); // Re-fetch active session if user changes

  const handleStudySessionStart = useCallback(async (session: SessionData, taskDescription: string) => {
    setActiveStudySession(session);
    setTaskForNextSession(taskDescription); // Keep task description for potential re-use or if Pomodoro starts next
    setAppError(null);
  }, []);

  const handleStudySessionEnd = useCallback(async (updatedSession: SessionData | null) => {
    setActiveStudySession(null);
    // setTaskForNextSession(''); // Decide if task should clear when session ends
    setAppError(null);
    console.log('Study session ended. Updated session data (if any):', updatedSession);
  }, []);

  const handlePomodoroWorkStart = useCallback(async (startTime: Date) => {
    if (!currentUser) return; // Should not happen if UI hides timer for logged out users
    console.log('Pomodoro work started at:', startTime);
    if (!activeStudySession && taskForNextSession.trim()) {
      try {
        setAppError(null);
        const { session: newSession } = await createSession(startTime.toISOString(), taskForNextSession);
        setActiveStudySession(newSession);
      } catch (error: any) {
        console.error("Failed to create session from Pomodoro:", error);
        setAppError(`Failed to start study session: ${error.message}`);
      }
    }
  }, [activeStudySession, taskForNextSession, currentUser]);

  const handlePomodoroWorkComplete = useCallback(() => {
    if (!currentUser || !activeStudySession) return;
    console.log('Pomodoro work cycle complete.');
    setActiveStudySession(prevSession => {
      if (!prevSession) return null;
      const updatedCycles = (prevSession.pomodoro_cycles || 0) + 1;
      return { ...prevSession, pomodoro_cycles: updatedCycles };
    });
  }, [activeStudySession, currentUser]);

  const handlePomodoroStop = useCallback(async (stopTime: Date) => {
    if (!currentUser || !activeStudySession) return;
    console.log('Pomodoro timer stopped at:', stopTime);
    try {
      setAppError(null);
      const duration_minutes = Math.round((stopTime.getTime() - new Date(activeStudySession.start_time).getTime()) / (1000 * 60));
      const { session: updatedSessionData } = await updateSession(activeStudySession.id, {
        end_time: stopTime.toISOString(),
        duration_minutes: duration_minutes,
        pomodoro_cycles: activeStudySession.pomodoro_cycles,
        task_description: activeStudySession.task_description,
      });
      handleStudySessionEnd(updatedSessionData);
    } catch (error: any) {
      console.error("Failed to update session on Pomodoro stop:", error);
      setAppError(`Failed to end study session: ${error.message}.`);
    }
  }, [activeStudySession, handleStudySessionEnd, currentUser]);

  // --- Dummy Auth UI Handlers ---
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAppError(null);
    try {
      await loginUser(usernameInput, passwordInput);
      await checkAuthStatus(); // Re-check auth status to update UI
      setUsernameInput('');
      setPasswordInput('');
    } catch (error: any) {
      setAppError(error.message || "Login failed.");
    }
  };
  
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAppError(null);
    try {
      await registerUser(usernameInput, passwordInput);
      await checkAuthStatus(); // Re-check auth status (user will be logged in via token on register)
      setUsernameInput('');
      setPasswordInput('');
    } catch (error: any) {
      setAppError(error.message || "Registration failed.");
    }
  };

  const handleLogout = async () => {
    setAppError(null);
    try {
      await logoutUser();
      setCurrentUser(null); // Immediately update UI
      setActiveStudySession(null); // Clear active session on logout
      setTaskForNextSession('');
    } catch (error: any) {
      setAppError(error.message || "Logout failed.");
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-lg text-gray-700 dark:text-gray-300">Checking authentication...</p>
        {/* Simple spinner */}
        <div className="ml-3 w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-4 pt-6 md:pt-10 selection:bg-blue-600 selection:text-white">
      <header className="mb-8 md:mb-10 text-center w-full">
        <div className="flex justify-between items-center max-w-5xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold text-blue-600 dark:text-blue-400">FocusFlow</h1>
          {currentUser && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">Hi, {currentUser.username}!</span>
              <button 
                onClick={handleLogout}
                className="px-3 py-1.5 text-xs sm:text-sm bg-red-500 hover:bg-red-600 text-white rounded-md shadow-sm transition-colors"
              >
                Logout
              </button>
            </div>
          )}
        </div>
        {!currentUser && (
           <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 mt-1.5">
            Please log in or register to use the application.
          </p>
        )}
      </header>

      {appError && (
        <div className="my-4 p-3 bg-red-100 dark:bg-red-800/50 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 rounded-lg shadow-md max-w-xl w-full mx-auto text-sm">
          <p className="font-semibold mb-1">Application Error:</p>
          <p>{appError}</p>
        </div>
      )}

      {!currentUser ? (
        <div className="w-full max-w-sm p-6 bg-white dark:bg-gray-800 rounded-xl shadow-xl">
          <h2 className="text-2xl font-semibold text-center text-gray-900 dark:text-gray-100 mb-6">
            Login or Register
          </h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
              <input type="text" value={usernameInput} onChange={e => setUsernameInput(e.target.value)} required 
                     className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-200"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
              <input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} required 
                     className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-200"/>
            </div>
            <div className="flex space-x-4">
              <button type="submit" 
                      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                Login
              </button>
              <button type="button" onClick={handleRegister}
                      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
                Register
              </button>
            </div>
          </form>
        </div>
      ) : (
        <main className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 items-start">
          <div className="space-y-8 md:space-y-10">
            <StudyLogger 
              activeSession={activeStudySession}
              onSessionStart={handleStudySessionStart}
              onSessionEnd={handleStudySessionEnd}
              initialTaskDescription={taskForNextSession}
            />
            <PomodoroTimer 
              onWorkSessionStart={handlePomodoroWorkStart}
              onWorkSessionComplete={handlePomodoroWorkComplete}
              onTimerStop={handlePomodoroStop}
            />
          </div>
          <div className="md:mt-0 w-full">
            <StudyHistory />
          </div>
        </main>
      )}

      <footer className="mt-12 md:mt-16 text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400 w-full">
        <p>Powered by Bun, Elysia, React, and Tailwind CSS.</p>
        <p className="mt-1">
          Tip: Add the <code className="bg-gray-200 dark:bg-gray-700 p-0.5 rounded text-xs">dark</code> class to the <code className="bg-gray-200 dark:bg-gray-700 p-0.5 rounded text-xs">&lt;html&gt;</code> element to enable dark mode.
        </p>
      </footer>
    </div>
  )
}

export default App
