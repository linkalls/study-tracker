import React, { useState, useEffect } from 'react';
import { SessionData, listSessions } from '../services/sessionApi'; // Assuming sessionApi.ts is in ../services/
import { format } from 'date-fns'; // For date formatting

// Helper function to format duration (can be moved to a utils file later)
const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  let durationString = `${hours} hour${hours === 1 ? '' : 's'}`;
  if (remainingMinutes > 0) {
    durationString += ` ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}`;
  }
  return durationString;
};

// Note: Ensure custom-scrollbar utilities are defined in a global CSS file (e.g., index.css)
// Example for index.css:
// @layer utilities {
//   .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
//   .custom-scrollbar::-webkit-scrollbar-track { @apply bg-gray-100 dark:bg-gray-700/50 rounded-md; }
//   .custom-scrollbar::-webkit-scrollbar-thumb { @apply bg-gray-300 dark:bg-gray-500 rounded-md; }
//   .custom-scrollbar::-webkit-scrollbar-thumb:hover { @apply bg-gray-400 dark:bg-gray-400; }
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area"; // Optional, for better scrollbar if needed

const StudyHistory: React.FC = () => {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      setError(null);
      try {
        const response = await listSessions(); 
        setSessions(response.sessions);
      } catch (err: any) {
        console.error("Failed to fetch study history:", err);
        setError(err.message || "Failed to load study history. You may be offline or need to log in.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, []);

  return (
    <Card className="w-full h-full flex flex-col bg-card dark:bg-card text-card-foreground dark:text-card-foreground">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="text-2xl font-semibold text-center">Study History</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden p-0"> {/* p-0 to allow ScrollArea to manage padding if used */}
        {isLoading && (
           <div className="flex-grow flex flex-col items-center justify-center p-4 text-center h-full">
             <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
             <p className="text-muted-foreground">Loading study history...</p>
           </div>
        )}

        {!isLoading && error && (
          <div className="flex-grow flex flex-col items-center justify-center p-4 bg-destructive/10 dark:bg-destructive/20 border border-destructive/30 dark:border-destructive/50 rounded-lg shadow-sm text-sm m-4">
            <p className="text-destructive dark:text-destructive-foreground font-semibold mb-1 text-lg">Error loading history</p>
            <p className="text-destructive/90 dark:text-destructive-foreground/90 text-center">{error}</p>
          </div>
        )}

        {!isLoading && !error && sessions.length === 0 && (
          <div className="flex-grow flex flex-col items-center justify-center p-4 text-center h-full">
            <svg className="w-16 h-16 text-muted-foreground/50 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-muted-foreground">No study sessions recorded yet.</p>
            <p className="text-sm text-muted-foreground/80 mt-1">Start a session to build your history!</p>
          </div>
        )}

        {!isLoading && !error && sessions.length > 0 && (
          // Using ScrollArea for potentially better scrollbar handling with Shadcn
          <ScrollArea className="h-full p-4 pr-6 custom-scrollbar"> {/* Added padding here for content inside ScrollArea */}
            <div className="space-y-4"> 
              {sessions.map((session) => (
                <Card 
                  key={session.id} 
                  className="bg-background dark:bg-muted/30 hover:shadow-md transition-shadow duration-200"
                >
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle 
                      className="text-lg font-semibold text-primary dark:text-primary truncate" 
                      title={session.task_description || 'General Study'}
                    >
                      {session.task_description || 'General Study'}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      {format(new Date(session.start_time), 'PPp')} - 
                      {session.end_time ? ` ${format(new Date(session.end_time), 'PPp')}` : <span className="italic"> Active</span>}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 text-sm">
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>
                        Duration: <span className="font-medium text-foreground">{formatDuration(session.duration_minutes || 0)}</span>
                      </span>
                      <span>
                        Pomodoros: <span className="font-medium text-foreground">{session.pomodoro_cycles || 0}</span>
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default StudyHistory;
