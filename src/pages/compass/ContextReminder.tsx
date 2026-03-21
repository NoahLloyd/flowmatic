import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSignals } from "../../context/SignalsContext";
import { api } from "../../utils/api";
import { startOfDay } from "date-fns";

interface ContextReminderProps {
  isRunning: boolean;
}

interface Reminder {
  id: string;
  lines: string[];
}

const getTodayKey = () => startOfDay(new Date()).toISOString().slice(0, 10);

const ContextReminder: React.FC<ContextReminderProps> = ({ isRunning }) => {
  const { signals } = useSignals();
  const [reminder, setReminder] = useState<Reminder | null>(null);
  const prevIsRunning = useRef(isRunning);
  const checkedFirstSession = useRef(false);

  const dismiss = useCallback(() => setReminder(null), []);

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (!reminder) return;
    const timer = setTimeout(dismiss, 8000);
    return () => clearTimeout(timer);
  }, [reminder, dismiss]);

  // Click anywhere to dismiss
  useEffect(() => {
    if (!reminder) return;
    const handler = () => dismiss();
    window.addEventListener("click", handler, { once: true });
    return () => window.removeEventListener("click", handler);
  }, [reminder, dismiss]);

  // Detect start/pause transitions
  useEffect(() => {
    const wasRunning = prevIsRunning.current;
    prevIsRunning.current = isRunning;

    const justStarted = isRunning && !wasRunning;
    const justPaused = !isRunning && wasRunning;

    if (justStarted) {
      handleSessionStart();
    }
    if (justPaused) {
      handleSessionPause();
    }
  }, [isRunning]);

  const handleSessionStart = async () => {
    const now = new Date();
    const hour = now.getHours();
    const todayKey = getTodayKey();

    // Check 1: Morning reminder (before 11am, first session of day)
    if (hour < 11 && !checkedFirstSession.current) {
      checkedFirstSession.current = true;

      try {
        const dayStart = startOfDay(now).toISOString();
        const dayEnd = now.toISOString();
        const todaySessions = await api.getSessionsByDateRange(dayStart, dayEnd);

        if (todaySessions.length === 0) {
          setReminder({
            id: "morning-" + Date.now(),
            lines: [
              "Remember to have:",
              "Lumie turned on",
              "Protein shake and breakfast",
              "Full water bottle",
            ],
          });
          return;
        }
      } catch {
        // If we can't check sessions, skip this reminder
      }
    }

    // Check 2: Blue blockers (after 7pm, once per day)
    if (hour >= 19) {
      const blueBlockerKey = `blueBlockerShown_${todayKey}`;
      if (!localStorage.getItem(blueBlockerKey)) {
        localStorage.setItem(blueBlockerKey, "true");
        setReminder({
          id: "blueblocker-" + Date.now(),
          lines: ["Blue blockers on"],
        });
        return;
      }
    }
  };

  const handleSessionPause = () => {
    const hour = new Date().getHours();

    // Check 3: Lunch reminder (11am-1pm, Lunch signal is off)
    if (hour >= 11 && hour < 13) {
      const lunchValue = signals["lunch"];
      if (!lunchValue || lunchValue === false || lunchValue === 0) {
        setReminder({
          id: "lunch-" + Date.now(),
          lines: ["Time for lunch?"],
        });
      }
    }
  };

  return (
    <AnimatePresence>
      {reminder && (
        <motion.div
          key={reminder.id}
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
        >
          <div className="pointer-events-auto bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-5 py-3.5 max-w-sm">
            {reminder.lines.length === 1 ? (
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {reminder.lines[0]}
              </p>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1.5">
                  {reminder.lines[0]}
                </p>
                <ul className="space-y-0.5">
                  {reminder.lines.slice(1).map((line, i) => (
                    <li
                      key={i}
                      className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1.5"
                    >
                      <span className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500 shrink-0" />
                      {line}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ContextReminder;
