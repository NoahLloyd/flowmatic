import React, { useState, useEffect } from "react";
import Layout from "./layout/Layout";
import Friends from "../pages/friends/Friends";
import Compass from "../pages/compass/Compass";
import Tasks from "../pages/tasks/Tasks";
import Insights from "../pages/insights/insights";
import Settings from "../pages/settings/Settings";
import Morning from "../pages/morning/Morning";
import { useTimer } from "../hooks/useTimer";
import { useTasks } from "../hooks/useTasks";
import { useNavigation } from "../hooks/useNavigation";
import { api } from "../utils/api";
import { Session } from "../types/Session";
import Auth from "../pages/auth/Auth";
import { useAuth } from "../context/AuthContext";

const PageContent = () => {
  const { selected, setSelected } = useNavigation();
  const {
    timeRemaining,
    isRunning,
    handleStartPause,
    handleAdjustTime,
    handleReset,
  } = useTimer();

  const {
    tasks,
    isLoading: isLoadingTasks,
    handleAddTask,
    handleToggleComplete,
    handleDeleteTask,
    handleChangeTaskType,
    handleUpdateTitle,
  } = useTasks();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const { isAuthenticated, isLoading } = useAuth();

  const fetchSessions = async () => {
    try {
      setIsLoadingSessions(true);
      const response = await api.getUserSessions();
      setSessions(response);
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
      if (error.response?.status === 401) {
        setSelected("Compass");
      }
    } finally {
      setIsLoadingSessions(false);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await api.getCurrentUser();
      } catch (error) {
        setSelected("Compass");
      } finally {
        setIsAuthChecking(false);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isAuthChecking) {
      fetchSessions();
      const keepAliveInterval = setInterval(fetchSessions, 10 * 60 * 1000);
      return () => clearInterval(keepAliveInterval);
    }
  }, [isAuthChecking]);

  if (isAuthChecking) {
    return <div>Loading...</div>;
  }

  let content;
  switch (selected) {
    case "Friends":
      content = <Friends />;
      break;
    case "Compass":
      content = (
        <Compass
          time={timeRemaining}
          isRunning={isRunning}
          onStartPause={handleStartPause}
          onReset={handleReset}
          onAdjustTime={handleAdjustTime}
          sessions={sessions}
          isLoadingSessions={isLoadingSessions}
          onSessionCreated={fetchSessions}
          onSessionsUpdate={fetchSessions}
        />
      );
      break;
    case "Tasks":
      content = (
        <Tasks
          tasks={tasks}
          isLoading={isLoadingTasks}
          onAddTask={handleAddTask}
          onToggleComplete={handleToggleComplete}
          onDelete={handleDeleteTask}
          onChangeTaskType={handleChangeTaskType}
          onUpdateTitle={handleUpdateTitle}
        />
      );
      break;
    case "Morning":
      content = <Morning />;
      break;
    case "Insights":
      content = (
        <Insights sessions={sessions} isLoadingSessions={isLoadingSessions} />
      );
      break;
    case "Settings":
      content = <Settings />;
      break;
    default:
      content = <Friends />;
      break;
  }

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Auth />;
  }

  return (
    <Layout selected={selected} setSelected={setSelected}>
      {content}
    </Layout>
  );
};

export default PageContent;
