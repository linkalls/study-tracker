import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import PomodoroTimer, { PomodoroTimerProps } from './components/PomodoroTimer';
import StudyLogger from './components/StudyLogger';
import StudyHistory from './components/StudyHistory'; // Import the new component
import { SessionData, getActiveSession, createSession, updateSession } from './services/sessionApi';

function App() {
  const [activeStudySession, setActiveStudySession] = useState<SessionData | null>(null);
  // currentTaskDescription is primarily managed by StudyLogger now, but App needs it if Pomodoro starts a session.
  // Let's simplify: StudyLogger will provide the task description when it starts a session.
  // Pomodoro starting a session will only happen if a task has been set in StudyLogger.
  const [appError, setAppError] = useState<string | null>(null);
  const [taskForNextSession, setTaskForNextSession] = useState<string>('');


  // Fetch active session on mount
  useEffect(() => {
    const fetchSession = async () => {
      try {
        setAppError(null);
        const { session } = await getActiveSession();
        setActiveStudySession(session);
        if (session?.task_description) {
          setCurrentTaskDescription(session.task_description);
        }
      } catch (error: any) {
        console.error("Failed to fetch active session:", error);
        setAppError("Could not load active session. You might be offline or need to log in.");
        // If 401, redirect to login or show login prompt, not handled in this scope
      }
    };
    fetchSession();
  }, []);

  const handleStudySessionStart = useCallback(async (session: SessionData) => {
    setActiveStudySession(session);
    if (session.task_description) setCurrentTaskDescription(session.task_description);
    setAppError(null);
  }, []);

  const handleStudySessionEnd = useCallback(async (updatedSession: SessionData | null) => {
    // If updatedSession is null, it means StudyLogger initiated end without Pomodoro interaction
    // If PomodoroTimer calls stop, it will pass the date, then StudyLogger handles UI
    if (updatedSession) {
      console.log('Study session ended and updated:', updatedSession);
    } else {
       console.log('Study session ended.');
    }
    setActiveStudySession(null);
    // setCurrentTaskDescription(''); // Keep task description for potential new session
    setAppError(null);
  }, []);


  // Callbacks for PomodoroTimer
  const handlePomodoroWorkStart = useCallback(async (startTime: Date) => {
    console.log('Pomodoro work started at:', startTime);
    if (!activeStudySession && taskForNextSession.trim()) { 
      try {
        setAppError(null);
        const { session: newSession } = await createSession(startTime.toISOString(), taskForNextSession);
        setActiveStudySession(newSession);
        // setTaskForNextSession(''); // Clear after use if desired, or let StudyLogger manage its input
        console.log('New study session created by Pomodoro start:', newSession);
      } catch (error: any) {
        console.error("Failed to create session from Pomodoro:", error);
        setAppError(`Failed to start study session: ${error.message}`);
      }
    } else if (activeStudySession) {
      // console.log('Pomodoro work started, existing study session continues:', activeStudySession.id);
    }
  }, [activeStudySession, taskForNextSession]);

  const handlePomodoroWorkComplete = useCallback(() => {
    console.log('Pomodoro work cycle complete.');
    if (activeStudySession) {
      setActiveStudySession(prevSession => {
        if (!prevSession) return null;
        const updatedCycles = (prevSession.pomodoro_cycles || 0) + 1;
        console.log(`Incrementing pomodoros for session ${prevSession.id} to ${updatedCycles}`);
        // This state update is local. Backend is updated when session fully ends.
        return { ...prevSession, pomodoro_cycles: updatedCycles };
      });
    }
  }, [activeStudySession]);

  const handlePomodoroStop = useCallback(async (stopTime: Date) => {
    console.log('Pomodoro timer stopped at:', stopTime);
    if (activeStudySession) {
      setAppError(null);
      try {
        const duration_minutes = Math.round((stopTime.getTime() - new Date(activeStudySession.start_time).getTime()) / (1000 * 60));
        const { session: updatedSessionData } = await updateSession(activeStudySession.id, {
          end_time: stopTime.toISOString(),
          duration_minutes: duration_minutes,
          pomodoro_cycles: activeStudySession.pomodoro_cycles, // Send current cycle count
          task_description: activeStudySession.task_description,
        });
        handleStudySessionEnd(updatedSessionData); // Use the callback to clear state
      } catch (error: any) {
        console.error("Failed to update session on Pomodoro stop:", error);
        setAppError(`Failed to end study session: ${error.message}. Session may still be active on server.`);
      }
    }
  }, [activeStudySession, handleStudySessionEnd]);


  return (
    // Body background is set in index.css via @apply bg-gray-50 dark:bg-gray-900
    <div className="min-h-screen flex flex-col items-center p-4 pt-6 md:pt-10 selection:bg-blue-600 selection:text-white">
      <header className="mb-8 md:mb-10 text-center w-full">
        <h1 className="text-4xl sm:text-5xl font-bold text-blue-600 dark:text-blue-400">FocusFlow</h1>
        <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 mt-1.5">
          Your Pomodoro Timer for Enhanced Productivity
        </p>
      </header>

      {appError && (
        <div className="my-4 p-3 bg-red-100 dark:bg-red-800/50 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 rounded-lg shadow-md max-w-xl w-full mx-auto text-sm">
          <p className="font-semibold mb-1">Application Error:</p>
          <p>{appError}</p>
        </div>
      )}

      {/* Main content area: Using grid for potentially more complex layouts later */}
      <main className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 items-start">
        {/* Left column for Timer and Logger */}
        <div className="space-y-8 md:space-y-10">
          <StudyLogger 
            activeSession={activeStudySession}
            onSessionStart={(session, taskDesc) => {
              handleStudySessionStart(session);
              setTaskForNextSession(taskDesc); // Update App's knowledge of current task
            }}
            onSessionEnd={handleStudySessionEnd}
            initialTaskDescription={taskForNextSession} // Allow App to suggest a task
          />
          <PomodoroTimer 
            onWorkSessionStart={handlePomodoroWorkStart}
            onWorkSessionComplete={handlePomodoroWorkComplete}
            onTimerStop={handlePomodoroStop}
            // Consider passing a prop to disable Pomodoro if activeStudySession is null and no taskForNextSession
            // This would guide user to use StudyLogger first.
            // canStartPomodoro={!!activeStudySession || !!taskForNextSession.trim()}
          />
        </div>

        {/* Right column for History */}
        <div className="md:mt-0 w-full"> {/* mt-0 for md, defaults for mobile stack */}
          <StudyHistory />
        </div>
      </main>

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
