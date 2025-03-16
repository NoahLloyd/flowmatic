import React, { useEffect, useMemo, useState } from "react";
import { Pause, Play, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/AuthContext";

interface TimerDisplayProps {
  time: number;
  isRunning: boolean;
  onStartPause: () => void;
  onReset: () => void;
  onAdjustTime: (amount: number) => void;
}

const WaveComponent = ({
  opacity,
  scale,
  color,
  xOffset,
  yOffset,
}: {
  offset: number;
  opacity: number;
  scale: number;
  color: string;
  xOffset: number;
  yOffset: number;
}) => (
  <motion.path
    d="M-100 0 C 200 50, 400 -50, 500 0 C 600 50, 800 -50, 900 0 L 900 400 L -100 400 Z"
    fill={color}
    opacity={opacity}
    initial={{ y: yOffset }}
    animate={{
      y: [yOffset, yOffset - 10, yOffset],
      x: [xOffset, xOffset + 5, xOffset],
      scale: scale,
    }}
    transition={{
      repeat: Infinity,
      duration: 4 + Math.random(),
      ease: "easeInOut",
    }}
  />
);

const Particle = ({ index }: { index: number }) => {
  const randomX = Math.random() * 100;
  const randomDelay = Math.random() * 2;

  return (
    <motion.circle
      cx={randomX}
      cy="100"
      r="1"
      fill="rgba(255, 255, 255, 0.3)"
      initial={{ y: 0 }}
      animate={{
        y: [-10, -20, -10],
        opacity: [0.1, 0.3, 0.1],
      }}
      transition={{
        repeat: Infinity,
        duration: 3 + Math.random() * 2,
        delay: randomDelay,
      }}
    />
  );
};

const TimerDisplay: React.FC<TimerDisplayProps> = ({
  time,
  isRunning,
  onStartPause,
  onReset,
  onAdjustTime,
}) => {
  const { user } = useAuth();
  // Always assume the initial time is 60 minutes (3600 seconds) for wave positioning
  const standardInitialTime = 3600;
  const [initialTime, setInitialTime] = useState(time);

  // Get colors from user preferences, fallback to defaults
  const fromColor = user?.preferences?.fromColor || "#E8CBC0";
  const toColor = user?.preferences?.toColor || "#636FA4";

  useEffect(() => {
    if (!isRunning) {
      setInitialTime(time);
    }
  }, [isRunning, time]);

  // Calculate progress based on standard 60 minute session
  const progressPercentage = useMemo(() => {
    // Calculate how much time has passed from the standard 60 minutes
    const timeElapsed = standardInitialTime - time;
    return (timeElapsed / standardInitialTime) * 100;
  }, [time]);

  const minutes = Math.floor(time / 60);
  const seconds = time % 60;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden h-full">
      <div className="border-b border-gray-200 dark:border-gray-800 px-5 py-3 flex items-center">
        <h2 className="text-sm font-medium text-gray-900 dark:text-white">
          Timer
        </h2>
      </div>
      <div className="relative flex flex-col w-full items-center justify-center overflow-hidden bg-white dark:bg-gray-900 h-[calc(100%-48px)]">
        <div className="absolute inset-0 overflow-hidden">
          <svg
            viewBox="0 0 800 400"
            className="w-full h-full absolute bottom-0"
            preserveAspectRatio="none"
          >
            <motion.g
              style={{
                y: `${Math.min(
                  Math.max(0, 120 - progressPercentage * 1.2),
                  120
                )}%`,
              }}
              transition={{ type: "spring", damping: 30 }}
            >
              {[...Array(4)].map((_, i) => (
                <WaveComponent
                  key={i}
                  offset={i}
                  yOffset={i * 15}
                  xOffset={i * 30}
                  opacity={0.3 - i * 0.01}
                  scale={1 + i * 0.02}
                  color={i % 2 === 0 ? fromColor : toColor}
                />
              ))}
              {[...Array(20)].map((_, i) => (
                <Particle key={i} index={i} />
              ))}
            </motion.g>
          </svg>
        </div>

        <div className="relative z-10 p-5 flex flex-col items-center justify-center">
          <motion.div
            className="text-5xl font-bold mb-8 text-center text-gray-900 dark:text-white"
            animate={{ scale: isRunning ? [1, 1.02, 1] : 1 }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            {minutes}:{seconds < 10 ? "0" : ""}
            {seconds}
          </motion.div>

          <div className="flex space-x-2 mb-6">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-md transition-colors text-sm text-gray-700 dark:text-gray-300"
              onClick={() => onAdjustTime(-600)}
            >
              -10m
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-md transition-colors text-sm text-gray-700 dark:text-gray-300"
              onClick={() => onAdjustTime(-60)}
            >
              -1m
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-md transition-colors text-sm text-gray-700 dark:text-gray-300"
              onClick={() => onAdjustTime(60)}
            >
              +1m
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-md transition-colors text-sm text-gray-700 dark:text-gray-300"
              onClick={() => onAdjustTime(600)}
            >
              +10m
            </motion.button>
          </div>

          <div className="flex space-x-4 justify-center">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className={`p-3 rounded-full transition-colors ${
                isRunning
                  ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800"
                  : "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800"
              }`}
              onClick={onStartPause}
            >
              <AnimatePresence mode="wait">
                {isRunning ? <Pause size={24} /> : <Play size={24} />}
              </AnimatePresence>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full transition-colors"
              onClick={onReset}
            >
              <RefreshCw size={24} />
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimerDisplay;
