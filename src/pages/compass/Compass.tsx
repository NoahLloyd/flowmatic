import React, { useState, useEffect, useRef } from "react";
import TimerDisplay from "./TimerDisplay";
import SessionForm from "./SessionForm";
import SessionCard from "../../components/session/SessionCard";
import { Session } from "../../types/Session";
import SessionsOverview from "../../components/session/SessionsOverview";
import SessionStats from "../../components/session/SessionStats";
import Signals from "./signal/Signals";
import TimerCompleteModal from "../../components/session/TimerCompleteModal";
import { api } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import { AVAILABLE_SIGNALS } from "../settings/components/SignalSettings";
import { Task } from "../../types/Task";
import DailyTasks from "./DailyTasks";

// Define the session form data interface
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

// Define the stats interface
interface SessionStats {
  todayHours: number;
  weekHours: number;
  averageFocus: number;
}

interface CompassProps {
  time: number;
  isRunning: boolean;
  onStartPause: () => void;
  onReset: () => void;
  onAdjustTime: (amount: number) => void;
  onStartBreak?: (breakMinutes: number) => void;
  onRestartTimer?: () => void;
  isModalOpen?: boolean;
  onCloseModal?: () => void;
  // Break timer props
  breakTimeRemaining?: number;
  breakIsRunning?: boolean;
  isBreakMode?: boolean;
  onBreakTimerStartPause?: () => void;
  onBreakTimerReset?: () => void;
  onBreakTimerAdjust?: (amount: number) => void;
  sessions: Session[];
  isLoadingSessions: boolean;
  onSessionCreated: () => Promise<void>;
  onSessionsUpdate: () => Promise<void>;
}

const Compass: React.FC<CompassProps> = ({
  time,
  isRunning,
  onStartPause,
  onReset,
  onAdjustTime,
  onStartBreak = () => {},
  onRestartTimer = () => {},
  isModalOpen = false,
  onCloseModal = () => {},
  // Break timer props
  breakTimeRemaining = 0,
  breakIsRunning = false,
  isBreakMode = false,
  onBreakTimerStartPause = () => {},
  onBreakTimerReset = () => {},
  onBreakTimerAdjust = () => {},
  sessions,
  isLoadingSessions,
  onSessionCreated,
  onSessionsUpdate,
}) => {
  const [submittingSession, setSubmittingSession] = useState(false);
  const [stats, setStats] = useState<SessionStats>({
    todayHours: 0,
    weekHours: 0,
    averageFocus: 0,
  });
  const { user } = useAuth();

  // Refs for keyboard shortcuts
  const signalsRef = useRef<HTMLDivElement>(null);
  const [selectedSignalIndex, setSelectedSignalIndex] = useState<number | null>(
    null
  );
  const [awaitingScaleValue, setAwaitingScaleValue] = useState(false);

  // Function to get today's focus goal from user preferences
  const getDailyGoal = () => {
    // Get current day
    const day = new Date().getDay();
    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const dayName = dayNames[day];

    // Check if user has preferences set
    if (
      user?.preferences?.dailyHoursGoals &&
      dayName in user.preferences.dailyHoursGoals
    ) {
      return user.preferences.dailyHoursGoals[dayName];
    }
    return 4; // Default if not set
  };

  // Get the user's daily focus goal
  const dailyGoal = getDailyGoal();

  // Create a function to handle focus rating submission from the modal
  const handleSubmitFocusRating = async (sessionData: SessionFormData) => {
    setSubmittingSession(true);
    try {
      // The sessionData now contains all form fields, so we use it directly
      await api.submitSession(sessionData);

      // Refresh sessions
      await onSessionCreated();
    } catch (error) {
      console.error("Error submitting session:", error);
    } finally {
      setSubmittingSession(false);
    }
  };

  // Function to handle stats updates
  const handleStatsCalculated = (newStats: SessionStats) => {
    setStats(newStats);
  };

  // Effect to add visual highlight to selected signal
  useEffect(() => {
    if (selectedSignalIndex === null) return;

    // Find all signal cards - use a more specific selector that only gets the signal cards themselves
    const signalCardContainer = signalsRef.current?.querySelector(".grid");
    const signalCards = signalCardContainer?.children;
    if (!signalCards || signalCards.length === 0) return;

    // Reset all outlines first
    Array.from(signalCards).forEach((card) => {
      (card as HTMLElement).style.boxShadow = "none";
    });

    // Add outline to selected signal if it exists
    if (signalCards[selectedSignalIndex]) {
      const selectedCard = signalCards[selectedSignalIndex] as HTMLElement;
      selectedCard.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.5)";
    }

    return () => {
      // Clean up by removing outlines when unmounting
      Array.from(signalCards).forEach((card) => {
        (card as HTMLElement).style.boxShadow = "none";
      });
    };
  }, [selectedSignalIndex]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Special case for Escape key
      if (e.key === "Escape") {
        if (isModalOpen) {
          // Close the modal if it's open
          onCloseModal();
          e.stopImmediatePropagation();
          return;
        }

        // Otherwise handle normal Escape functionality
        e.preventDefault();
        // Force reset of everything
        setSelectedSignalIndex(null);
        setAwaitingScaleValue(false);

        // Reset any outlines and focused elements
        const signalCardContainer = signalsRef.current?.querySelector(".grid");
        const signalCards = signalCardContainer?.children;
        if (signalCards && signalCards.length > 0) {
          Array.from(signalCards).forEach((card) => {
            (card as HTMLElement).style.boxShadow = "none";

            // Force blur any inputs to exit edit mode
            const inputs = card.querySelectorAll("input");
            inputs.forEach((input) => input.blur());
          });
        }

        // If there's any active editing element, try to blur it
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }

        return;
      }

      // Skip all other keyboard shortcuts if the session completion modal is open
      if (isModalOpen) {
        // We need to stop immediate propagation to prevent other event listeners from receiving this event
        // This is stronger than just stopPropagation and will block all other listeners
        e.stopImmediatePropagation();
        return;
      }

      // Ignore key events when typing in input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Space key to start/pause timer
      if (e.code === "Space") {
        e.preventDefault();
        onStartPause();
        return;
      }

      // 'r' key to open record session modal
      if ((e.key === "r" || e.key === "R") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (isRunning) {
          onStartPause(); // Pause the timer if it's running
        }
        // Directly set isModalOpen to true by calling onCloseModal
        // We need to ensure we're not toggling an already open modal
        if (!isModalOpen) {
          onCloseModal();
        }
        return;
      }

      // Timer adjustment keys
      if (e.key === "+") {
        e.preventDefault();
        onAdjustTime(60); // Add 1 minute
        return;
      }
      if (e.key === "-") {
        e.preventDefault();
        onAdjustTime(-60); // Subtract 1 minute
        return;
      }
      if (e.key === "_") {
        e.preventDefault();
        onAdjustTime(-60 * 10); // Subtract 10 minutes
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        onAdjustTime(60 * 10); // Add 10 minutes
        return;
      }

      // Signal selection and interaction with number keys
      const keyNum = parseInt(e.key);
      if (!isNaN(keyNum) && keyNum >= 0 && keyNum <= 9) {
        e.preventDefault();

        // Signal index - numpad keys directly map to indices (subtract 1)
        // Key 1 = index 0, Key 2 = index 1, etc.
        // Key 0 = index 9 (10th element)
        const index = keyNum === 0 ? 9 : keyNum - 1;

        // Get all actual signal cards using direct children of the grid
        const signalCardContainer = signalsRef.current?.querySelector(".grid");
        const signalCards = signalCardContainer?.children;

        if (!signalCards || signalCards.length === 0) {
          return;
        }

        // Get the active signals
        const activeSignals = user?.preferences?.activeSignals || [];

        // First, check if we're already in an interaction mode with a selected signal
        if (selectedSignalIndex !== null) {
          const selectedSignalKey = activeSignals[selectedSignalIndex];
          const selectedSignalConfig =
            AVAILABLE_SIGNALS[
              selectedSignalKey as keyof typeof AVAILABLE_SIGNALS
            ];

          // Handle water signal special case
          if (selectedSignalConfig?.type === "water") {
            const waterCard = signalCards[selectedSignalIndex] as HTMLElement;

            // If key is 1, click the first (+350ml) button
            if (keyNum === 1) {
              const addSmallButton = waterCard.querySelectorAll("button")[0];
              if (addSmallButton) {
                addSmallButton.click();
                setSelectedSignalIndex(null);
                return;
              }
            }
            // If key is 2, click the second (+1.1L) button
            else if (keyNum === 2) {
              const addLargeButton = waterCard.querySelectorAll("button")[1];
              if (addLargeButton) {
                addLargeButton.click();
                setSelectedSignalIndex(null);
                return;
              }
            }
            // If key is 3, activate the edit mode directly
            else if (keyNum === 3) {
              // Find the actual div that triggers editing and click it
              const editContainer = waterCard.querySelector(".flex-1");
              if (editContainer) {
                editContainer.dispatchEvent(
                  new MouseEvent("click", { bubbles: true })
                );

                // Give time for the input to appear, then focus it
                setTimeout(() => {
                  const input = waterCard.querySelector("input");
                  if (input) {
                    input.focus();
                  }
                }, 50);
                return;
              }
            }

            setSelectedSignalIndex(null);
            return;
          }

          // Handle scale signal case
          else if (
            selectedSignalConfig?.type === "scale" &&
            keyNum >= 1 &&
            keyNum <= 5
          ) {
            const scaleButtons =
              signalCards[selectedSignalIndex].querySelectorAll("button");
            if (scaleButtons.length >= keyNum) {
              // Adjusting index because scale buttons are 1-5
              const targetButtonIndex = keyNum - 1;
              scaleButtons[targetButtonIndex].click();
            }

            setSelectedSignalIndex(null);
            setAwaitingScaleValue(false);
            return;
          }

          // For all other cases, reset selection
          setSelectedSignalIndex(null);
          setAwaitingScaleValue(false);
          return;
        }

        // No signal selected yet - get signal info to handle it
        if (index < activeSignals.length && index < signalCards.length) {
          const signalKey = activeSignals[index];
          const signalConfig =
            AVAILABLE_SIGNALS[signalKey as keyof typeof AVAILABLE_SIGNALS];
          const targetSignalCard = signalCards[index] as HTMLElement;

          // Handle different signal types
          if (signalConfig?.type === "binary") {
            // For binary signals, toggle immediately without setting selection
            const toggleButton = targetSignalCard.querySelector("button");
            if (toggleButton) {
              toggleButton.click();
              // No need to select or outline binary signals
            } else {
              // Try clicking the card itself
              targetSignalCard.dispatchEvent(
                new MouseEvent("click", { bubbles: true })
              );
            }
            // Don't set selectedSignalIndex for binary types
            return;
          }

          // For non-binary signals, set selection and proceed
          setSelectedSignalIndex(index);

          // Apply visual highlight for non-binary signals
          targetSignalCard.style.boxShadow =
            "0 0 0 3px rgba(99, 102, 241, 0.5)";

          if (signalConfig?.type === "scale") {
            // For scale, wait for next input (1-5)
            setAwaitingScaleValue(true);
          } else if (signalConfig?.type === "water") {
            // For water, show highlight to indicate options (1=350ml, 2=1.1L, 3=edit)
            // Keep selected for subsequent input
          } else if (signalConfig?.type === "number") {
            // For number, activate edit mode immediately

            // Find either the actual input or the clickable div
            const existingInput = targetSignalCard.querySelector("input");
            if (existingInput) {
              // Input is already visible, focus it
              existingInput.focus();
            } else {
              // Need to click to reveal the input field
              const clickableDiv = targetSignalCard.querySelector(
                "div[class*='cursor-pointer']"
              );
              if (clickableDiv) {
                clickableDiv.dispatchEvent(
                  new MouseEvent("click", { bubbles: true })
                );

                // Focus the input after a short delay to ensure it's rendered
                setTimeout(() => {
                  const input = targetSignalCard.querySelector("input");
                  if (input) {
                    input.focus();
                  }
                }, 50);
              } else {
                // Last resort - try clicking the card itself
                targetSignalCard.dispatchEvent(
                  new MouseEvent("click", { bubbles: true })
                );

                setTimeout(() => {
                  const input = targetSignalCard.querySelector("input");
                  if (input) {
                    input.focus();
                  }
                }, 50);
              }
            }
          }
        }
      }
    };

    // Use the capture phase to ensure our handler runs before other handlers
    // The third parameter `true` enables capture phase handling
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    onStartPause,
    onAdjustTime,
    selectedSignalIndex,
    awaitingScaleValue,
    user?.preferences?.activeSignals,
    isModalOpen,
  ]);

  // Force refresh the timer every 3 seconds when it's running to prevent UI freezes
  useEffect(() => {
    if (isRunning) {
      const refreshInterval = setInterval(() => {
        // This is just a dummy state update to force re-render
        setStats((prevStats) => ({ ...prevStats }));
      }, 3000);

      return () => clearInterval(refreshInterval);
    }
  }, [isRunning]);

  return (
    <div className="p-6 space-y-6">
      <TimerCompleteModal
        isOpen={isModalOpen}
        onClose={onCloseModal}
        onSubmitSession={handleSubmitFocusRating}
        onStartBreak={onStartBreak}
        onRestartTimer={onRestartTimer}
        breakTimeRemaining={breakTimeRemaining}
        isBreakTimerRunning={breakIsRunning}
        onBreakTimerStartPause={onBreakTimerStartPause}
        onBreakTimerReset={onBreakTimerReset}
        onBreakTimerAdjust={onBreakTimerAdjust}
      />

      {/* Signals Section - Added ref for keyboard shortcuts */}
      <div ref={signalsRef}>
        <Signals />
      </div>

      {/* Timer and Sessions Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timer */}
        <div className="h-full">
          <TimerDisplay
            time={time}
            isRunning={isRunning}
            onStartPause={onStartPause}
            onReset={onReset}
            onAdjustTime={onAdjustTime}
            onOpenRecordModal={onCloseModal}
          />
        </div>

        {/* Sessions Overview */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden h-full">
            <div className="border-b border-gray-200 dark:border-gray-800 px-5 py-3 flex items-center">
              <h2 className="text-sm font-medium text-gray-900 dark:text-white">
                Sessions
              </h2>
            </div>
            <div className="p-5 bg-white dark:bg-gray-900 h-[calc(100%-48px)]">
              <SessionsOverview
                sessions={sessions}
                isLoading={isLoadingSessions}
                onSessionsUpdate={onSessionsUpdate}
                onStatsCalculated={handleStatsCalculated}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom section: Stats and Daily Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <SessionStats sessions={sessions} />
        </div>
        <div className="lg:col-span-2">
          <DailyTasks />
        </div>
      </div>
    </div>
  );
};

export default Compass;
