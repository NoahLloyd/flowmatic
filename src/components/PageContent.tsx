import React, { useState, useEffect, useCallback } from "react";
import Layout from "./layout/Layout";
import Friends from "../pages/friends/Friends";
import Compass from "../pages/compass/Compass";
import Tasks from "../pages/tasks/Tasks";
import Insights from "../pages/insights/insights";
import Settings from "../pages/settings/Settings";
import Morning from "../pages/morning/Morning";
import Notes from "../pages/notes/Notes";
import { useTimer } from "../hooks/useTimer";
import { useTasks } from "../hooks/useTasks";
import { useNavigation } from "../hooks/useNavigation";
import { api } from "../utils/api";
import { Session } from "../types/Session";
import Auth from "../pages/auth/Auth";
import { useAuth } from "../context/AuthContext";
import Articles from "../pages/articles/Articles";

const PageContent = () => {
  const { selected, setSelected } = useNavigation();

  // Create a direct navigation function
  const directNavigate = useCallback(
    (page: string) => {
      setSelected(page);
    },
    [setSelected]
  );

  const {
    timeRemaining: time,
    isRunning,
    handleStartPause,
    handleAdjustTime,
    handleReset,
    handleStartBreak,
    handleRestartTimer,
    isModalOpen,
    handleCloseModal,
    // Break timer props
    breakTimeRemaining,
    breakIsRunning,
    isBreakMode,
    handleBreakTimerStartPause,
    handleBreakTimerReset,
    handleBreakTimerAdjust,
    // Sidebar timer props - we don't need to pass these to Compass
    // since they're accessed directly in Layout
    synchronizeTimerState,
  } = useTimer(directNavigate); // Pass the direct navigation function

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
    }
  }, [isAuthChecking]);

  // Force synchronize timer state when selected page changes to Compass
  useEffect(() => {
    if (selected === "Compass") {
      // Force reload timer state from localStorage to ensure everything is in sync
      synchronizeTimerState();
    }
  }, [selected]); // Only re-run when selected page changes

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
          time={time}
          isRunning={isRunning}
          onStartPause={handleStartPause}
          onReset={handleReset}
          onAdjustTime={handleAdjustTime}
          onStartBreak={handleStartBreak}
          onRestartTimer={handleRestartTimer}
          isModalOpen={isModalOpen}
          onCloseModal={handleCloseModal}
          // Break timer props
          breakTimeRemaining={breakTimeRemaining}
          breakIsRunning={breakIsRunning}
          isBreakMode={isBreakMode}
          onBreakTimerStartPause={handleBreakTimerStartPause}
          onBreakTimerReset={handleBreakTimerReset}
          onBreakTimerAdjust={handleBreakTimerAdjust}
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
    case "Notes":
      content = <Notes />;
      break;
    case "Insights":
      content = (
        <Insights sessions={sessions} isLoadingSessions={isLoadingSessions} />
      );
      break;
    case "Settings":
      content = <Settings />;
      break;
    case "Articles":
      content = <Articles />;
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
