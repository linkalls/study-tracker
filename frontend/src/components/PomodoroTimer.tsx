import React, { useState, useEffect, useRef } from 'react';

// Default timer durations (in minutes)
const DEFAULT_WORK_DURATION = 25;
const DEFAULT_SHORT_BREAK_DURATION = 5;
const DEFAULT_LONG_BREAK_DURATION = 15;
const POMODOROS_BEFORE_LONG_BREAK = 4;

type Mode = 'work' | 'shortBreak' | 'longBreak';

// == Callbacks for App.tsx ==
export interface PomodoroTimerProps { // Exporting for App.tsx
  onWorkSessionStart?: (startTime: Date) => void;
  onWorkSessionComplete?: () => void;
  onTimerStop?: (currentTime: Date) => void; // Called on reset or manual stop during work
  // activeStudySession: SessionData | null; // Added to potentially disable timer if no study session
}

const PomodoroTimer: React.FC<PomodoroTimerProps> = ({ onWorkSessionStart, onWorkSessionComplete, onTimerStop }) => {
  const [workDuration, setWorkDuration] = useState(DEFAULT_WORK_DURATION * 60); // in seconds
  const [shortBreakDuration, setShortBreakDuration] = useState(DEFAULT_SHORT_BREAK_DURATION * 60);
  const [longBreakDuration, setLongBreakDuration] = useState(DEFAULT_LONG_BREAK_DURATION * 60);

  const [currentMode, setCurrentMode] = useState<Mode>('work');
  const [timeRemaining, setTimeRemaining] = useState(workDuration);
  const [isRunning, setIsRunning] = useState(false);
  const [pomodorosCompleted, setPomodorosCompleted] = useState(0);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null); // For notification sound

  // == Notification and Sound Logic ==
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support desktop notification');
      return false;
    }
    if (Notification.permission === 'granted') {
      return true;
    }
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  };

  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(error => console.error("Error playing sound:", error));
    }
  };

  const showNotification = (message: string) => {
    requestNotificationPermission().then(granted => {
      if (granted) {
        new Notification(message);
        playNotificationSound();
      } else if (Notification.permission !== 'denied') {
        console.log("Notification permission not granted, but not denied.");
        // Optionally, provide a button or a less intrusive way for the user to enable notifications later.
      }
    });
  };

  // Effect to initialize notification sound
  useEffect(() => {
    const audio = new Audio('/notification.mp3'); // Ensure notification.mp3 is in /frontend/public
    audio.preload = 'auto';
    audioRef.current = audio;

    // It's good practice to ask for notification permission based on user interaction,
    // e.g., when they first click "Start". For now, we can try asking when component loads,
    // or defer to the first time showNotification is called.
    // requestNotificationPermission(); // Or call this on first startTimer click
  }, []);

  // == Timer Core Logic ==
  const getDurationForMode = (mode: Mode): number => {
    switch (mode) {
      case 'work':
        return workDuration;
      case 'shortBreak':
        return shortBreakDuration;
      case 'longBreak':
        return longBreakDuration;
      default:
        return workDuration;
    }
  };

  const switchToMode = (newMode: Mode, autoStart: boolean = false) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setCurrentMode(newMode);
    setTimeRemaining(getDurationForMode(newMode));
    setIsRunning(autoStart);
  };

  const handleTimerEnd = () => {
    const prevMode = currentMode;
    let nextModeTarget: Mode = 'work';

    if (prevMode === 'work') {
      if (onWorkSessionComplete) onWorkSessionComplete(); // CB 1: Work session completed
      const newPomodorosCompleted = pomodorosCompleted + 1;
      setPomodorosCompleted(newPomodorosCompleted);
      if (newPomodorosCompleted % POMODOROS_BEFORE_LONG_BREAK === 0) {
        nextModeTarget = 'longBreak';
      } else {
        nextModeTarget = 'shortBreak';
      }
    } else { // Break ended
      nextModeTarget = 'work';
    }
    
    const message = `${modeDisplayNames[prevMode]} session ended. Starting ${modeDisplayNames[nextModeTarget]}.`;
    showNotification(message);
    
    // Switch mode and auto-start the next one
    switchToMode(nextModeTarget, true); 

    if (nextModeTarget === 'work' && onWorkSessionStart) {
       // CB 2: New work session is auto-starting after a break
      onWorkSessionStart(new Date());
    }
  };

  useEffect(() => {
    if (isRunning && timeRemaining > 0) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining((prevTime) => prevTime - 1);
      }, 1000);
    } else if (isRunning && timeRemaining === 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      handleTimerEnd(); // This will now also trigger notification
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, timeRemaining, pomodorosCompleted]); // Added pomodorosCompleted to re-evaluate if needed

  // Effect to update timer display when duration settings change AND timer is not running
  useEffect(() => {
    if (!isRunning) {
        setTimeRemaining(getDurationForMode(currentMode));
    }
  }, [workDuration, shortBreakDuration, longBreakDuration, currentMode, isRunning]);


  const startTimer = () => {
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      requestNotificationPermission();
    }
    if (timeRemaining > 0) {
      setIsRunning(true);
      if (currentMode === 'work' && onWorkSessionStart) {
        // CB 3: Work session is manually started/resumed
        // App.tsx will need to be careful not to create duplicate sessions if one is already active for this work block.
        onWorkSessionStart(new Date());
      }
    }
  };

  const pauseTimer = () => {
    setIsRunning(false);
    // If pausing during a work session is considered "stopping" a study segment
    // if (currentMode === 'work' && onTimerStop) {
    //   onTimerStop(new Date());
    // }
  };

  const resetTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    const wasRunning = isRunning;
    const modeWhenReset = currentMode;
    setIsRunning(false);
    setTimeRemaining(getDurationForMode(currentMode));
    if (wasRunning && modeWhenReset === 'work' && onTimerStop) { // CB 4: Timer reset during an active work session
      onTimerStop(new Date());
    }
    // Resetting pomodoros completed is often desired on a full timer reset.
    // setPomodorosCompleted(0); // App.tsx can manage this based on study session state.
  };


  // Notification logic will go here

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const modeDisplayNames: Record<Mode, string> = {
    work: 'Work',
    shortBreak: 'Short Break',
    longBreak: 'Long Break',
  };

  return (
    <div className="p-5 sm:p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg space-y-6 text-gray-800 dark:text-gray-100">
      {/* Mode Indicators (Tabs) */}
      <div className="flex justify-center space-x-1 sm:space-x-2 bg-gray-100 dark:bg-gray-700 p-1.5 rounded-lg">
        {(['work', 'shortBreak', 'longBreak'] as Mode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => {
              if (isRunning && currentMode === 'work' && mode !== 'work' && onTimerStop) onTimerStop(new Date());
              switchToMode(mode);
            }}
            className={`px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-opacity-75
              ${currentMode === mode 
                ? (mode === 'work' ? 'bg-blue-600 text-white shadow-sm focus:ring-blue-500' 
                  : (mode === 'shortBreak' ? 'bg-green-600 text-white shadow-sm focus:ring-green-500' 
                    : 'bg-indigo-600 text-white shadow-sm focus:ring-indigo-500'))
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 focus:ring-gray-400'
              }`
            }
          >
            {modeDisplayNames[mode]}
          </button>
        ))}
      </div>
      
      {/* Timer Display */}
      <div className="text-center my-4">
        {/* <h2 className="text-xl font-semibold mb-2">{modeDisplayNames[currentMode]}</h2> */} {/* Title is now part of tabs */}
        <p className="text-6xl sm:text-7xl font-bold my-3 text-gray-900 dark:text-gray-50 tracking-tight">
          {formatTime(timeRemaining)}
        </p>
      </div>

      {/* Control Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        <button
          onClick={startTimer}
          disabled={isRunning}
          className="col-span-2 sm:col-span-1 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75 disabled:opacity-60 disabled:hover:bg-green-600 transition-all duration-150 ease-in-out"
        >
          Start
        </button>
        <button
          onClick={pauseTimer}
          disabled={!isRunning}
          className="px-5 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white font-medium rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-75 disabled:opacity-60 disabled:hover:bg-yellow-500 transition-all duration-150 ease-in-out"
        >
          Pause
        </button>
        <button
          onClick={resetTimer}
          className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75 transition-all duration-150 ease-in-out"
        >
          Reset
        </button>
      </div>
      
      <div className="text-center text-sm text-gray-500 dark:text-gray-400 pt-2">
        Pomodoros completed this session: <span className="font-semibold">{pomodorosCompleted}</span>
      </div>

      {/* Settings Section */}
      <div className="pt-5 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-3 text-center text-gray-800 dark:text-gray-200">Timer Settings</h3>
        <div className="space-y-3 text-sm">
          {(['work', 'shortBreak', 'longBreak'] as Mode[]).map((modeKey) => (
            <div key={modeKey} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md">
              <label htmlFor={`${modeKey}DurationInput`} className="text-gray-700 dark:text-gray-300">
                {modeDisplayNames[modeKey]} Duration:
              </label>
              <div className="flex items-center">
                <input 
                  id={`${modeKey}DurationInput`}
                  type="number" 
                  value={
                    modeKey === 'work' ? workDuration / 60 :
                    modeKey === 'shortBreak' ? shortBreakDuration / 60 :
                    longBreakDuration / 60
                  } 
                  onChange={(e) => {
                    const newDurationMinutes = Math.max(1, parseInt(e.target.value));
                    const newDurationSeconds = newDurationMinutes * 60;
                    if (modeKey === 'work') {
                      setWorkDuration(newDurationSeconds);
                      if (currentMode === 'work' && !isRunning) setTimeRemaining(newDurationSeconds);
                    } else if (modeKey === 'shortBreak') {
                      setShortBreakDuration(newDurationSeconds);
                      if (currentMode === 'shortBreak' && !isRunning) setTimeRemaining(newDurationSeconds);
                    } else {
                      setLongBreakDuration(newDurationSeconds);
                      if (currentMode === 'longBreak' && !isRunning) setTimeRemaining(newDurationSeconds);
                    }
                  }} 
                  className="p-1.5 w-16 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none text-center"
                  min="1"
                /> 
                <span className="ml-2 text-gray-600 dark:text-gray-400">min</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PomodoroTimer;
