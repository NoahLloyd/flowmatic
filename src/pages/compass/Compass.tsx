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
