import React, { useState, useEffect, useRef, UIEvent } from "react";
import SessionCard from "./SessionCard";
import SessionEditModal from "./SessionEditModal";
import { Session } from "../../types/Session";
import { api } from "../../utils/api";
import { format } from "date-fns";
import { Calendar, Brain, Clock } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

interface SessionStats {
  todayHours: number;
  weekHours: number;
  averageFocus: number;
}

interface DayGroup {
  date: Date;
  sessions: Session[];
  totalMinutes: number;
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
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [groupedSessions, setGroupedSessions] = useState<DayGroup[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth(); // Move hook to component level

  const sessions = propSessions || localSessions;
  const isLoading = propIsLoading ?? isLocalLoading;
  const getFocusColor = (focus: number) => {
    if (focus < 2)
      return {
        bg: "bg-red-100 dark:bg-red-900",
        text: "text-red-700 dark:text-red-200",
      };
    if (focus < 3)
      return {
        bg: "bg-orange-100 dark:bg-orange-900",
        text: "text-orange-700 dark:text-orange-200",
      };
    if (focus < 4)
      return {
        bg: "bg-yellow-100 dark:bg-yellow-900",
        text: "text-yellow-700 dark:text-yellow-200",
      };
    if (focus < 5)
      return {
        bg: "bg-green-100 dark:bg-green-900",
        text: "text-green-700 dark:text-green-200",
      };
    return {
      bg: "bg-indigo-100 dark:bg-indigo-900",
      text: "text-indigo-700 dark:text-indigo-200",
    };
  };

  const getHoursColor = (hours: number) => {
    if (hours < 2)
      return {
        bg: "bg-red-100 dark:bg-red-900",
        text: "text-red-700 dark:text-red-200",
      };
    if (hours < 4)
      return {
        bg: "bg-orange-100 dark:bg-orange-900",
        text: "text-orange-700 dark:text-orange-200",
      };
    if (hours < 6)
      return {
        bg: "bg-yellow-100 dark:bg-yellow-900",
        text: "text-yellow-700 dark:text-yellow-200",
      };
    if (hours < 8)
      return {
        bg: "bg-green-100 dark:bg-green-900",
        text: "text-green-700 dark:text-green-200",
      };
    return {
      bg: "bg-indigo-100 dark:bg-indigo-900",
      text: "text-indigo-700 dark:text-indigo-200",
    };
  };

  const groupSessionsByDay = (sessions: Session[]): DayGroup[] => {
    const groups: { [key: string]: Session[] } = {};

    sessions.forEach((session) => {
      const date = new Date(session.created_at).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(session);
    });

    return Object.entries(groups)
      .map(([dateStr, sessions]) => {
        const totalMinutes = sessions.reduce(
          (sum, session) => sum + (session.minutes || 0),
          0
        );
        // Calculate weighted focus based on minutes
        const weightedFocus = sessions.reduce(
          (sum, session) => sum + session.focus * session.minutes,
          0
        );
        const averageFocus = weightedFocus / totalMinutes;

        return {
          date: new Date(dateStr),
          sessions,
          totalMinutes,
          averageFocus: Number(averageFocus.toFixed(1)),
        };
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  };

  useEffect(() => {
    if (!propSessions && userId) {
      fetchSessions();
    }
  }, [userId, propSessions]);

  useEffect(() => {
    if (sessions.length > 0) {
      setGroupedSessions(groupSessionsByDay(sessions));
      if (onStatsCalculated) {
        const stats = calculateStats(sessions);
        onStatsCalculated(stats);
      }
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
      const fetchedSessions = await (userId === user?.name
        ? api.getUserSessions()
        : api.getUserSessionsById(userId));
      setLocalSessions((prev) => [...prev, ...fetchedSessions]);
      setHasMore(fetchedSessions.length > 0);
      setPage((p) => p + 1);
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    } finally {
      setIsLocalLoading(false);
    }
  };

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const { scrollLeft, clientWidth, scrollWidth } = event.currentTarget;
    if (
      scrollWidth - scrollLeft <= clientWidth * 1.5 &&
      !isLoading &&
      hasMore
    ) {
      fetchSessions();
    }
  };

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
    <div className="w-full">
      {isLoading && page === 1 ? (
        <p>Loading sessions...</p>
      ) : (
        <div
          className="overflow-x-auto overflow-y-hidden whitespace-nowrap"
          onScroll={handleScroll}
          ref={containerRef}
          style={{ scrollSnapType: "x mandatory" }}
        >
          <div className="inline-flex gap-4">
            {groupedSessions.map((group, groupIndex) => (
              <div
                key={`group-${group.date.toISOString()}-${groupIndex}`}
                className="w-[250px] inline-block"
                style={{ scrollSnapAlign: "start" }}
              >
                <div className="sticky top-0 bg-slate-50 dark:bg-slate-800 backdrop-blur-sm p-3 rounded-lg border border-gray-200 dark:border-slate-700 mb-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                      <span className="font-medium text-gray-900 dark:text-slate-200">
                        {format(group.date, "MMM d")}
                      </span>
                    </div>
                    <div className="flex gap-3 text-sm">
                      <div
                        className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                          getHoursColor(group.totalMinutes / 60).bg
                        } dark:bg-opacity-80`}
                      >
                        <Clock
                          className={`w-4 h-4 ${
                            getHoursColor(group.totalMinutes / 60).text
                          }`}
                        />
                        <span
                          className={
                            getHoursColor(group.totalMinutes / 60).text
                          }
                        >
                          {(group.totalMinutes / 60)
                            .toFixed(1)
                            .replace(".0", "")}
                          h
                        </span>
                      </div>
                      <div
                        className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                          getFocusColor(group.averageFocus).bg
                        } dark:bg-opacity-80`}
                      >
                        <Brain
                          className={`w-4 h-4 ${
                            getFocusColor(group.averageFocus).text
                          }`}
                        />
                        <span
                          className={getFocusColor(group.averageFocus).text}
                        >
                          {group.averageFocus}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overflow-y-auto max-h-[260px]">
                  <div className="grid gap-3 grid-cols-1">
                    {group.sessions.map((session, sessionIndex) => (
                      <div
                        key={`session-${
                          session._id || session.created_at
                        }-${sessionIndex}`}
                        onClick={
                          deleteItems
                            ? () => handleSessionClick(session)
                            : undefined
                        }
                        className={
                          deleteItems ? "cursor-pointer w-full" : "w-full"
                        }
                      >
                        <SessionCard session={session} small={true} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {groupedSessions.length === 0 && (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400 w-full">
                No sessions recorded.
              </div>
            )}

            {isLoading && page > 1 && (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400 w-full">
                Loading more sessions...
              </div>
            )}
          </div>
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
