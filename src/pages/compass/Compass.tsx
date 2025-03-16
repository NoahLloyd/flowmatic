import React, { useState } from "react";
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

      {/* Signals Section */}
      <Signals />

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
          />
        </div>

        {/* Sessions Overview */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden h-full">
            <div className="border-b border-gray-200 dark:border-gray-800 px-5 py-3 flex items-center">
              <h2 className="text-sm font-medium text-gray-900 dark:text-white">
                Sessions Overview
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

      {/* Bottom section: Form and Stats */}
      <SessionForm onSessionCreated={onSessionCreated} />

      <SessionStats sessions={sessions} />
    </div>
  );
};

export default Compass;
