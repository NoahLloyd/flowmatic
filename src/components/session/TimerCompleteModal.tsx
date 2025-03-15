import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Clock, Pause, Play, RefreshCw } from "lucide-react";
import { Session } from "../../types/Session";
import { useTasks } from "../../hooks/useTasks";
import { useAuth } from "../../context/AuthContext";

// Define the types for each step of the modal
type ModalStep = "focus" | "break" | "breakTimer" | "closed";

interface SessionFormData {
  _id: string;
  user_id: string;
  notes: string;
  task: string;
  project: string;
  minutes: number;
  focus: number;
  created_at: string;
}

interface TimerCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSession: (sessionData: SessionFormData) => Promise<void>;
  onStartBreak: (breakMinutes: number) => void;
  onRestartTimer: () => void;
  breakTimeRemaining?: number; // Current break time remaining
  isBreakTimerRunning?: boolean; // Whether break timer is running
  onBreakTimerStartPause?: () => void; // Use unified toggleTimer function for all timer actions
  onBreakTimerReset?: () => void; // Reset the break timer
  onBreakTimerAdjust?: (amount: number) => void; // Adjust break timer
}

// Define the break options
const breakOptions = [
  { minutes: 5, shortcut: "1", label: "Short Break" },
  { minutes: 15, shortcut: "2", label: "Medium Break" },
  { minutes: 30, shortcut: "3", label: "Long Break" },
];

const TimerCompleteModal: React.FC<TimerCompleteModalProps> = ({
  isOpen,
  onClose,
  onSubmitSession,
  onStartBreak,
  onRestartTimer,
  breakTimeRemaining = 0,
  isBreakTimerRunning = false,
  onBreakTimerStartPause = () => {},
  onBreakTimerReset = () => {},
  onBreakTimerAdjust = () => {},
}) => {
  const { tasks } = useTasks();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<ModalStep>("focus");
  const [customBreakTime, setCustomBreakTime] = useState<number>(5);

  // Create refs for form inputs
  const taskInputRef = useRef<HTMLSelectElement>(null);
  const notesInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const minutesInputRef = useRef<HTMLInputElement>(null);

  // Get default project from user preferences
  const defaultProject = user?.preferences?.defaultProject || "";

  // Form data state for session details
  const [formData, setFormData] = useState<SessionFormData>({
    _id: "",
    user_id: user?._id || "",
    notes: "",
    task: "",
    project: defaultProject,
    minutes: 60, // Default to 60 minutes for work sessions
    focus: 0,
    created_at: new Date().toISOString(),
  });

  // Reset form data when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        _id: "",
        user_id: user?._id || "",
        notes: "",
        task: "",
        project: defaultProject,
        minutes: 60,
        focus: 0,
        created_at: new Date().toISOString(),
      });
    }
  }, [isOpen, user, defaultProject]);

  // Handle break timer completion
  useEffect(() => {
    if (
      currentStep === "breakTimer" &&
      breakTimeRemaining <= 0 &&
      !isBreakTimerRunning
    ) {
      // Break timer has finished
      handleClose();
    }
  }, [breakTimeRemaining, isBreakTimerRunning, currentStep]);

  // Close the modal and reset state
  const handleClose = () => {
    setCurrentStep("closed");
    onClose();
  };

  // Handle form input changes
  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "minutes" ? Number(value) : value,
    }));
  };

  // Handle focus rating selection
  const handleFocusRating = async (rating: number) => {
    // Update the form data with the focus rating
    const updatedFormData = {
      ...formData,
      focus: rating,
    };

    // Submit the session with all the form data
    await onSubmitSession(updatedFormData);
    setCurrentStep("break");
  };

  // Handle break selection and start break timer
  const handleBreakSelection = (minutes: number) => {
    onStartBreak(minutes);
    setCurrentStep("breakTimer");
  };

  // Handle custom break time
  const handleCustomBreakChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      setCustomBreakTime(value);
    }
  };

  // Format time for display (MM:SS)
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Focus level definitions
  const focusLevels = [
    {
      rating: 1,
      label: "Distracted",
      color: "bg-red-600 dark:bg-red-800",
      shortcut: "1",
    },
    {
      rating: 2,
      label: "Browsing",
      color: "bg-orange-600 dark:bg-orange-800",
      shortcut: "2",
    },
    {
      rating: 3,
      label: "Attentive",
      color: "bg-yellow-600 dark:bg-yellow-800",
      shortcut: "3",
    },
    {
      rating: 4,
      label: "Locked-in",
      color: "bg-green-600 dark:bg-green-800",
      shortcut: "4",
    },
    {
      rating: 5,
      label: "Flow",
      color: "bg-indigo-600 dark:bg-indigo-800",
      shortcut: "5",
    },
  ];

  // Filter for active day tasks
  const dayTasks = tasks.filter(
    (task) => task.type === "day" && !task.completed
  );

  // Add keyboard event listener for shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Special case for Escape key - always handle it
      if (e.key === "Escape") {
        // If user is in an input, just blur it
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        ) {
          (e.target as HTMLElement).blur();
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        // Otherwise close the modal
        handleClose();
        return;
      }

      // Skip other keyboard shortcuts if user is typing in an input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        // Let user type normally in input fields
        return;
      }

      // Form field navigation shortcuts - only available in focus step
      if (currentStep === "focus") {
        // Handle the navigation shortcut keys with strong prevention
        if (["t", "n", "p", "m"].includes(e.key.toLowerCase())) {
          // Prevent global navigation and default behavior
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          // Focus on specific input fields
          switch (e.key.toLowerCase()) {
            case "t":
              taskInputRef.current?.focus();
              return;
            case "n":
              notesInputRef.current?.focus();
              return;
            case "p":
              projectInputRef.current?.focus();
              return;
            case "m":
              minutesInputRef.current?.focus();
              return;
          }
          return;
        }

        // Focus rating shortcuts
        if (/^[1-5]$/.test(e.key)) {
          // Focus rating shortcuts (1-5)
          const rating = parseInt(e.key);
          handleFocusRating(rating);
          return;
        }
      } else if (currentStep === "break") {
        if (/^[1-3]$/.test(e.key)) {
          // Break time shortcuts (1-3)
          const option = breakOptions[parseInt(e.key) - 1];
          handleBreakSelection(option.minutes);
        } else if (e.key === "4") {
          // Restart timer (shortcut 4)
          onRestartTimer();
          handleClose();
        } else if (e.key === "5") {
          // End session (shortcut 5)
          handleClose();
        }
      } else if (currentStep === "breakTimer") {
        if (e.key === " ") {
          // Space toggles break timer
          onBreakTimerStartPause();
        } else if (e.key === "ArrowUp") {
          // Arrow up increases break time
          onBreakTimerAdjust(60); // +1 min
        } else if (e.key === "ArrowDown") {
          // Arrow down decreases break time
          onBreakTimerAdjust(-60); // -1 min
        }
      }
    };

    // Use capture phase to ensure we get the events before global handlers
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    isOpen,
    currentStep,
    onBreakTimerStartPause,
    onBreakTimerReset,
    onBreakTimerAdjust,
    formData, // Add form data as dependency to handle the updated state
  ]);

  // Reset to first step when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep("focus");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay - allow clicking through */}
      <div className="absolute inset-0 bg-black/30 pointer-events-none" />

      {/* Modal container */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        <AnimatePresence mode="wait">
          {currentStep === "focus" && (
            <motion.div
              key="focus-step"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="p-6"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Session Details
                </h2>
                <button
                  onClick={handleClose}
                  className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* Session form fields - similar to SessionForm.tsx */}
              <div className="space-y-4 mb-6">
                <div className="flex gap-4">
                  <div className="flex-1 flex gap-4">
                    <select
                      ref={taskInputRef}
                      name="task"
                      value={formData.task}
                      onChange={handleInputChange}
                      className="w-1/2 p-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg focus:outline-none focus:border-slate-300 dark:focus:border-gray-500 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">Select a task</option>
                      {dayTasks.map((task) => (
                        <option key={task._id} value={task.title}>
                          {task.title}
                        </option>
                      ))}
                    </select>
                    <input
                      ref={notesInputRef}
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      placeholder="Notes"
                      className="w-1/2 p-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg focus:outline-none focus:border-slate-300 dark:focus:border-gray-500 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      ref={projectInputRef}
                      type="text"
                      name="project"
                      value={formData.project}
                      onChange={handleInputChange}
                      placeholder="Project"
                      className="w-20 p-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg focus:outline-none focus:border-slate-300 dark:focus:border-gray-500 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                    />
                    <input
                      ref={minutesInputRef}
                      type="number"
                      name="minutes"
                      value={formData.minutes}
                      onChange={handleInputChange}
                      placeholder="Min"
                      className="w-16 p-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg focus:outline-none focus:border-slate-300 dark:focus:border-gray-500 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                    />
                  </div>
                </div>
              </div>

              <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                <span className="inline-block mr-3">
                  <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono">
                    T
                  </kbd>{" "}
                  task
                </span>
                <span className="inline-block mr-3">
                  <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono">
                    N
                  </kbd>{" "}
                  notes
                </span>
                <span className="inline-block mr-3">
                  <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono">
                    P
                  </kbd>{" "}
                  project
                </span>
                <span className="inline-block mr-3">
                  <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono">
                    M
                  </kbd>{" "}
                  minutes
                </span>
                <span className="inline-block">
                  <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono">
                    Esc
                  </kbd>{" "}
                  exit inputs
                </span>
              </div>

              <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                Rate your session focus
              </h3>

              <div className="space-y-3">
                {focusLevels.map(({ rating, label, color, shortcut }) => (
                  <button
                    key={rating}
                    onClick={() => handleFocusRating(rating)}
                    className={`w-full flex items-center text-white rounded-lg p-3 hover:opacity-90 transition-opacity ${color}`}
                  >
                    <div className="flex items-center justify-center bg-black/10 rounded-md w-8 h-8 mr-3 font-bold">
                      {shortcut}
                    </div>
                    <span className="font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {currentStep === "break" && (
            <motion.div
              key="break-step"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="p-6"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Take a break?
                </h2>
                <button
                  onClick={handleClose}
                  className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              <div className="space-y-3 mb-4">
                {breakOptions.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleBreakSelection(option.minutes)}
                    className="w-full flex items-center bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded-lg p-3 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                  >
                    <div className="flex items-center justify-center bg-blue-200 dark:bg-blue-800 rounded-md w-8 h-8 mr-3 font-bold text-blue-700 dark:text-blue-200">
                      {option.shortcut}
                    </div>
                    <span className="font-medium">
                      {option.label} ({option.minutes}m)
                    </span>
                  </button>
                ))}

                <div className="flex items-center space-x-2 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <Clock className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  <input
                    type="number"
                    value={customBreakTime}
                    onChange={handleCustomBreakChange}
                    className="w-16 p-1 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-center"
                    min="1"
                  />
                  <span className="text-gray-600 dark:text-gray-300">
                    minutes
                  </span>
                  <button
                    onClick={() => handleBreakSelection(customBreakTime)}
                    className="ml-auto bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 p-2 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => {
                    onRestartTimer();
                    handleClose();
                  }}
                  className="w-full flex items-center bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 rounded-lg p-3 hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
                >
                  <div className="flex items-center justify-center bg-green-200 dark:bg-green-800 rounded-md w-8 h-8 mr-3 font-bold text-green-700 dark:text-green-200">
                    4
                  </div>
                  <span className="font-medium">Start new timer (60m)</span>
                </button>

                <button
                  onClick={handleClose}
                  className="w-full flex items-center bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg p-3 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="flex items-center justify-center bg-gray-200 dark:bg-gray-600 rounded-md w-8 h-8 mr-3 font-bold text-gray-700 dark:text-gray-200">
                    5
                  </div>
                  <span className="font-medium">Done for now</span>
                </button>
              </div>
            </motion.div>
          )}

          {currentStep === "breakTimer" && (
            <motion.div
              key="break-timer-step"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="p-6"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Break Timer
                </h2>
                <button
                  onClick={handleClose}
                  className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              <div className="flex flex-col items-center justify-center space-y-6">
                <div className="text-center">
                  <div className="text-teal-600 dark:text-teal-400 font-medium mb-2">
                    Time Remaining
                  </div>
                  <div className="text-5xl font-bold text-gray-900 dark:text-white">
                    {formatTime(breakTimeRemaining)}
                  </div>
                </div>

                <div className="flex space-x-4">
                  <button
                    onClick={() => onBreakTimerAdjust(-60)}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    -1m
                  </button>
                  <button
                    onClick={() => onBreakTimerAdjust(60)}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    +1m
                  </button>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={onBreakTimerStartPause}
                    className="flex items-center justify-center p-3 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800"
                  >
                    {isBreakTimerRunning ? (
                      <Pause className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      onBreakTimerReset();
                      handleClose();
                    }}
                    className="flex items-center justify-center p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg hover:bg-red-200 dark:hover:bg-red-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <button
                    onClick={onBreakTimerReset}
                    className="flex items-center justify-center p-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TimerCompleteModal;
