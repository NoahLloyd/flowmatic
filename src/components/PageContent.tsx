import React, { useState, useEffect } from "react";
import Layout from "./layout/Layout";
import Home from "../pages/home/Home";
import Focus from "../pages/focus/Focus";
import Tasks from "../pages/tasks/Tasks";
import Insights from "../pages/insights/insights";
import Settings from "../pages/settings/Settings";
import { useTimer } from "../hooks/useTimer";
import { useTasks } from "../hooks/useTasks";
import { useNavigation } from "../hooks/useNavigation";
import { api } from "../utils/api";
import { Session } from "../types/Session";

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
    handleAddTask,
    handleToggleComplete,
    handleDeleteTask,
    handleChangeTaskType,
  } = useTasks();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

  const fetchSessions = async () => {
    try {
      const userId = localStorage.getItem("name");
      if (!userId) return;

      setIsLoadingSessions(true);
      const response = await api.getUserSessions(userId);
      setSessions(response);
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  let content;
  switch (selected) {
    case "Home":
      content = <Home />;
      break;
    case "Focus":
      content = (
        <Focus
          time={timeRemaining}
          isRunning={isRunning}
          onStartPause={handleStartPause}
          onReset={handleReset}
          onAdjustTime={handleAdjustTime}
          sessions={sessions}
          isLoadingSessions={isLoadingSessions}
          onSessionCreated={fetchSessions}
        />
      );
      break;
    case "Tasks":
      content = (
        <Tasks
          tasks={tasks}
          onAddTask={handleAddTask}
          onToggleComplete={handleToggleComplete}
          onDelete={handleDeleteTask}
          onChangeTaskType={handleChangeTaskType}
        />
      );
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
      content = <Home />;
      break;
  }

  return (
    <Layout selected={selected} setSelected={setSelected}>
      {content}
    </Layout>
  );
};

export default PageContent;
