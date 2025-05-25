import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import PomodoroTimer from './components/PomodoroTimer'; // PomodoroTimerProps is exported from PomodoroTimer.tsx
import StudyLogger from './components/StudyLogger';
import StudyHistory from './components/StudyHistory';
import { 
  SessionData, 
  getActiveSession, 
  createSession, 
  updateSession,
  getCurrentUser,
  loginUser,
  registerUser,
  logoutUser,
  User
} from './services/sessionApi';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UserCircle, LogOut } from 'lucide-react';
import { Separator } from "@/components/ui/separator"; // Import Separator

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
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
    <div className="min-h-screen flex flex-col items-center p-4 pt-6 md:pt-10 selection:bg-primary/70 selection:text-primary-foreground">
      <header className="mb-8 md:mb-10 w-full">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-primary dark:text-primary">FocusFlow</h1>
          {currentUser && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2 p-2 rounded-full hover:bg-accent dark:hover:bg-accent/50">
                  <UserCircle className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground dark:text-foreground hidden sm:inline">{currentUser.username}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48 bg-background dark:bg-popover mr-2">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive dark:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {!currentUser && authChecked && (
           <p className="text-base sm:text-lg text-muted-foreground dark:text-muted-foreground mt-1.5 text-center">
            Please log in or register to use the application.
          </p>
        )}
      </header>

      {appError && (
        <div className="my-4 p-3 bg-destructive/10 dark:bg-destructive/20 border border-destructive/30 dark:border-destructive/50 text-destructive dark:text-destructive-foreground rounded-lg shadow-md max-w-xl w-full mx-auto text-sm">
          <p className="font-semibold mb-1">Application Error:</p>
          <p>{appError}</p>
        </div>
      )}

      {!currentUser && authChecked ? (
        <Card className="w-full max-w-sm bg-card dark:bg-card text-card-foreground dark:text-card-foreground">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-center">
              Login or Register
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input id="username" type="text" value={usernameInput} onChange={e => setUsernameInput(e.target.value)} required 
                       placeholder="Enter your username"
                       className="bg-input dark:bg-input text-foreground dark:text-foreground"/>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} required 
                       placeholder="Enter your password"
                       className="bg-input dark:bg-input text-foreground dark:text-foreground"/>
              </div>
              <div className="flex space-x-3 pt-2">
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                  Login
                </Button>
                <Button type="button" onClick={handleRegister} variant="outline" className="w-full">
                  Register
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : currentUser && authChecked ? ( 
        <main className="w-full max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 items-start">
            {/* Left column for Timer and Logger */}
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

            {/* Right column for History */}
            <div className="md:mt-0 w-full h-full"> {/* Ensure StudyHistory can take full height */}
              <StudyHistory />
            </div>
          </div>
          
          {/* Separator can be used if there are sections below the main grid, or between app sections if layout was different */}
          {/* Example: If there was another section below */}
          {/* <Separator className="my-8 md:my-12" /> */}
          {/* <AnotherSection /> */}

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
