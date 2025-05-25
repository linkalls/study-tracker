import React, { useState, useEffect, useCallback } from 'react';
import { SessionData, getActiveSession, createSession, updateSession } from '../services/sessionApi';

interface StudyLoggerProps {
  activeSession: SessionData | null;
  onSessionStart: (session: SessionData, taskDescription: string) => void; // Pass task description up
  onSessionEnd: (session: SessionData | null) => void;
  initialTaskDescription?: string; // Allow App to set initial task, e.g., from a previous unfinished session
}

const StudyLogger: React.FC<StudyLoggerProps> = ({ activeSession, onSessionStart, onSessionEnd, initialTaskDescription }) => {
  const [taskDescription, setTaskDescription] = useState<string>(initialTaskDescription || '');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeSession?.task_description) {
      setTaskDescription(activeSession.task_description);
    } else if (!activeSession && initialTaskDescription) {
      // If session ends, but there was an initial task for a potential new session (e.g. from App state)
      setTaskDescription(initialTaskDescription);
    } else if (!activeSession) {
      setTaskDescription(''); // Reset if session ends and no new initial task
    }
  }, [activeSession, initialTaskDescription]);

  const handleStartSession = async () => {
    const trimmedTask = taskDescription.trim();
    if (!trimmedTask) {
      setError('Please enter a task description.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const startTime = new Date().toISOString();
      const { session } = await createSession(startTime, trimmedTask);
      onSessionStart(session, trimmedTask); // Pass task description up
    } catch (err: any) {
      setError(err.message || 'Failed to start session.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!activeSession) {
      setError('No active session to end.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const endTime = new Date().toISOString();
      // Duration calculation should ideally happen in App.tsx or be passed in
      // For now, let's assume App.tsx calculates and passes all necessary fields for update
      // Or, the backend could calculate duration if start/end times are provided
      const duration_minutes = Math.round((new Date(endTime).getTime() - new Date(activeSession.start_time).getTime()) / (1000 * 60));
      
      const { session: updatedSession } = await updateSession(activeSession.id, {
        end_time: endTime,
        duration_minutes: duration_minutes,
        // pomodoro_cycles and task_description might also be updated here if changed
        pomodoro_cycles: activeSession.pomodoro_cycles, // Ensure this is up-to-date via props or state
        task_description: activeSession.task_description,
      });
      onSessionEnd(updatedSession); // Notify parent (App.tsx)
    } catch (err: any) {
      setError(err.message || 'Failed to end session.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-5 bg-white dark:bg-gray-800 rounded-xl shadow-lg space-y-4">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 text-center">
        {activeSession ? 'Active Study Session' : 'Start a New Session'}
      </h3>
      
      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-800/50 border border-red-300 dark:border-red-600 rounded-md text-sm">
          <p className="text-red-700 dark:text-red-200 font-medium">Error:</p>
          <p className="text-red-600 dark:text-red-300">{error}</p>
        </div>
      )}
      
      {activeSession ? (
        <div className="space-y-3 pt-2">
          <p className="text-gray-700 dark:text-gray-300">
            <strong>Task:</strong> <span className="font-normal">{activeSession.task_description || 'Not specified'}</span>
          </p>
          <p className="text-gray-700 dark:text-gray-300">
            <strong>Started:</strong> <span className="font-normal">{new Date(activeSession.start_time).toLocaleTimeString()}</span>
          </p>
          <p className="text-gray-700 dark:text-gray-300">
            <strong>Pomodoros:</strong> <span className="font-normal">{activeSession.pomodoro_cycles || 0}</span>
          </p>
          <button
            onClick={handleEndSession}
            disabled={isLoading}
            className="w-full mt-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75 disabled:opacity-60 transition-all duration-150 ease-in-out"
          >
            {isLoading ? 'Ending...' : 'End Current Session'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <label htmlFor="taskDescriptionInput" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Task for this session:
          </label>
          <input
            id="taskDescriptionInput"
            type="text"
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            placeholder="e.g., Chapter 3 review, Project X coding"
            className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none transition-colors"
            disabled={isLoading}
          />
          <button
            onClick={handleStartSession}
            disabled={isLoading}
            className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 disabled:opacity-60 transition-all duration-150 ease-in-out"
          >
            {isLoading ? 'Starting...' : 'Start New Session'}
          </button>
        </div>
      )}
    </div>
  );
};

export default StudyLogger;
