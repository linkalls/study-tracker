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
// }


const StudyHistory: React.FC = () => {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Start with loading true
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      // setIsLoading(true); // Already true on initial load
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
    <div className="p-5 bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full h-full flex flex-col"> {/* Ensured w-full and h-full for grid context and defined height */}
      <h2 className="text-2xl font-semibold text-center text-gray-900 dark:text-gray-100 mb-6 flex-shrink-0">
        Study History
      </h2>
      
      {isLoading && (
         <div className="flex-grow flex flex-col items-center justify-center p-4 text-center">
           <div className="w-10 h-10 border-4 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin mb-3"></div>
           <p className="text-gray-600 dark:text-gray-400">Loading study history...</p>
         </div>
      )}

      {!isLoading && error && (
        <div className="flex-grow flex flex-col items-center justify-center p-4 bg-red-50 dark:bg-red-800/30 border border-red-200 dark:border-red-700 rounded-lg shadow-sm text-sm">
          <p className="text-red-700 dark:text-red-200 font-semibold mb-1 text-lg">Error loading history</p>
          <p className="text-red-600 dark:text-red-300 text-center">{error}</p>
        </div>
      )}

      {!isLoading && !error && sessions.length === 0 && (
        <div className="flex-grow flex flex-col items-center justify-center p-4 text-center">
          {/* Optional: Add an icon or illustration here */}
          <svg className="w-16 h-16 text-gray-400 dark:text-gray-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-700 dark:text-gray-300">No study sessions recorded yet.</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Start a session to build your history!</p>
        </div>
      )}

      {!isLoading && !error && sessions.length > 0 && (
        // Added flex-grow and min-h-0 to make overflow-y work correctly in flex column
        <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-grow min-h-0"> 
          {sessions.map((session) => (
            <div 
              key={session.id} 
              className="p-4 bg-gray-50 dark:bg-gray-700/70 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 ease-in-out border-l-4 border-blue-500 dark:border-blue-400 group"
            >
              <h3 
                className="text-md sm:text-lg font-semibold text-blue-600 dark:text-blue-400 mb-1.5 truncate group-hover:text-blue-700 dark:group-hover:text-blue-300" 
                title={session.task_description || 'General Study'}
              >
                {session.task_description || 'General Study'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                <p className="flex items-center space-x-1.5">
                  <span className="font-medium text-gray-700 dark:text-gray-200">Start:</span> 
                  <span>{format(new Date(session.start_time), 'PPp')}</span> {/* PPp for date and time */}
                </p>
                <p className="flex items-center space-x-1.5">
                  <span className="font-medium text-gray-700 dark:text-gray-200">End:</span> 
                  <span>{session.end_time ? format(new Date(session.end_time), 'PPp') : <span className="italic text-gray-500 dark:text-gray-400">Active</span>}</span>
                </p>
                <p className="flex items-center space-x-1.5">
                  <span className="font-medium text-gray-700 dark:text-gray-200">Duration:</span> 
                  <span>{formatDuration(session.duration_minutes || 0)}</span>
                </p>
                <p className="flex items-center space-x-1.5">
                  <span className="font-medium text-gray-700 dark:text-gray-200">Pomodoros:</span> 
                  <span>{session.pomodoro_cycles || 0}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudyHistory;
