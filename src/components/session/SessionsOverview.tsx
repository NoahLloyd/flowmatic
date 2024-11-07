import React, { useState, useEffect } from "react";
import SessionCard from "./SessionCard";
import SessionEditModal from "./SessionEditModal";
import { Session } from "../../types/Session";
import { api } from "../../utils/api";

interface SessionStats {
  todayHours: number;
  weekHours: number;
  averageFocus: number;
}

interface SessionsOverviewProps {
  sessions?: Session[];
  isLoading?: boolean;
  onSessionsUpdate?: () => Promise<void>;
  userId?: string;
  onStatsCalculated?: (stats: SessionStats) => void;
  deleteItems?: boolean;
}

const SessionsOverview: React.FC<SessionsOverviewProps> = ({
  sessions: propSessions,
  isLoading: propIsLoading,
  onSessionsUpdate,
  userId,
  onStatsCalculated,
  deleteItems = true,
}) => {
  const [localSessions, setLocalSessions] = useState<Session[]>([]);
  const [isLocalLoading, setIsLocalLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  const sessions = propSessions || localSessions;
  const isLoading = propIsLoading ?? isLocalLoading;

  useEffect(() => {
    if (!propSessions && userId) {
      fetchSessions();
    }
  }, [userId, propSessions]);

  useEffect(() => {
    if (sessions.length > 0 && onStatsCalculated) {
      const stats = calculateStats(sessions);
      onStatsCalculated(stats);
    }
  }, [sessions, onStatsCalculated]);

  const calculateStats = (sessions: Session[]): SessionStats => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());

    const todaySessions = sessions.filter(
      (session) =>
        new Date(session.created_at).toDateString() === today.toDateString()
    );

    const weekSessions = sessions.filter(
      (session) =>
        new Date(session.created_at) >= weekStart &&
        new Date(session.created_at) <= today
    );

    const todayHours = todaySessions.reduce(
      (sum, session) => sum + (session.minutes || 0) / 60,
      0
    );

    const weekHours = weekSessions.reduce(
      (sum, session) => sum + (session.minutes || 0) / 60,
      0
    );

    const averageFocus = weekSessions.length
      ? weekSessions.reduce((sum, session) => sum + (session.focus || 0), 0) /
        weekSessions.length
      : 0;

    return {
      todayHours: Number(todayHours.toFixed(1)),
      weekHours: Number(weekHours.toFixed(1)),
      averageFocus: Number(averageFocus.toFixed(1)),
    };
  };

  const fetchSessions = async () => {
    if (!userId) return;
    setIsLocalLoading(true);
    try {
      const fetchedSessions = await api.getUserSessions(userId);
      setLocalSessions(fetchedSessions);
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    } finally {
      setIsLocalLoading(false);
    }
  };

  const todaySessions = sessions.filter((session) => {
    const sessionDate = new Date(session.created_at);
    const today = new Date();
    return sessionDate.toDateString() === today.toDateString();
  });

  const handleSessionClick = (session: Session) => {
    setSelectedSession(session);
  };

  const handleSaveSession = async (updatedSession: Session) => {
    try {
      await api.updateSession(updatedSession._id, updatedSession);
      if (onSessionsUpdate) {
        await onSessionsUpdate();
      } else {
        await fetchSessions();
      }
    } catch (error) {
      console.error("Failed to update session:", error);
    }
  };

  const handleDeleteSession = async () => {
    if (!selectedSession) return;
    try {
      await api.deleteSession(selectedSession._id);
      if (onSessionsUpdate) {
        await onSessionsUpdate();
      } else {
        await fetchSessions();
      }
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {isLoading ? (
        <p>Loading sessions...</p>
      ) : (
        <div>
          <div className="grid gap-3 grid-cols-1 w-full">
            {todaySessions.map((session) => (
              <div
                key={session.created_at}
                onClick={
                  deleteItems ? () => handleSessionClick(session) : undefined
                }
                className={deleteItems ? "cursor-pointer w-full" : "w-full"}
              >
                <SessionCard session={session} />
              </div>
            ))}
          </div>
          {todaySessions.length === 0 && (
            <div className="text-center py-4 text-gray-500">
              No sessions recorded today.
            </div>
          )}
        </div>
      )}

      {selectedSession && (
        <SessionEditModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          onSave={handleSaveSession}
          onDelete={handleDeleteSession}
        />
      )}
    </div>
  );
};

export default SessionsOverview;
