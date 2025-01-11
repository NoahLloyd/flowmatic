import { useState, useEffect } from "react";

export const useMorningTimer = () => {
  const [timeRemaining, setTimeRemaining] = useState(15);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isTimerComplete, setIsTimerComplete] = useState(false);

  useEffect(() => {
    const loadTimerState = () => {
      const timerState = localStorage.getItem("MorningTimer");
      if (timerState) {
        const { startTime, pausedTimeRemaining, isRunning, isComplete } =
          JSON.parse(timerState);
        if (isRunning) {
          const elapsedMinutes = (Date.now() - startTime) / (1000 * 60);
          const remainingMinutes = Math.max(0, 15 - elapsedMinutes);
          setTimeRemaining(remainingMinutes);
          setIsTimerRunning(true);
          if (remainingMinutes <= 0) {
            setIsTimerComplete(true);
            setIsTimerRunning(false);
          }
        } else {
          setTimeRemaining(pausedTimeRemaining);
          setIsTimerComplete(isComplete);
        }
      }
    };

    loadTimerState();
    let interval: NodeJS.Timeout;

    if (isTimerRunning) {
      const startTime = Date.now() - (15 - timeRemaining) * 60 * 1000;
      localStorage.setItem(
        "MorningTimer",
        JSON.stringify({
          startTime,
          isRunning: true,
          isComplete: false,
          pausedTimeRemaining: timeRemaining,
        })
      );

      interval = setInterval(() => {
        const elapsedMinutes = (Date.now() - startTime) / (1000 * 60);
        const remaining = Math.max(0, 15 - elapsedMinutes);

        if (remaining <= 0) {
          setIsTimerComplete(true);
          setIsTimerRunning(false);
          localStorage.setItem(
            "MorningTimer",
            JSON.stringify({
              startTime: null,
              isRunning: false,
              isComplete: true,
              pausedTimeRemaining: 0,
            })
          );
        }

        setTimeRemaining(remaining);
      }, 1000);
    } else {
      localStorage.setItem(
        "MorningTimer",
        JSON.stringify({
          startTime: null,
          isRunning: false,
          isComplete: isTimerComplete,
          pausedTimeRemaining: timeRemaining,
        })
      );
    }

    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const handleTimerToggle = () => {
    setIsTimerRunning(!isTimerRunning);
  };

  const handleTimerReset = () => {
    setTimeRemaining(15);
    setIsTimerRunning(false);
    setIsTimerComplete(false);
    localStorage.setItem(
      "MorningTimer",
      JSON.stringify({
        startTime: null,
        isRunning: false,
        isComplete: false,
        pausedTimeRemaining: 15,
      })
    );
  };

  return {
    timeRemaining,
    isTimerRunning,
    isTimerComplete,
    handleTimerToggle,
    handleTimerReset,
  };
};
