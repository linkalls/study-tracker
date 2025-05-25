import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button"; // Shadcn Button
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Shadcn Tabs
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // Shadcn Popover
import { Label } from "@/components/ui/label"; // Shadcn Label
import { Input } from "@/components/ui/input"; // Shadcn Input
import { Settings2 } from 'lucide-react'; // Icon for settings button

// Default timer durations (in minutes)
const DEFAULT_WORK_DURATION = 25;
const DEFAULT_SHORT_BREAK_DURATION = 5;
const DEFAULT_LONG_BREAK_DURATION = 15;
const POMODOROS_BEFORE_LONG_BREAK = 4;

type Mode = 'work' | 'shortBreak' | 'longBreak';

export interface PomodoroTimerProps {
  onWorkSessionStart?: (startTime: Date) => void;
  onWorkSessionComplete?: () => void;
  onTimerStop?: (currentTime: Date) => void;
}

const PomodoroTimer: React.FC<PomodoroTimerProps> = ({ onWorkSessionStart, onWorkSessionComplete, onTimerStop }) => {
  const [workDuration, setWorkDuration] = useState(DEFAULT_WORK_DURATION * 60);
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

  // Handler for mode change from Tabs component
  const handleModeChange = (newMode: string) => {
    const mode = newMode as Mode;
    if (isRunning && currentMode === 'work' && mode !== 'work' && onTimerStop) {
      onTimerStop(new Date());
    }
    switchToMode(mode);
  };

  return (
    <div className="p-5 sm:p-6 bg-card dark:bg-card rounded-xl shadow-lg space-y-6 text-card-foreground dark:text-card-foreground">
      <Tabs value={currentMode} onValueChange={handleModeChange} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="work">Work</TabsTrigger>
          <TabsTrigger value="shortBreak">Short Break</TabsTrigger>
          <TabsTrigger value="longBreak">Long Break</TabsTrigger>
        </TabsList>
        {/* TabsContent is not strictly needed if timer display is outside and reacts to currentMode state */}
      </Tabs>
      
      <div className="text-center my-4">
        <p className="text-6xl sm:text-7xl font-bold my-3 text-foreground dark:text-foreground tracking-tight">
          {formatTime(timeRemaining)}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Button
          onClick={startTimer}
          disabled={isRunning}
          variant="default" // Or specific color like "success" if defined
          className="col-span-2 sm:col-span-1 bg-green-600 hover:bg-green-700 text-white" // Customizing for specific color
        >
          Start
        </Button>
        <Button
          onClick={pauseTimer}
          disabled={!isRunning}
          variant="outline"
          className="border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-white dark:border-yellow-400 dark:text-yellow-400 dark:hover:bg-yellow-500 dark:hover:text-gray-900"
        >
          Pause
        </Button>
        <Button
          onClick={resetTimer}
          variant="destructive"
        >
          Reset
        </Button>
      </div>
      
      <div className="text-center text-sm text-muted-foreground dark:text-muted-foreground pt-2">
        Pomodoros completed this session: <span className="font-semibold">{pomodorosCompleted}</span>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full flex items-center justify-center gap-2">
            <Settings2 className="h-4 w-4" /> Timer Settings
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 space-y-4 p-4 bg-background dark:bg-popover">
          <h3 className="text-lg font-medium text-center text-popover-foreground dark:text-popover-foreground">Adjust Durations</h3>
          <div className="space-y-3 text-sm">
            {(['work', 'shortBreak', 'longBreak'] as Mode[]).map((modeKey) => (
              <div key={modeKey} className="grid grid-cols-3 items-center gap-3">
                <Label htmlFor={`${modeKey}DurationInput`} className="text-popover-foreground dark:text-popover-foreground col-span-1">
                  {modeDisplayNames[modeKey]}:
                </Label>
                <Input 
                  id={`${modeKey}DurationInput`}
                  type="number"
                  min="1"
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
                  className="col-span-2 p-1.5 w-full rounded border bg-input text-foreground focus:ring-1 focus:ring-ring"
                />
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default PomodoroTimer;
