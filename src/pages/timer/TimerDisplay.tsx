import React, { useState, useEffect } from "react";
import { Pause, Play, RefreshCw } from "lucide-react";

interface TimerDisplayProps {
  initialTime: number;
}

const TimerDisplay: React.FC<TimerDisplayProps> = ({ initialTime }) => {
  const [time, setTime] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [intervalId, setIntervalId] = useState<ReturnType<
    typeof setInterval
  > | null>(null);

  useEffect(() => {
    const storedState = localStorage.getItem("timerState");
    if (storedState) {
      const {
        time: storedTime,
        isRunning: storedIsRunning,
        elapsedTime: storedElapsedTime,
      } = JSON.parse(storedState);
      setTime(storedTime);
      setIsRunning(storedIsRunning);
      setElapsedTime(storedElapsedTime);
    }

    if (isRunning) {
      const id = setInterval(() => {
        setTime((prevTime) => {
          const newTime = prevTime - 1;
          setElapsedTime((prevElapsedTime) => prevElapsedTime + 1);

          const timerState = {
            time: newTime,
            isRunning: true,
            elapsedTime: elapsedTime + 1,
          };
          localStorage.setItem("timerState", JSON.stringify(timerState));

          if (newTime <= 0) {
            handleReset();
            showNotification();
            window.electron.send("show-window");
          }

          return newTime;
        });
      }, 1000);

      setIntervalId(id);
    } else if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isRunning]);

  const handleStartPause = () => {
    setIsRunning((prevIsRunning) => {
      const newIsRunning = !prevIsRunning;
      const timerState = {
        time,
        isRunning: newIsRunning,
        elapsedTime,
      };
      localStorage.setItem("timerState", JSON.stringify(timerState));
      return newIsRunning;
    });
  };

  const handleReset = () => {
    setTime(initialTime);
    setElapsedTime(0);
    setIsRunning(false);
    localStorage.removeItem("timerState");
  };

  const handleAdjustTime = (amount: number) => {
    const newTime = Math.max(time + amount, 0);
    setTime(newTime);

    const timerState = {
      time: newTime,
      isRunning,
      elapsedTime,
    };
    localStorage.setItem("timerState", JSON.stringify(timerState));
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

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-white border text-black rounded-lg">
      <div className="text-4xl font-bold mb-4">
        {Math.floor(time / 60)}:{time % 60 < 10 ? "0" : ""}
        {time % 60}
      </div>
      <div className="flex space-x-4 mb-4">
        <button onClick={() => handleAdjustTime(-600)}>-10m</button>
        <button onClick={() => handleAdjustTime(-60)}>-1m</button>
        <button onClick={() => handleAdjustTime(60)}>+1m</button>
        <button onClick={() => handleAdjustTime(600)}>+10m</button>
      </div>
      <div className="flex space-x-4">
        <button onClick={handleStartPause}>
          {isRunning ? <Pause size={32} /> : <Play size={32} />}
        </button>
        <button onClick={handleReset}>
          <RefreshCw size={32} />
        </button>
      </div>
    </div>
  );
};

export default TimerDisplay;
