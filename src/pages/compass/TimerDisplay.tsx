import React, { useEffect, useMemo, useState } from "react";
import { Pause, Play, RefreshCw, Save } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

interface TimerDisplayProps {
  time: number;
  isRunning: boolean;
  onStartPause: () => void;
  onReset: () => void;
  onAdjustTime: (amount: number) => void;
  onOpenRecordModal?: () => void;
  isStopwatchMode?: boolean;
  onToggleStopwatchMode?: () => void;
  stopwatchAlertMinutes?: number;
}

const WaveComponent = ({
  opacity,
  scale,
  color,
  xOffset,
  yOffset,
  duration,
}: {
  offset: number;
  opacity: number;
  scale: number;
  color: string;
  xOffset: number;
  yOffset: number;
  duration: number;
}) => (
  <motion.path
    d="M-100 0 C 200 50, 400 -50, 500 0 C 600 50, 800 -50, 900 0 L 900 400 L -100 400 Z"
    fill={color}
    opacity={opacity}
    initial={{ y: yOffset, x: xOffset }}
    animate={{
      y: [yOffset, yOffset - 10],
      x: [xOffset, xOffset + 5],
      scale: scale,
    }}
    transition={{
      repeat: Infinity,
      repeatType: "mirror",
      duration: duration,
      ease: "easeInOut",
    }}
  />
);

const Particle = ({ index, randomX, randomDelay, duration }: { index: number; randomX: number; randomDelay: number; duration: number }) => {
  return (
    <motion.circle
      cx={randomX}
      cy="100"
      r="1"
      fill="rgba(255, 255, 255, 0.3)"
      initial={{ y: -10, opacity: 0.1 }}
      animate={{
        y: [-10, -20],
        opacity: [0.1, 0.3],
      }}
      transition={{
        repeat: Infinity,
        repeatType: "mirror",
        duration: duration,
        delay: randomDelay,
        ease: "easeInOut",
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
  onOpenRecordModal = () => {},
  isStopwatchMode = false,
  onToggleStopwatchMode = () => {},
  stopwatchAlertMinutes = 60,
}) => {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  // Always assume the initial time is 60 minutes (3600 seconds) for wave positioning
  const standardInitialTime = 3600;
  const [initialTime, setInitialTime] = useState(time);
  const [isSimpleMode, setIsSimpleMode] = useState(() => {
    const saved = localStorage.getItem('timerSimpleMode');
    return saved === 'true';
  });

  // Save simple mode preference to localStorage
  useEffect(() => {
    localStorage.setItem('timerSimpleMode', String(isSimpleMode));
  }, [isSimpleMode]);

  // Get theme-appropriate colors from user preferences, with fallbacks
  const defaultLightFromColor = "#E8CBC0";
  const defaultLightToColor = "#636FA4";
  const defaultDarkFromColor = "#1E293B";
  const defaultDarkToColor = "#0F172A";

  // Use the appropriate colors based on theme
  const baseFromColor = isDarkMode
    ? user?.preferences?.darkModeFromColor ||
      user?.preferences?.fromColor ||
      defaultDarkFromColor
    : user?.preferences?.lightModeFromColor ||
      user?.preferences?.fromColor ||
      defaultLightFromColor;

  const baseToColor = isDarkMode
    ? user?.preferences?.darkModeToColor ||
      user?.preferences?.toColor ||
      defaultDarkToColor
    : user?.preferences?.lightModeToColor ||
      user?.preferences?.toColor ||
      defaultLightToColor;

  // Check if stopwatch has exceeded the alert threshold
  const isOverAlertThreshold = isStopwatchMode && time >= stopwatchAlertMinutes * 60;

  // Override colors to red when over threshold
  const fromColor = isOverAlertThreshold ? (isDarkMode ? "#7F1D1D" : "#DC2626") : baseFromColor;
  const toColor = isOverAlertThreshold ? (isDarkMode ? "#991B1B" : "#EF4444") : baseToColor;

  useEffect(() => {
    if (!isRunning) {
      setInitialTime(time);
    }
  }, [isRunning, time]);

  // Calculate progress based on standard 60 minute session
  const progressPercentage = useMemo(() => {
    if (isStopwatchMode) {
      // Stopwatch: time represents elapsed seconds, fill up over 60 minutes
      return Math.min((time / standardInitialTime) * 100, 100);
    }
    // Countdown: calculate how much time has passed from the standard 60 minutes
    const timeElapsed = standardInitialTime - time;
    return (timeElapsed / standardInitialTime) * 100;
  }, [time, isStopwatchMode]);

  // Memoize random values for waves and particles to keep them stable across renders
  const waveDurations = useMemo(() => [0, 1, 2, 3].map(() => 4 + Math.random()), []);
  const particleData = useMemo(() => 
    [...Array(20)].map(() => ({
      randomX: Math.random() * 100,
      randomDelay: Math.random() * 2,
      duration: 3 + Math.random() * 2,
    })), 
  []);

  const minutes = Math.floor(time / 60);
  const seconds = time % 60;

  // Simple mode display: always show just the minutes number
  const simpleTimeDisplay = `${minutes}`;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden h-full">
      <div className="border-b border-gray-200 dark:border-gray-800 px-5 py-3.5 flex items-center">
        <h2
          className="text-sm font-medium text-gray-900 dark:text-white cursor-pointer"
          onClick={onToggleStopwatchMode}
        >
          {isStopwatchMode ? "Stopwatch" : "Timer"}
        </h2>
      </div>
      <div 
        className="relative flex flex-col w-full items-center justify-center overflow-hidden h-[calc(100%-48px)]"
      >
        <div className="absolute inset-0 overflow-hidden bg-white dark:bg-gray-900">
          {isSimpleMode ? (
            /* Simple mode: solid block with straight line that rises */
            <div
              className="absolute inset-x-0 w-full"
              style={{
                background: `linear-gradient(135deg, ${fromColor}, ${toColor})`,
                height: '200%',
                top: `${100 - progressPercentage}%`,
              }}
            />
          ) : (
            /* Normal mode: animated waves */
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
                    duration={waveDurations[i]}
                  />
                ))}
                {particleData.map((particle, i) => (
                  <Particle 
                    key={i} 
                    index={i} 
                    randomX={particle.randomX}
                    randomDelay={particle.randomDelay}
                    duration={particle.duration}
                  />
                ))}
              </motion.g>
            </svg>
          )}
        </div>

        <div className="relative z-10 p-5 flex flex-col items-center justify-center">
          <motion.div
            className="text-5xl font-bold mb-8 text-center text-gray-900 dark:text-white cursor-pointer select-none"
            animate={{ scale: isRunning ? [1, 1.02, 1] : 1 }}
            transition={{ repeat: Infinity, duration: 2 }}
            onClick={() => setIsSimpleMode(!isSimpleMode)}
          >
            {isSimpleMode ? simpleTimeDisplay : `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`}
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
              className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full transition-colors"
              onClick={onReset}
            >
              <RefreshCw size={24} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full transition-colors"
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
              onClick={() => {
                if (isRunning) {
                  onStartPause();
                }
                onOpenRecordModal();
              }}
              title="Record session"
            >
              <Save size={24} />
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimerDisplay;
