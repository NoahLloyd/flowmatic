import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";

// Import navigation hook
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

export const useTimer = (directNavigate?: (page: string) => void) => {
  const { user } = useAuth();

  // Get default minutes from user preferences, or use 60 minutes as fallback
  const defaultMinutes = user?.preferences?.defaultMinutes || 60;
  const defaultSeconds = defaultMinutes * 60;

  // Get navigation controls
  const { setSelected } = useNavigation();

  const [duration, setDuration] = useState(defaultSeconds);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(defaultSeconds);
  const [intervalId, setIntervalId] = useState<ReturnType<
    typeof setInterval
  > | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Add a dedicated state for tracking timer completion
  const [timerJustCompleted, setTimerJustCompleted] = useState(false);

  // Break timer states
  const [isBreakMode, setIsBreakMode] = useState(false);
  const [breakDuration, setBreakDuration] = useState(300); // Default 5 minutes
  const [breakStartTime, setBreakStartTime] = useState<number | null>(null);
  const [breakIsRunning, setBreakIsRunning] = useState(false);
  const [breakTimeRemaining, setBreakTimeRemaining] = useState(300);
  const [breakIntervalId, setBreakIntervalId] = useState<ReturnType<
    typeof setInterval
  > | null>(null);

  // State for minimizing the timer to the sidebar
  const [showInSidebar, setShowInSidebar] = useState(false);

  // Add a ref to track the last adjustment time to prevent rapid clicking issues
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

  useEffect(() => {
    const storedState = localStorage.getItem("timerState");
    if (storedState) {
      const parsedState = JSON.parse(storedState) as TimerState;
      setDuration(parsedState.duration);
      setStartTime(parsedState.startTime);
      setIsRunning(parsedState.isRunning);

      // Only set sidebar visibility for main work timer, not for break timer
      if (!parsedState.isBreakMode) {
        setShowInSidebar(parsedState.minimized || false);
      }

      // Load break timer state if it exists
      if (parsedState.isBreakMode) {
        setIsBreakMode(parsedState.isBreakMode);
        setBreakDuration(parsedState.breakDuration || 300);
        setBreakStartTime(parsedState.breakStartTime);
        setBreakIsRunning(parsedState.breakIsRunning || false);

        if (parsedState.breakStartTime && parsedState.breakIsRunning) {
          const elapsed = Math.floor(
            (Date.now() - parsedState.breakStartTime) / 1000
          );
          const remaining = Math.max(
            0,
            parsedState.breakDuration || 300 - elapsed
          );
          setBreakTimeRemaining(remaining);

          // For break timers, always show in modal and never in sidebar
          setIsModalOpen(true);
          setShowInSidebar(false);
        } else {
          setBreakTimeRemaining(parsedState.breakDuration || 300);
        }
      }

      if (parsedState.startTime && parsedState.isRunning) {
        const elapsed = Math.floor((Date.now() - parsedState.startTime) / 1000);
        const remaining = Math.max(0, parsedState.duration - elapsed);
        setTimeRemaining(remaining);

        // Show sidebar timer if minimized and not in break mode
        if (parsedState.minimized && !parsedState.isBreakMode) {
          setShowInSidebar(true);
        }
      } else {
        setTimeRemaining(parsedState.duration);
      }
    }

    // Clear any existing intervals
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }

    if (breakIntervalId) {
      clearInterval(breakIntervalId);
      setBreakIntervalId(null);
    }

    // Setup main timer interval
    if (isRunning && startTime) {
      const id = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, duration - elapsed);
        setTimeRemaining(remaining);

        const timerState: TimerState = {
          duration,
          startTime,
          isRunning: true,
          isBreakMode,
          breakDuration,
          breakStartTime,
          breakIsRunning,
          minimized: showInSidebar,
        };
        localStorage.setItem("timerState", JSON.stringify(timerState));
        const minutesLeft = " " + Math.ceil(remaining / 60).toString() + "m";

        window.electron.send("update-tray", minutesLeft);

        if (remaining <= 0) {
          // Timer has reached zero
          handleTimerComplete();
        }
      }, 1000);

      setIntervalId(id);
    }

    // Setup break timer interval
    if (breakIsRunning && breakStartTime) {
      const id = setInterval(() => {
        const elapsed = Math.floor((Date.now() - breakStartTime) / 1000);
        const remaining = Math.max(0, breakDuration - elapsed);
        setBreakTimeRemaining(remaining);

        const timerState: TimerState = {
          duration,
          startTime,
          isRunning,
          isBreakMode: true,
          breakDuration,
          breakStartTime,
          breakIsRunning: true,
          minimized: showInSidebar,
        };
        localStorage.setItem("timerState", JSON.stringify(timerState));

        if (remaining <= 0) {
          // Break timer has reached zero
          handleBreakComplete();
        }
      }, 1000);

      setBreakIntervalId(id);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (breakIntervalId) {
        clearInterval(breakIntervalId);
      }
    };
  }, [
    isRunning,
    startTime,
    duration,
    breakIsRunning,
    breakStartTime,
    breakDuration,
    showInSidebar,
  ]);

  // Add a dedicated effect for navigation after timer completion
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
    // First stop the timer
    handleReset();

    // Show notification
    showNotification("Work session completed!");
    window.electron.send("show-window");

    // Open modal
    setIsModalOpen(true);
    setShowInSidebar(false);

    // Update tray
    const totalTimePassed = Math.ceil(duration / 60).toString() + "m";
    window.electron.send("update-tray", " " + totalTimePassed + " done!");

    // Wait for modal to be rendered before attempting navigation
    setTimeout(() => {
      navigateTo("Compass");

      // Backup navigation attempts
      setTimeout(() => {
        navigateTo("Compass");

        setTimeout(() => {
          navigateTo("Compass");
        }, 300);
      }, 300);
    }, 500);
  };

  // Handle break timer completion
  const handleBreakComplete = () => {
    // Reset break timer
    setBreakIsRunning(false);
    setBreakStartTime(null);

    // Clear any running interval
    if (breakIntervalId) {
      clearInterval(breakIntervalId);
      setBreakIntervalId(null);
    }

    // Exit break mode
    setIsBreakMode(false);

    // Close modal and sidebar
    setIsModalOpen(false);
    setShowInSidebar(false);

    // Show notification
    showNotification("Break time is over!");
    window.electron.send("show-window");
    window.electron.send("update-tray", " Break over!");

    // Update localStorage
    const timerState: TimerState = {
      duration,
      startTime,
      isRunning,
      isBreakMode: false,
      minimized: false,
    };
    localStorage.setItem("timerState", JSON.stringify(timerState));
  };

  // Create a universal timer toggle function that both sidebar and main timer will use
  const toggleTimer = () => {
    // Before toggling, check if localStorage has more recent state
    const storedState = localStorage.getItem("timerState");
    if (storedState) {
      try {
        const parsedState = JSON.parse(storedState) as TimerState;
        // If localStorage has different values than our current state, sync first
        if (
          parsedState.isBreakMode !== isBreakMode ||
          parsedState.isRunning !== isRunning ||
          parsedState.breakIsRunning !== breakIsRunning
        ) {
          console.log("Detected state mismatch, synchronizing before toggle");
          synchronizeTimerState();
        }
      } catch (error) {
        console.error("Error checking timer state:", error);
      }
    }

    // Now toggle based on current mode
    if (isBreakMode) {
      // Toggle break timer state
      setBreakIsRunning((prev) => {
        const newBreakIsRunning = !prev;

        if (newBreakIsRunning) {
          // Starting the break timer
          const adjustedStartTime =
            Date.now() - (breakDuration - breakTimeRemaining) * 1000;
          setBreakStartTime(adjustedStartTime);
        } else {
          // Pausing the break timer
          setBreakDuration(breakTimeRemaining);
          setBreakStartTime(null);
        }

        // Always save state to localStorage with current sidebar visibility
        const timerState: TimerState = {
          duration,
          startTime,
          isRunning,
          isBreakMode: true,
          breakDuration: newBreakIsRunning ? breakDuration : breakTimeRemaining,
          breakStartTime: newBreakIsRunning
            ? Date.now() - (breakDuration - breakTimeRemaining) * 1000
            : null,
          breakIsRunning: newBreakIsRunning,
          minimized: showInSidebar,
        };
        localStorage.setItem("timerState", JSON.stringify(timerState));

        return newBreakIsRunning;
      });
    } else {
      // Toggle main timer state
      setIsRunning((prev) => {
        const newIsRunning = !prev;

        if (newIsRunning) {
          // Starting the timer - use either existing start time or create new one
          setStartTime(Date.now());
        } else {
          // Pausing the timer - save current time remaining as the new duration
          setDuration(timeRemaining);
          setStartTime(null);

          // Update tray
          const trayString = ` Paused ${Math.ceil(
            timeRemaining / 60
          ).toString()}m`;
          window.electron.send("update-tray", trayString);
        }

        // Always save state to localStorage with current sidebar visibility
        const timerState: TimerState = {
          duration: newIsRunning ? duration : timeRemaining,
          startTime: newIsRunning ? Date.now() : null,
          isRunning: newIsRunning,
          isBreakMode,
          breakDuration,
          breakStartTime,
          breakIsRunning,
          minimized: showInSidebar,
        };
        localStorage.setItem("timerState", JSON.stringify(timerState));

        return newIsRunning;
      });
    }
  };

  const handleAdjustTime = (amount: number) => {
    // Implement debounce for rapid clicking
    const now = Date.now();
    if (now - lastAdjustmentTimeRef.current < adjustmentCooldown) {
      return; // Ignore rapid clicks
    }
    lastAdjustmentTimeRef.current = now;

    if (isRunning && startTime) {
      const newDuration = Math.max(duration + amount, 0);
      setDuration(newDuration);

      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, newDuration - elapsed);
      setTimeRemaining(remaining);

      const timerState: TimerState = {
        duration: newDuration,
        startTime,
        isRunning,
        isBreakMode,
        breakDuration,
        breakStartTime,
        breakIsRunning,
        minimized: showInSidebar,
      };
      localStorage.setItem("timerState", JSON.stringify(timerState));
    } else {
      const newTime = Math.max(duration + amount, 0);
      setDuration(newTime);
      setTimeRemaining(newTime);

      const timerState: TimerState = {
        duration: newTime,
        startTime,
        isRunning,
        isBreakMode,
        breakDuration,
        breakStartTime,
        breakIsRunning,
        minimized: showInSidebar,
      };
      localStorage.setItem("timerState", JSON.stringify(timerState));
    }
  };

  const handleReset = () => {
    setDuration(defaultSeconds);
    setTimeRemaining(defaultSeconds);
    setStartTime(null);
    setIsRunning(false);
    setShowInSidebar(false);
    localStorage.removeItem("timerState");
  };

  // Function to start a break timer
  const handleStartBreak = (breakMinutes: number) => {
    // Set break duration
    const newBreakDuration = breakMinutes * 60;
    setBreakDuration(newBreakDuration);
    setBreakTimeRemaining(newBreakDuration);

    // Enable break mode
    setIsBreakMode(true);

    // Start the break timer
    setBreakStartTime(Date.now());
    setBreakIsRunning(true);

    // Save state
    const timerState: TimerState = {
      duration,
      startTime,
      isRunning,
      isBreakMode: true,
      breakDuration: newBreakDuration,
      breakStartTime: Date.now(),
      breakIsRunning: true,
      minimized: showInSidebar,
    };
    localStorage.setItem("timerState", JSON.stringify(timerState));

    // Update tray
    window.electron.send("update-tray", ` Break: ${breakMinutes}m`);
  };

  // Restart work timer after a break or session
  const handleRestartTimer = () => {
    // Reset break timer if it's running
    if (isBreakMode) {
      handleBreakTimerReset();
    }

    // Set up a new work timer
    setDuration(defaultSeconds);
    setTimeRemaining(defaultSeconds);
    setStartTime(Date.now());
    setIsRunning(true);
    setShowInSidebar(false);

    // Save state
    const timerState: TimerState = {
      duration: defaultSeconds,
      startTime: Date.now(),
      isRunning: true,
      isBreakMode: false,
      minimized: false,
    };
    localStorage.setItem("timerState", JSON.stringify(timerState));

    // Update tray
    window.electron.send("update-tray", ` ${defaultMinutes}m`);
  };

  // Close the modal but keep timer running in sidebar
  const handleCloseModal = () => {
    setIsModalOpen(false);

    // Only move main work timer to sidebar, never the break timer
    if (isRunning && !isBreakMode) {
      setShowInSidebar(true);

      // Update localStorage with minimized state
      const timerState: TimerState = {
        duration,
        startTime,
        isRunning,
        isBreakMode,
        breakDuration,
        breakStartTime,
        breakIsRunning,
        minimized: true,
      };
      localStorage.setItem("timerState", JSON.stringify(timerState));
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

  // Just hide the sidebar timer without stopping it
  const handleHideSidebarTimer = () => {
    // Only change the visibility, don't affect the timer state
    setShowInSidebar(false);

    // Create a complete state object with current values
    const timerState: TimerState = {
      duration,
      startTime,
      isRunning,
      isBreakMode,
      breakDuration,
      breakStartTime,
      breakIsRunning,
      minimized: false, // Update only the minimized flag
    };

    // Save to localStorage to persist the change
    localStorage.setItem("timerState", JSON.stringify(timerState));
  };

  // Function to adjust break timer
  const handleBreakTimerAdjust = (amount: number) => {
    // Implement debounce for rapid clicking
    const now = Date.now();
    if (now - lastAdjustmentTimeRef.current < adjustmentCooldown) {
      return; // Ignore rapid clicks
    }
    lastAdjustmentTimeRef.current = now;

    if (breakIsRunning && breakStartTime) {
      // Adjust running timer
      const newDuration = Math.max(breakDuration + amount, 0);
      setBreakDuration(newDuration);

      const elapsed = Math.floor((Date.now() - breakStartTime) / 1000);
      const remaining = Math.max(0, newDuration - elapsed);
      setBreakTimeRemaining(remaining);

      const timerState: TimerState = {
        duration,
        startTime,
        isRunning,
        isBreakMode: true,
        breakDuration: newDuration,
        breakStartTime,
        breakIsRunning: true,
        minimized: showInSidebar,
      };
      localStorage.setItem("timerState", JSON.stringify(timerState));
    } else {
      // Adjust paused timer
      const newBreakTime = Math.max(breakTimeRemaining + amount, 0);
      setBreakDuration(newBreakTime);
      setBreakTimeRemaining(newBreakTime);

      const timerState: TimerState = {
        duration,
        startTime,
        isRunning,
        isBreakMode: true,
        breakDuration: newBreakTime,
        breakStartTime,
        breakIsRunning: false,
        minimized: showInSidebar,
      };
      localStorage.setItem("timerState", JSON.stringify(timerState));
    }
  };

  // Function to reset break timer
  const handleBreakTimerReset = () => {
    // Stop the break timer
    setBreakIsRunning(false);
    setBreakStartTime(null);

    // Clear any running interval
    if (breakIntervalId) {
      clearInterval(breakIntervalId);
      setBreakIntervalId(null);
    }

    // Reset to default values
    setBreakDuration(300);
    setBreakTimeRemaining(300);

    // Exit break mode
    setIsBreakMode(false);
    setShowInSidebar(false);

    // Update localStorage
    const timerState: TimerState = {
      duration,
      startTime,
      isRunning,
      isBreakMode: false,
      minimized: false,
    };
    localStorage.setItem("timerState", JSON.stringify(timerState));
  };

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

  // Function to force synchronize timer state with localStorage
  const synchronizeTimerState = () => {
    // Force reload the timer state from localStorage
    const storedState = localStorage.getItem("timerState");
    if (storedState) {
      try {
        const parsedState = JSON.parse(storedState) as TimerState;

        // Set all timer states based on localStorage
        setDuration(parsedState.duration);
        setIsRunning(parsedState.isRunning);
        setIsBreakMode(parsedState.isBreakMode || false);

        // Only show in sidebar if it's not a break timer
        if (!parsedState.isBreakMode) {
          setShowInSidebar(parsedState.minimized || false);
        } else {
          // Always ensure break timers are not in the sidebar
          setShowInSidebar(false);
        }

        // Synchronize main timer
        if (parsedState.startTime && parsedState.isRunning) {
          const elapsed = Math.floor(
            (Date.now() - parsedState.startTime) / 1000
          );
          const remaining = Math.max(0, parsedState.duration - elapsed);
          setTimeRemaining(remaining);
          setStartTime(parsedState.startTime);
        } else {
          setTimeRemaining(parsedState.duration);
          setStartTime(parsedState.startTime);
        }

        // Synchronize break timer
        if (parsedState.isBreakMode) {
          setBreakDuration(parsedState.breakDuration || 300);
          setBreakIsRunning(parsedState.breakIsRunning || false);

          if (parsedState.breakStartTime && parsedState.breakIsRunning) {
            const elapsed = Math.floor(
              (Date.now() - parsedState.breakStartTime) / 1000
            );
            const remaining = Math.max(
              0,
              (parsedState.breakDuration || 300) - elapsed
            );
            setBreakTimeRemaining(remaining);
            setBreakStartTime(parsedState.breakStartTime);
          } else {
            setBreakTimeRemaining(parsedState.breakDuration || 300);
            setBreakStartTime(parsedState.breakStartTime);
          }
        }

        console.log("Timer state synchronized with localStorage");
      } catch (error) {
        console.error("Failed to parse timer state from localStorage:", error);
      }
    }
  };

  return {
    timeRemaining,
    isRunning,
    handleStartPause: toggleTimer, // Use unified toggle but keep same prop name
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
    handleBreakTimerStartPause: toggleTimer, // Use unified toggle but keep same prop name
    handleBreakTimerReset,
    handleBreakTimerAdjust,
    // Sidebar timer props
    showInSidebar,
    handleCancelSidebarTimer,
    handleHideSidebarTimer,
    // Also expose the unified function
    toggleTimer,
    // Sync function for components that need to force refresh
    synchronizeTimerState,
  };
};
