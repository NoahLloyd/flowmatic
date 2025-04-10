import React, { useState, useEffect, useCallback, useRef } from "react";
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
import Documents from "../pages/documents/Documents";
import QuickAddTaskModal from "./task/QuickAddTaskModal";
import QuickAddNoteModal from "./note/QuickAddNoteModal";

const PageContent = () => {
  const { selected, setSelected } = useNavigation();
  // State for QuickAddTaskModal
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  // State for QuickAddNoteModal
  const [isQuickAddNoteModalOpen, setIsQuickAddNoteModalOpen] = useState(false);

  // Create a direct navigation function
  const directNavigate = useCallback(
    (page: string) => {
      setSelected(page);
    },
    [setSelected]
  );

  // Add keyboard handler for global navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if focused on input elements
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        document.activeElement instanceof HTMLSelectElement ||
        (document.activeElement &&
          document.activeElement.hasAttribute("contenteditable"))
      ) {
        return;
      }

      // Global "a" key to open quick add task modal
      if (e.key === "a" && !isQuickAddModalOpen && !isQuickAddNoteModalOpen) {
        e.preventDefault();
        e.stopPropagation();
        setIsQuickAddModalOpen(true);
        return;
      }

      // Global "o" key to open quick add note modal
      if (e.key === "o" && !isQuickAddNoteModalOpen && !isQuickAddModalOpen) {
        e.preventDefault();
        e.stopPropagation();
        setIsQuickAddNoteModalOpen(true);
        return;
      }

      // Skip other keyboard shortcuts if any quick add modal is open
      if (isQuickAddModalOpen || isQuickAddNoteModalOpen) {
        return;
      }

      const scrollAmount = window.innerHeight * 0.75; // 75% of viewport height

      if (e.key === "j" || e.key === "k") {
        // Get the element under mouse position
        const x = (window.event as MouseEvent)?.clientX || 0;
        const y = (window.event as MouseEvent)?.clientY || 0;
        let elementUnderMouse = document.elementFromPoint(x, y);

        // Find the nearest scrollable parent
        let scrollableElement = null;
        let currentElement = elementUnderMouse;

        // If there's no element under mouse, use the main content area
        if (!currentElement) {
          // Find the main content area with overflow-scroll
          const mainContentArea = document.querySelector(".overflow-scroll");
          if (mainContentArea) {
            scrollableElement = mainContentArea;
          } else {
            // Fallback to document.documentElement
            scrollableElement = document.documentElement;
          }
        } else {
          // Traverse up to find scrollable parent
          while (currentElement && !scrollableElement) {
            // Check if element is scrollable
            const styles = window.getComputedStyle(currentElement);
            const overflow =
              styles.getPropertyValue("overflow") ||
              styles.getPropertyValue("overflow-y");

            const hasScroll =
              overflow === "auto" ||
              overflow === "scroll" ||
              currentElement.scrollHeight > currentElement.clientHeight;

            if (hasScroll && currentElement.scrollHeight > 0) {
              scrollableElement = currentElement;
              break;
            }

            currentElement = currentElement.parentElement;
          }

          // If no scrollable parent found, use the main content area
          if (!scrollableElement) {
            const mainContentArea = document.querySelector(".overflow-scroll");
            scrollableElement = mainContentArea || document.documentElement;
          }
        }

        // Now scroll the identified element
        if (scrollableElement) {
          const direction = e.key === "j" ? 1 : -1;
          scrollableElement.scrollBy({
            top: direction * scrollAmount,
            behavior: "smooth",
          });
          e.preventDefault(); // Prevent default scrolling
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isQuickAddModalOpen, isQuickAddNoteModalOpen]);

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
    forceRefreshTimerDisplay,
  } = useTimer(directNavigate); // Pass the direct navigation function

  const {
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

      // Force refresh the timer display to ensure it's showing the correct time
      forceRefreshTimerDisplay();
    }
  }, [selected]); // Only re-run when selected page changes

  // Add a special handler for when the user returns to Compass from another page
  // This ensures the timer continues running properly after navigation
  useEffect(() => {
    let refreshTimer: NodeJS.Timeout | null = null;

    if (selected === "Compass" && isRunning) {
      // Force an immediate refresh
      forceRefreshTimerDisplay();

      // Set up a short series of refreshes to ensure the timer reconnects properly
      refreshTimer = setTimeout(() => {
        forceRefreshTimerDisplay();

        // Sometimes a second refresh is needed to ensure the timer kicks back in
        setTimeout(() => {
          forceRefreshTimerDisplay();
        }, 500);
      }, 100);
    }

    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
    };
  }, [selected, isRunning, forceRefreshTimerDisplay]);

  // Handle adding a task from the quick add modal
  const handleQuickAddTask = async (
    title: string,
    type: "day" | "week" | "future"
  ) => {
    await handleAddTask(title, type);
    return Promise.resolve();
  };

  // Handle adding a note from the quick add modal
  const handleQuickAddNote = async (content: string) => {
    try {
      await api.createNote({ content, tags: [] });
      // If we're on the Notes page, we might want to refresh the notes list
      if (selected === "Notes") {
        // This assumes your Notes component has a prop to trigger a refresh
        // You might need to add this functionality
      }
      return Promise.resolve();
    } catch (error) {
      console.error("Failed to create note:", error);
      return Promise.reject(error);
    }
  };

  if (isAuthChecking) {
    return <div>Loading...</div>;
  }

  let content;
  if (!isAuthenticated) {
    content = <Auth />;
  } else {
    switch (selected) {
      case "Compass":
        content = (
          <Compass
            time={time}
            isRunning={isRunning}
            onStartPause={handleStartPause}
            onAdjustTime={handleAdjustTime}
            onReset={handleReset}
            isModalOpen={isModalOpen}
            onCloseModal={handleCloseModal}
            onStartBreak={handleStartBreak}
            onRestartTimer={handleRestartTimer}
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
      case "Documents":
        content = <Documents />;
        break;
      case "Tasks":
        content = (
          <Tasks
            onAddTask={handleAddTask}
            onToggleComplete={handleToggleComplete}
            onDelete={handleDeleteTask}
            onChangeTaskType={handleChangeTaskType}
            onUpdateTitle={handleUpdateTitle}
          />
        );
        break;
      case "Notes":
        content = <Notes />;
        break;
      case "Morning":
        content = <Morning />;
        break;
      case "Insights":
        content = (
          <Insights sessions={sessions} isLoadingSessions={isLoadingSessions} />
        );
        break;
      case "Friends":
        content = <Friends />;
        break;
      case "Settings":
        content = <Settings />;
        break;
      default:
        content = <div>Select a page from the sidebar</div>;
    }
  }

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Layout selected={selected} setSelected={setSelected}>
      {content}
      <QuickAddTaskModal
        isOpen={isQuickAddModalOpen}
        onClose={() => setIsQuickAddModalOpen(false)}
        onAddTask={handleQuickAddTask}
      />
      <QuickAddNoteModal
        isOpen={isQuickAddNoteModalOpen}
        onClose={() => setIsQuickAddNoteModalOpen(false)}
        onAddNote={handleQuickAddNote}
      />
    </Layout>
  );
};

export default PageContent;
