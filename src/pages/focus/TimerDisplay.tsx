import React, { useEffect, useMemo, useState } from "react";
import { Pause, Play, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
  const [initialTime, setInitialTime] = useState(time);
  const fromColor =
    localStorage.getItem("fromColor" as string).slice(1, -1) || "blue";
  const toColor =
    localStorage.getItem("fromColor" as string).slice(1, -1) || "blue";

  useEffect(() => {
    if (!isRunning) {
      setInitialTime(time);
    }
  }, [isRunning, time]);

  const progressPercentage = useMemo(() => {
    return ((initialTime - time) / initialTime) * 100;
  }, [time, initialTime]);

  const minutes = Math.floor(time / 60);
  const seconds = time % 60;

  return (
    <div className="relative mb-4 flex flex-col w-full items-center justify-center p-4 border text-black shadow rounded-lg overflow-hidden min-h-[300px]">
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

      <div className="relative z-10">
        <motion.div
          className="text-6xl font-bold mb-4 text-center"
          animate={{ scale: isRunning ? [1, 1.02, 1] : 1 }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          {minutes}:{seconds < 10 ? "0" : ""}
          {seconds}
        </motion.div>

        <div className="flex space-x-4 mb-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            onClick={() => onAdjustTime(-600)}
          >
            -10m
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            onClick={() => onAdjustTime(-60)}
          >
            -1m
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            onClick={() => onAdjustTime(60)}
          >
            +1m
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            onClick={() => onAdjustTime(600)}
          >
            +10m
          </motion.button>
        </div>

        <div className="flex space-x-4 justify-center">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="p-3 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
            onClick={onStartPause}
          >
            <AnimatePresence mode="wait">
              {isRunning ? (
                <Pause size={32} className="text-gray-800" />
              ) : (
                <Play size={32} className="text-gray-800" />
              )}
            </AnimatePresence>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="p-3 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
            onClick={onReset}
          >
            <RefreshCw size={32} className="text-gray-800" />
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default TimerDisplay;
