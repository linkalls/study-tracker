import React, { useState, useEffect, useCallback } from 'react';
import { SessionData, createSession, updateSession } from '../services/sessionApi'; // Removed getActiveSession as App.tsx handles it
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"; // For better structure

interface StudyLoggerProps {
  activeSession: SessionData | null;
  onSessionStart: (session: SessionData, taskDescription: string) => void;
  onSessionEnd: (session: SessionData | null) => void;
  initialTaskDescription?: string;
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
    <Card className="w-full bg-card dark:bg-card text-card-foreground dark:text-card-foreground">
      <CardHeader>
        <CardTitle className="text-center text-xl">
          {activeSession ? 'Active Study Session' : 'Start a New Session'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-destructive/10 dark:bg-destructive/20 border border-destructive/30 dark:border-destructive/50 rounded-md text-sm">
            <p className="text-destructive dark:text-destructive-foreground font-medium">Error:</p>
            <p className="text-destructive/90 dark:text-destructive-foreground/90">{error}</p>
          </div>
        )}
        
        {activeSession ? (
          <div className="space-y-3 pt-1">
            <p className="text-sm">
              <span className="font-semibold text-muted-foreground">Task:</span> {activeSession.task_description || 'Not specified'}
            </p>
            <p className="text-sm">
              <span className="font-semibold text-muted-foreground">Started:</span> {new Date(activeSession.start_time).toLocaleTimeString()}
            </p>
            <p className="text-sm">
              <span className="font-semibold text-muted-foreground">Pomodoros:</span> {activeSession.pomodoro_cycles || 0}
            </p>
            <Button
              onClick={handleEndSession}
              disabled={isLoading}
              variant="destructive"
              className="w-full mt-3"
            >
              {isLoading ? 'Ending...' : 'End Current Session'}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="taskDescriptionInput" className="text-muted-foreground">
                Task for this session:
              </Label>
              <Input
                id="taskDescriptionInput"
                type="text"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="e.g., Chapter 3 review, Project X coding"
                disabled={isLoading}
                className="bg-input dark:bg-input text-foreground dark:text-foreground"
              />
            </div>
            <Button
              onClick={handleStartSession}
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isLoading ? 'Starting...' : 'Start New Session'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StudyLogger;
