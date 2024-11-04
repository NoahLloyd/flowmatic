import { useState, useEffect } from "react";

interface TimerState {
  duration: number;
  startTime: number | null;
  isRunning: boolean;
}

export const useTimer = () => {
  const [duration, setDuration] = useState(3600);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(3600);
  const [intervalId, setIntervalId] = useState<ReturnType<
    typeof setInterval
  > | null>(null);

  useEffect(() => {
    const storedState = localStorage.getItem("timerState");
    if (storedState) {
      const parsedState = JSON.parse(storedState) as TimerState;
      setDuration(parsedState.duration);
      setStartTime(parsedState.startTime);
      setIsRunning(parsedState.isRunning);

      if (parsedState.startTime && parsedState.isRunning) {
        const elapsed = Math.floor((Date.now() - parsedState.startTime) / 1000);
        const remaining = Math.max(0, parsedState.duration - elapsed);
        setTimeRemaining(remaining);
      } else {
        setTimeRemaining(parsedState.duration);
      }
    }

    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }

    if (isRunning && startTime) {
      const id = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, duration - elapsed);
        setTimeRemaining(remaining);

        const timerState: TimerState = {
          duration,
          startTime,
          isRunning: true,
        };
        localStorage.setItem("timerState", JSON.stringify(timerState));
        const minutesLeft = " " + Math.ceil(remaining / 60).toString() + "m";

        window.electron.send("update-tray", minutesLeft);

        if (remaining <= 0) {
          handleReset();
          showNotification();
          window.electron.send("show-window");
          const totalTimePassed = Math.ceil(duration / 60).toString() + "m";
          window.electron.send("update-tray", " " + totalTimePassed + " done!");
        }
      }, 1000);

      setIntervalId(id);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isRunning, startTime, duration]);

  const handleStartPause = () => {
    setIsRunning((prevIsRunning) => {
      const newIsRunning = !prevIsRunning;
      if (newIsRunning) {
        setStartTime((prevStartTime) => {
          const newStartTime = prevStartTime || Date.now();
          const timerState: TimerState = {
            duration,
            startTime: newStartTime,
            isRunning: true,
          };
          localStorage.setItem("timerState", JSON.stringify(timerState));
          return newStartTime;
        });
      } else {
        setDuration(timeRemaining);
        setStartTime(null);
        const timerState: TimerState = {
          duration: timeRemaining,
          startTime: null,
          isRunning: false,
        };
        localStorage.setItem("timerState", JSON.stringify(timerState));
        const trayString = ` Paused ${Math.ceil(
          timeRemaining / 60
        ).toString()}m`;
        window.electron.send("update-tray", trayString);
      }
      return newIsRunning;
    });
  };

  const handleAdjustTime = (amount: number) => {
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
      };
      localStorage.setItem("timerState", JSON.stringify(timerState));
    }
  };

  const handleReset = () => {
    setDuration(3600);
    setTimeRemaining(3600);
    setStartTime(null);
    setIsRunning(false);
    localStorage.removeItem("timerState");
  };

  const showNotification = () => {
    if (Notification.permission === "granted") {
      new Notification("Timer Alert", {
        body: "The timer has reached zero!",
      });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new Notification("Timer Alert", {
            body: "The timer has reached zero!",
          });
        }
      });
    }
  };

  return {
    timeRemaining,
    isRunning,
    handleStartPause,
    handleAdjustTime,
    handleReset,
  };
};
