import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigation } from "./useNavigation";

interface TimerState {
  duration: number;
  startTime: number | null;
  isRunning: boolean;
  isBreakMode?: boolean;
  breakDuration?: number;
  breakStartTime?: number | null;
  breakIsRunning?: boolean;
  minimized?: boolean;
}

// Helper function to save timer state and ensure events are properly dispatched
const saveTimerState = (state: TimerState) => {
  const stateStr = JSON.stringify(state);
  localStorage.setItem("timerState", stateStr);

  // Dispatch a storage event to notify other components
  try {
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "timerState",
        newValue: stateStr,
        storageArea: localStorage,
      })
    );
  } catch (e) {
    console.error("Failed to dispatch storage event:", e);
  }
};

export const useTimer = (directNavigate?: (page: string) => void) => {
  const { user } = useAuth();
  const { setSelected } = useNavigation();

  // Get default minutes from user preferences, or use 60 minutes as fallback
  const defaultMinutes = user?.preferences?.defaultMinutes || 60;
  const defaultSeconds = defaultMinutes * 60;

  // DND toggle — persisted in localStorage, independent of settings preference
  const [dndEnabled, setDndEnabled] = useState<boolean>(() => {
    const stored = localStorage.getItem("timerDndEnabled");
    if (stored !== null) return stored === "true";
    // Default to the user preference
    return user?.preferences?.autoDoNotDisturb || false;
  });

  // Sync default when user prefs load for the first time
  useEffect(() => {
    if (localStorage.getItem("timerDndEnabled") === null && user?.preferences?.autoDoNotDisturb !== undefined) {
      setDndEnabled(user.preferences.autoDoNotDisturb);
    }
  }, [user?.preferences?.autoDoNotDisturb]);

  const toggleDnd = () => {
    setDndEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("timerDndEnabled", String(next));
      // Immediately turn off system DND when disabling
      if (!next && window.electron?.setDoNotDisturb) {
        window.electron.setDoNotDisturb(false).catch((error: Error) => {
          console.error("Failed to disable Do Not Disturb:", error);
        });
      }
      return next;
    });
  };

  // Helper function to set Do Not Disturb
  const setDoNotDisturb = (enabled: boolean) => {
    if (dndEnabled && window.electron?.setDoNotDisturb) {
      window.electron.setDoNotDisturb(enabled).catch((error: Error) => {
        console.error("Failed to set Do Not Disturb:", error);
      });
    }
  };

  // Main timer states - start at 0 in stopwatch mode, defaultSeconds in countdown
  const [duration, setDuration] = useState(() => {
    const stopwatch = localStorage.getItem('timerStopwatchMode') === 'true';
    return stopwatch ? 0 : defaultSeconds;
  });
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(() => {
    const stopwatch = localStorage.getItem('timerStopwatchMode') === 'true';
    return stopwatch ? 0 : defaultSeconds;
  });

  // Break timer states
  const [isBreakMode, setIsBreakMode] = useState(false);
  const [breakDuration, setBreakDuration] = useState(300); // Default 5 minutes
  const [breakStartTime, setBreakStartTime] = useState<number | null>(null);
  const [breakIsRunning, setBreakIsRunning] = useState(false);
  const [breakTimeRemaining, setBreakTimeRemaining] = useState(300);

  // UI states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showInSidebar, setShowInSidebar] = useState(false);
  const [timerJustCompleted, setTimerJustCompleted] = useState(false);

  // Stopwatch (count-up) mode
  const [isStopwatchMode, setIsStopwatchMode] = useState(() => {
    return localStorage.getItem('timerStopwatchMode') === 'true';
  });

  // Refs for interval management
  const timerIntervalRef = useRef<number | null>(null);
  const breakTimerIntervalRef = useRef<number | null>(null);

  // Current task being worked on (persisted in localStorage)
  const [currentTask, setCurrentTaskState] = useState<string>(() => {
    return localStorage.getItem("currentTask") || "";
  });

  const setCurrentTask = (task: string) => {
    setCurrentTaskState(task);
    if (task) {
      localStorage.setItem("currentTask", task);
    } else {
      localStorage.removeItem("currentTask");
    }
  };

  // Ref to track the last adjustment time to prevent rapid clicking
  const lastAdjustmentTimeRef = useRef<number>(0);
  const adjustmentCooldown = 200; // ms cooldown between adjustments

  // Function to navigate that uses the direct method if provided
  const navigateTo = (page: string) => {
    if (directNavigate) {
      directNavigate(page);
    } else {
      setSelected(page);
    }
  };

  // Initialize timer from localStorage on mount
  useEffect(() => {
    const loadTimerState = () => {
      const storedState = localStorage.getItem("timerState");
      if (!storedState) return;

      try {
        const parsedState = JSON.parse(storedState) as TimerState;

        // Load main timer state
        setDuration(parsedState.duration);
        setStartTime(parsedState.startTime);
        setIsRunning(parsedState.isRunning);

        // Check stopwatch mode from separate localStorage key
        const stopwatchMode = localStorage.getItem('timerStopwatchMode') === 'true';

        // Calculate time remaining for main timer
        if (parsedState.startTime && parsedState.isRunning) {
          const elapsed = Math.floor(
            (Date.now() - parsedState.startTime) / 1000
          );
          if (stopwatchMode) {
            setTimeRemaining(elapsed);
          } else {
            const remaining = Math.max(0, parsedState.duration - elapsed);
            setTimeRemaining(remaining);
          }
        } else {
          setTimeRemaining(parsedState.duration);
        }

        // Load break timer state
        setIsBreakMode(parsedState.isBreakMode || false);

        if (parsedState.isBreakMode) {
          setBreakDuration(parsedState.breakDuration || 300);
          setBreakStartTime(parsedState.breakStartTime);
          setBreakIsRunning(parsedState.breakIsRunning || false);

          // Calculate time remaining for break timer
          if (parsedState.breakStartTime && parsedState.breakIsRunning) {
            const elapsed = Math.floor(
              (Date.now() - parsedState.breakStartTime) / 1000
            );
            const remaining = Math.max(
              0,
              (parsedState.breakDuration || 300) - elapsed
            );
            setBreakTimeRemaining(remaining);
            setIsModalOpen(true);
          } else {
            setBreakTimeRemaining(parsedState.breakDuration || 300);
          }
        }

        // Set UI state
        if (parsedState.minimized && !parsedState.isBreakMode) {
          setShowInSidebar(true);
        } else {
          setShowInSidebar(false);
        }
      } catch (error) {
        console.error("Failed to parse timer state:", error);
      }
    };

    loadTimerState();
  }, []);

  // Main timer effect
  useEffect(() => {
    const updateMainTimer = () => {
      if (!isRunning || !startTime) return;

      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);

      if (isStopwatchMode) {
        // Stopwatch: count up
        setTimeRemaining(elapsed);

        // Update tray with elapsed time + current task
        const minutesElapsed = Math.floor(elapsed / 60).toString() + "m";
        const taskSuffix = currentTask ? ` · ${currentTask.slice(0, 25)}` : "";
        window.electron.send("update-tray", ` ${minutesElapsed}${taskSuffix}`);

        // Save state (no completion check for stopwatch)
        saveTimerState({
          duration,
          startTime,
          isRunning: true,
          isBreakMode,
          breakDuration,
          breakStartTime,
          breakIsRunning,
          minimized: showInSidebar,
        });
      } else {
        // Countdown: count down
        const remaining = Math.max(0, duration - elapsed);
        setTimeRemaining(remaining);

        // Update tray with remaining time + current task
        const minutesLeft = Math.ceil(remaining / 60).toString() + "m";
        const taskSuffix = currentTask ? ` · ${currentTask.slice(0, 25)}` : "";
        window.electron.send("update-tray", ` ${minutesLeft}${taskSuffix}`);

        // Save state
        saveTimerState({
          duration,
          startTime,
          isRunning: true,
          isBreakMode,
          breakDuration,
          breakStartTime,
          breakIsRunning,
          minimized: showInSidebar,
        });

        // Check if timer completed
        if (remaining <= 0) {
          handleTimerComplete();
        }
      }
    };

    // Clear any existing interval
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Set up interval if timer is running
    if (isRunning && startTime) {
      // Update immediately once
      updateMainTimer();

      // Then set up interval
      timerIntervalRef.current = window.setInterval(updateMainTimer, 1000);

      return () => {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
      };
    } else if (!isRunning) {
      // If not running, save that state
      saveTimerState({
        duration,
        startTime: null,
        isRunning: false,
        isBreakMode,
        breakDuration,
        breakStartTime,
        breakIsRunning,
        minimized: showInSidebar,
      });
    }
  }, [isRunning, startTime, duration, isBreakMode, isStopwatchMode, currentTask]);

  // Break timer effect
  useEffect(() => {
    const updateBreakTimer = () => {
      if (!breakIsRunning || !breakStartTime) return;

      const now = Date.now();
      const elapsed = Math.floor((now - breakStartTime) / 1000);
      const remaining = Math.max(0, breakDuration - elapsed);

      setBreakTimeRemaining(remaining);

      // Save state
      saveTimerState({
        duration,
        startTime,
        isRunning,
        isBreakMode: true,
        breakDuration,
        breakStartTime,
        breakIsRunning: true,
        minimized: showInSidebar,
      });

      // Check if timer completed
      if (remaining <= 0) {
        handleBreakComplete();
      }
    };

    // Clear any existing interval
    if (breakTimerIntervalRef.current) {
      clearInterval(breakTimerIntervalRef.current);
      breakTimerIntervalRef.current = null;
    }

    // Set up interval if break timer is running
    if (breakIsRunning && breakStartTime) {
      // Update immediately once
      updateBreakTimer();

      // Then set up interval
      breakTimerIntervalRef.current = window.setInterval(
        updateBreakTimer,
        1000
      );

      return () => {
        if (breakTimerIntervalRef.current) {
          clearInterval(breakTimerIntervalRef.current);
          breakTimerIntervalRef.current = null;
        }
      };
    } else if (!breakIsRunning && isBreakMode) {
      // If break mode but not running, save that state
      saveTimerState({
        duration,
        startTime,
        isRunning,
        isBreakMode: true,
        breakDuration,
        breakStartTime: null,
        breakIsRunning: false,
        minimized: showInSidebar,
      });
    }
  }, [breakIsRunning, breakStartTime, breakDuration, isBreakMode]);

  // Effect for navigation after timer completion
  useEffect(() => {
    if (timerJustCompleted) {
      const navigationTimer = setTimeout(() => {
        navigateTo("Compass");
        setTimerJustCompleted(false);
      }, 500);

      return () => clearTimeout(navigationTimer);
    }
  }, [timerJustCompleted, navigateTo]);

  // Handle main timer completion
  const handleTimerComplete = () => {
    // Clear interval
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Reset timer state
    setIsRunning(false);
    setStartTime(null);
    setTimeRemaining(defaultSeconds);
    setDuration(defaultSeconds);

    // Disable DND when timer completes
    setDoNotDisturb(false);

    // Show notification
    showNotification("Work session completed!");
    window.electron.send("show-window");

    // Open modal
    setIsModalOpen(true);
    setShowInSidebar(false);

    // Update tray
    const totalTimePassed = Math.ceil(duration / 60).toString() + "m";
    window.electron.send("update-tray", " " + totalTimePassed + " done!");

    // Set timer completed flag
    setTimerJustCompleted(true);

    setTimeRemaining(defaultSeconds);

    // Remove from localStorage
    localStorage.removeItem("timerState");

    // Clear current task when timer completes
    setCurrentTask("");
  };

  // Handle break timer completion
  const handleBreakComplete = () => {
    // Clear interval
    if (breakTimerIntervalRef.current) {
      clearInterval(breakTimerIntervalRef.current);
      breakTimerIntervalRef.current = null;
    }

    // Reset break timer state
    setBreakIsRunning(false);
    setBreakStartTime(null);
    setBreakTimeRemaining(300);
    setBreakDuration(300);

    // Exit break mode
    setIsBreakMode(false);

    // Disable DND when break completes
    setDoNotDisturb(false);

    // Close modal and sidebar
    setIsModalOpen(false);
    setShowInSidebar(false);

    // Show notification
    showNotification("Break time is over!");
    window.electron.send("show-window");
    window.electron.send("update-tray", " Break over!");

    // Update localStorage
    saveTimerState({
      duration,
      startTime,
      isRunning,
      isBreakMode: false,
      minimized: false,
    });
  };

  // Toggle timer (start/pause)
  const toggleTimer = () => {
    if (isBreakMode) {
      // Toggle break timer
      if (breakIsRunning) {
        // Pause break timer
        setBreakIsRunning(false);
        setBreakDuration(breakTimeRemaining);
        setBreakStartTime(null);
        // Disable DND when pausing break
        setDoNotDisturb(false);
      } else {
        // Start break timer
        const newBreakStartTime =
          Date.now() - (breakDuration - breakTimeRemaining) * 1000;
        setBreakStartTime(newBreakStartTime);
        setBreakIsRunning(true);
        // Enable DND when starting break
        setDoNotDisturb(true);
      }
    } else {
      // Toggle main timer
      if (isRunning) {
        // Pause main timer
        setIsRunning(false);
        setDuration(timeRemaining);
        setStartTime(null);

        // Update tray
        const trayString = ` Paused ${Math.ceil(
          timeRemaining / 60
        ).toString()}m`;
        window.electron.send("update-tray", trayString);

        // Disable DND when pausing
        setDoNotDisturb(false);
      } else {
        // Start main timer
        let newStartTime: number;
        if (isStopwatchMode) {
          // Stopwatch: resume from elapsed time (timeRemaining = elapsed so far)
          newStartTime = Date.now() - timeRemaining * 1000;
        } else {
          // Countdown: resume from remaining time
          newStartTime = Date.now() - (duration - timeRemaining) * 1000;
        }
        setStartTime(newStartTime);
        setIsRunning(true);

        // Enable DND when starting
        setDoNotDisturb(true);
      }
    }
  };

  // Adjust timer duration (+/-)
  const handleAdjustTime = (amount: number) => {
    // Implement debounce for rapid clicking
    const now = Date.now();
    if (now - lastAdjustmentTimeRef.current < adjustmentCooldown) {
      return; // Ignore rapid clicks
    }
    lastAdjustmentTimeRef.current = now;

    if (isRunning && startTime) {
      if (isStopwatchMode) {
        // Adjust running stopwatch: shift startTime to change displayed elapsed time
        const currentElapsed = Math.floor((Date.now() - startTime) / 1000);
        const newElapsed = Math.max(0, currentElapsed + amount);
        const newStartTime = Date.now() - newElapsed * 1000;
        setStartTime(newStartTime);
        setTimeRemaining(newElapsed);

        // Save to localStorage
        saveTimerState({
          duration,
          startTime: newStartTime,
          isRunning,
          isBreakMode,
          breakDuration,
          breakStartTime,
          breakIsRunning,
          minimized: showInSidebar,
        });
      } else {
        // Adjust running countdown timer
        const newDuration = Math.max(duration + amount, 0);
        setDuration(newDuration);

        // Calculate new time remaining
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const newRemaining = Math.max(0, newDuration - elapsed);
        setTimeRemaining(newRemaining);

        // Save to localStorage
        saveTimerState({
          duration: newDuration,
          startTime,
          isRunning,
          isBreakMode,
          breakDuration,
          breakStartTime,
          breakIsRunning,
          minimized: showInSidebar,
        });
      }
    } else {
      // Adjust paused timer (change both duration and timeRemaining)
      const newTime = Math.max(timeRemaining + amount, 0);
      setTimeRemaining(newTime);
      setDuration(newTime);

      // Save to localStorage
      saveTimerState({
        duration: newTime,
        startTime,
        isRunning,
        isBreakMode,
        breakDuration,
        breakStartTime,
        breakIsRunning,
        minimized: showInSidebar,
      });
    }
  };

  // Reset timer
  const handleReset = () => {
    // Clear interval
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Reset timer state
    if (isStopwatchMode) {
      setDuration(0);
      setTimeRemaining(0);
    } else {
      setDuration(defaultSeconds);
      setTimeRemaining(defaultSeconds);
    }
    setStartTime(null);
    setIsRunning(false);
    setShowInSidebar(false);

    // Disable DND when timer is reset
    setDoNotDisturb(false);

    // Clear from localStorage
    localStorage.removeItem("timerState");

    // Clear current task on reset
    setCurrentTask("");
  };

  // Start a break timer
  const handleStartBreak = (breakMinutes: number) => {
    // Set break duration
    const newBreakDuration = breakMinutes * 60;
    setBreakDuration(newBreakDuration);
    setBreakTimeRemaining(newBreakDuration);

    // Enable break mode
    setIsBreakMode(true);

    // Start the break timer
    const now = Date.now();
    setBreakStartTime(now);
    setBreakIsRunning(true);

    // Enable DND when starting break
    setDoNotDisturb(true);

    // Save state
    saveTimerState({
      duration,
      startTime,
      isRunning,
      isBreakMode: true,
      breakDuration: newBreakDuration,
      breakStartTime: now,
      breakIsRunning: true,
      minimized: showInSidebar,
    });

    // Update tray
    window.electron.send("update-tray", ` Break: ${breakMinutes}m`);
  };

  // Restart work timer after a break
  const handleRestartTimer = () => {
    // Reset break timer if it's running
    if (isBreakMode) {
      handleBreakTimerReset();
    }

    // Set up a new work timer
    const now = Date.now();
    setDuration(defaultSeconds);
    setTimeRemaining(defaultSeconds);
    setStartTime(now);
    setIsRunning(true);
    setShowInSidebar(false);

    // Close the modal directly — avoids handleCloseModal overwriting
    // the new timer state with stale closure values
    setIsModalOpen(false);

    // Enable DND when restarting timer
    setDoNotDisturb(true);

    // Save state
    saveTimerState({
      duration: defaultSeconds,
      startTime: now,
      isRunning: true,
      isBreakMode: false,
      minimized: false,
    });

    // Update tray
    window.electron.send("update-tray", ` ${defaultMinutes}m`);
  };

  // Close modal but keep timer running in sidebar
  const handleCloseModal = () => {
    // Toggle modal state
    setIsModalOpen((prev) => !prev);

    // If closing the modal, handle sidebar visibility
    if (isModalOpen) {
      // Only move main work timer to sidebar, never the break timer
      if (isRunning && !isBreakMode) {
        setShowInSidebar(true);

        // Update localStorage
        saveTimerState({
          duration,
          startTime,
          isRunning,
          isBreakMode,
          breakDuration,
          breakStartTime,
          breakIsRunning,
          minimized: true,
        });
      } else if (!isRunning && isStopwatchMode) {
        // In stopwatch mode, reset to 0 after session is done
        setDuration(0);
        setTimeRemaining(0);
        setStartTime(null);
        localStorage.removeItem("timerState");
      }
    }
  };

  // Cancel the sidebar timer
  const handleCancelSidebarTimer = () => {
    if (isBreakMode) {
      handleBreakTimerReset();
    } else {
      handleReset();
    }

    setShowInSidebar(false);
  };

  // Hide sidebar timer without stopping it
  const handleHideSidebarTimer = () => {
    // Only change visibility
    setShowInSidebar(false);

    // Save state
    saveTimerState({
      duration,
      startTime,
      isRunning,
      isBreakMode,
      breakDuration,
      breakStartTime,
      breakIsRunning,
      minimized: false,
    });
  };

  // Adjust break timer
  const handleBreakTimerAdjust = (amount: number) => {
    // Implement debounce for rapid clicking
    const now = Date.now();
    if (now - lastAdjustmentTimeRef.current < adjustmentCooldown) {
      return; // Ignore rapid clicks
    }
    lastAdjustmentTimeRef.current = now;

    if (breakIsRunning && breakStartTime) {
      // Adjust running break timer
      const newDuration = Math.max(breakDuration + amount, 0);
      setBreakDuration(newDuration);

      // Calculate new time remaining
      const elapsed = Math.floor((Date.now() - breakStartTime) / 1000);
      const newRemaining = Math.max(0, newDuration - elapsed);
      setBreakTimeRemaining(newRemaining);

      // Save to localStorage
      saveTimerState({
        duration,
        startTime,
        isRunning,
        isBreakMode: true,
        breakDuration: newDuration,
        breakStartTime,
        breakIsRunning: true,
        minimized: showInSidebar,
      });
    } else {
      // Adjust paused break timer
      const newBreakTime = Math.max(breakTimeRemaining + amount, 0);
      setBreakDuration(newBreakTime);
      setBreakTimeRemaining(newBreakTime);

      // Save to localStorage
      saveTimerState({
        duration,
        startTime,
        isRunning,
        isBreakMode: true,
        breakDuration: newBreakTime,
        breakStartTime,
        breakIsRunning: false,
        minimized: showInSidebar,
      });
    }
  };

  // Reset break timer
  const handleBreakTimerReset = () => {
    // Clear interval
    if (breakTimerIntervalRef.current) {
      clearInterval(breakTimerIntervalRef.current);
      breakTimerIntervalRef.current = null;
    }

    // Reset break timer state
    setBreakIsRunning(false);
    setBreakStartTime(null);
    setBreakTimeRemaining(300);
    setBreakDuration(300);

    // Exit break mode
    setIsBreakMode(false);
    setShowInSidebar(false);

    // Disable DND when break timer is reset
    setDoNotDisturb(false);

    // Update localStorage
    saveTimerState({
      duration,
      startTime,
      isRunning,
      isBreakMode: false,
      minimized: false,
    });
  };

  // Show notifications
  const showNotification = (message: string) => {
    if (Notification.permission === "granted") {
      new Notification("Timer Alert", {
        body: message,
      });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new Notification("Timer Alert", {
            body: message,
          });
        }
      });
    }
  };

  // Force synchronize timer state with localStorage
  const synchronizeTimerState = () => {
    const storedState = localStorage.getItem("timerState");
    if (storedState) {
      try {
        const parsedState = JSON.parse(storedState) as TimerState;

        // Sync stopwatch mode
        const stopwatchMode = localStorage.getItem('timerStopwatchMode') === 'true';
        setIsStopwatchMode(stopwatchMode);

        // Set main timer state
        setDuration(parsedState.duration);
        setIsRunning(parsedState.isRunning);
        setIsBreakMode(parsedState.isBreakMode || false);
        setStartTime(parsedState.startTime);

        // Calculate current time remaining
        if (parsedState.startTime && parsedState.isRunning) {
          const elapsed = Math.floor(
            (Date.now() - parsedState.startTime) / 1000
          );
          if (stopwatchMode) {
            setTimeRemaining(elapsed);
          } else {
            const remaining = Math.max(0, parsedState.duration - elapsed);
            setTimeRemaining(remaining);
          }
        } else {
          setTimeRemaining(parsedState.duration);
        }

        // Set break timer state
        if (parsedState.isBreakMode) {
          setBreakDuration(parsedState.breakDuration || 300);
          setBreakIsRunning(parsedState.breakIsRunning || false);
          setBreakStartTime(parsedState.breakStartTime);

          if (parsedState.breakStartTime && parsedState.breakIsRunning) {
            const elapsed = Math.floor(
              (Date.now() - parsedState.breakStartTime) / 1000
            );
            const remaining = Math.max(
              0,
              (parsedState.breakDuration || 300) - elapsed
            );
            setBreakTimeRemaining(remaining);
          } else {
            setBreakTimeRemaining(parsedState.breakDuration || 300);
          }
        }

        // Set UI state
        if (!parsedState.isBreakMode) {
          setShowInSidebar(parsedState.minimized || false);
        } else {
          setShowInSidebar(false);
        }
      } catch (error) {
        console.error("Failed to parse timer state from localStorage:", error);
      }
    }
  };

  // Force refresh timer display without changing time
  const forceRefreshTimerDisplay = () => {
    // If on Compass page, ensure timer isn't in sidebar
    if (isRunning) {
      setShowInSidebar(false);

      // Update localStorage
      saveTimerState({
        duration,
        startTime,
        isRunning,
        isBreakMode,
        breakDuration,
        breakStartTime,
        breakIsRunning,
        minimized: false,
      });
    }

    // Recalculate time remaining for displayed timer
    if (isRunning && startTime) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      if (isStopwatchMode) {
        setTimeRemaining(elapsed);
      } else {
        const remaining = Math.max(0, duration - elapsed);
        setTimeRemaining(remaining);
      }
    } else if (breakIsRunning && breakStartTime) {
      const elapsed = Math.floor((Date.now() - breakStartTime) / 1000);
      const remaining = Math.max(0, breakDuration - elapsed);
      setBreakTimeRemaining(remaining);
    }
  };

  // Toggle between countdown and stopwatch modes
  const toggleStopwatchMode = () => {
    const newMode = !isStopwatchMode;
    setIsStopwatchMode(newMode);
    localStorage.setItem('timerStopwatchMode', String(newMode));

    // Reset timer when switching modes
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    setIsRunning(false);
    setStartTime(null);
    setShowInSidebar(false);
    setDoNotDisturb(false);

    if (newMode) {
      // Switching to stopwatch: start at 0
      setDuration(0);
      setTimeRemaining(0);
    } else {
      // Switching to countdown: reset to default
      setDuration(defaultSeconds);
      setTimeRemaining(defaultSeconds);
    }

    localStorage.removeItem("timerState");
  };

  // Compute session minutes for the modal pre-fill
  const sessionMinutes = isStopwatchMode
    ? Math.round(timeRemaining / 60)
    : defaultMinutes;

  return {
    timeRemaining,
    isRunning,
    handleStartPause: toggleTimer,
    handleAdjustTime,
    handleReset,
    handleStartBreak,
    handleRestartTimer,
    isModalOpen,
    handleCloseModal,
    // Break timer props
    breakTimeRemaining,
    breakIsRunning,
    isBreakMode,
    handleBreakTimerStartPause: toggleTimer,
    handleBreakTimerReset,
    handleBreakTimerAdjust,
    // Sidebar timer props
    showInSidebar,
    handleCancelSidebarTimer,
    handleHideSidebarTimer,
    // Also expose the unified function
    toggleTimer,
    // Sync functions for components that need to force refresh
    synchronizeTimerState,
    forceRefreshTimerDisplay,
    // Stopwatch mode
    isStopwatchMode,
    toggleStopwatchMode,
    sessionMinutes,
    // Current task
    currentTask,
    setCurrentTask,
    // DND toggle
    dndEnabled,
    toggleDnd,
  };
};
