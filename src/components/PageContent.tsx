import React, { useState, useEffect, useCallback } from "react";
import Layout from "./layout/Layout";
import Friends from "../pages/friends/Friends";
import Compass from "../pages/compass/Compass";
import Tasks from "../pages/tasks/Tasks";
import Insights from "../pages/insights/Insights";
import Settings from "../pages/settings/Settings";
import Morning from "../pages/morning/Morning";
import Notes from "../pages/notes/Notes";
import Review from "../pages/review/Review";
import { useTimer } from "../hooks/useTimer";
import { useTasks } from "../hooks/useTasks";
import { useNavigation } from "../hooks/useNavigation";
import { useToast } from "../context/ToastContext";
import { api } from "../utils/api";
import Auth from "../pages/auth/Auth";
import { useAuth } from "../context/AuthContext";
import QuickAddTaskModal from "./task/QuickAddTaskModal";
import QuickAddNoteModal from "./note/QuickAddNoteModal";
import GlobalQuickAddTask from "./global/GlobalQuickAddTask";
import GlobalQuickAddNote from "./global/GlobalQuickAddNote";
import StreakScreen from "./streak/StreakScreen";
import { dispatchTaskAdded } from "../utils/taskEvents";

const PageContent = () => {
  const { selected, setSelected } = useNavigation();
  const { showToast } = useToast();
  // State for QuickAddTaskModal
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  // State for QuickAddNoteModal
  const [isQuickAddNoteModalOpen, setIsQuickAddNoteModalOpen] = useState(false);
  // State for Global Quick Add modals (triggered by global shortcuts)
  const [isGlobalQuickAddTaskOpen, setIsGlobalQuickAddTaskOpen] =
    useState(false);
  const [isGlobalQuickAddNoteOpen, setIsGlobalQuickAddNoteOpen] =
    useState(false);
  // Track previous selected page so we can return to it from Streak
  const [previousPage, setPreviousPage] = useState("Compass");

  // Create a direct navigation function
  const directNavigate = useCallback(
    (page: string) => {
      setSelected(page);
    },
    [setSelected]
  );

  // Set up IPC listeners for global shortcuts and overlay events
  useEffect(() => {
    const handleGlobalQuickAddTask = () => {
      setIsGlobalQuickAddTaskOpen(true);
    };

    const handleGlobalQuickAddNote = () => {
      setIsGlobalQuickAddNoteOpen(true);
    };

    // Handle tasks added from the overlay window
    const handleTaskAddedFromOverlay = (task: any) => {
      // Dispatch event so task lists update
      dispatchTaskAdded(task);
      showToast("Daily task added", "success");
    };

    // Handle streak screen open event
    const handleOpenStreakScreen = () => {
      setPreviousPage(selected);
      setSelected("Streak");
    };
    window.addEventListener("openStreakScreen", handleOpenStreakScreen);

    // Register listeners
    let quickTaskId: number | undefined;
    let quickNoteId: number | undefined;
    let overlayTaskId: number | undefined;
    if (window.electron?.on) {
      quickTaskId = window.electron.on("global-quick-add-task", handleGlobalQuickAddTask);
      quickNoteId = window.electron.on("global-quick-add-note", handleGlobalQuickAddNote);
      overlayTaskId = window.electron.on("task-added-from-overlay", handleTaskAddedFromOverlay);
    }

    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener("openStreakScreen", handleOpenStreakScreen);
      if (window.electron?.removeListener) {
        if (quickTaskId !== undefined) window.electron.removeListener("global-quick-add-task", quickTaskId);
        if (quickNoteId !== undefined) window.electron.removeListener("global-quick-add-note", quickNoteId);
        if (overlayTaskId !== undefined) window.electron.removeListener("task-added-from-overlay", overlayTaskId);
      }
    };
  }, [showToast]);

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

      // Global "a" key to open quick add task modal (except on Tasks page where it focuses the input)
      if (e.key === "a" && !isQuickAddModalOpen && !isQuickAddNoteModalOpen) {
        // On Tasks page, let the AddTaskForm handle the 'a' key to focus its input
        if (selected === "Tasks") {
          return;
        }
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
  }, [isQuickAddModalOpen, isQuickAddNoteModalOpen, selected]);

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
    // Stopwatch props
    isStopwatchMode,
    toggleStopwatchMode,
    sessionMinutes,
    // Current task
    currentTask,
    setCurrentTask,
  } = useTimer(directNavigate); // Pass the direct navigation function

  const {
    handleAddTask,
    handleToggleComplete,
    handleDeleteTask,
    handleChangeTaskType,
    handleUpdateTitle,
  } = useTasks();

  const { isAuthenticated, isLoading } = useAuth();

  // Use refs so the IPC listener always calls the latest handler
  // without needing to re-register (which leaked listeners before)
  const handleStartPauseRef = React.useRef(handleStartPause);
  handleStartPauseRef.current = handleStartPause;
  const isRunningRef = React.useRef(isRunning);
  isRunningRef.current = isRunning;
  const isModalOpenRef = React.useRef(isModalOpen);
  isModalOpenRef.current = isModalOpen;
  const handleCloseModalRef = React.useRef(handleCloseModal);
  handleCloseModalRef.current = handleCloseModal;

  // Handle global shortcut IPC events for timer control — register once
  useEffect(() => {
    const handleToggleTimer = () => {
      handleStartPauseRef.current();
    };

    const handleOpenRecordModal = () => {
      setSelected("Compass");
      if (isRunningRef.current) {
        handleStartPauseRef.current();
      }
      if (!isModalOpenRef.current) {
        handleCloseModalRef.current();
      }
    };

    let timerId: number | undefined;
    let recordId: number | undefined;
    if (window.electron?.on) {
      timerId = window.electron.on("toggle-timer", handleToggleTimer);
      recordId = window.electron.on("open-record-modal", handleOpenRecordModal);
    }

    return () => {
      if (window.electron?.removeListener) {
        if (timerId !== undefined) window.electron.removeListener("toggle-timer", timerId);
        if (recordId !== undefined) window.electron.removeListener("open-record-modal", recordId);
      }
    };
  }, []); // Register once, refs keep handlers fresh

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
    type: "day" | "week" | "future" | "blocked" | "shopping"
  ) => {
    const createdTask = await handleAddTask(title, type);
    if (createdTask) {
      // Dispatch event so other components (Tasks, DailyTasks, BlockedTasks) can update
      dispatchTaskAdded(createdTask);
      showToast("Task added", "success");
    } else {
      showToast("Failed to add task", "error");
    }
    return Promise.resolve();
  };

  // Handle adding to review inbox from the quick add modal
  const handleAddToReviewInbox = async (item: string) => {
    const success = await api.addToReviewInbox(item);
    if (success) {
      showToast("Added to review inbox", "success");
    } else {
      showToast("Failed to add to inbox", "error");
    }
    return Promise.resolve();
  };

  // Handle adding a note from the quick add modal
  const handleQuickAddNote = async (content: string) => {
    try {
      await api.createNote({ content, tags: [] });
      showToast("Note added", "success");
      // If we're on the Notes page, we might want to refresh the notes list
      if (selected === "Notes") {
        // This assumes your Notes component has a prop to trigger a refresh
        // You might need to add this functionality
      }
      return Promise.resolve();
    } catch (error) {
      console.error("Failed to create note:", error);
      showToast("Failed to add note", "error");
      return Promise.reject(error);
    }
  };

  // Handle adding a daily task from the global quick add (adds directly as daily task)
  const handleGlobalQuickAddTask = async (title: string) => {
    const createdTask = await handleAddTask(title, "day");
    if (createdTask) {
      // Dispatch event so other components (Tasks, DailyTasks) can update
      dispatchTaskAdded(createdTask);
      showToast("Daily task added", "success");
    } else {
      showToast("Failed to add task", "error");
    }
    return Promise.resolve();
  };

  // Handle adding a note from the global quick add
  const handleGlobalQuickAddNote = async (content: string) => {
    try {
      await api.createNote({ content, tags: [] });
      showToast("Note added", "success");
      return Promise.resolve();
    } catch (error) {
      console.error("Failed to create note:", error);
      showToast("Failed to add note", "error");
      return Promise.reject(error);
    }
  };

  if (isLoading) {
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
            isStopwatchMode={isStopwatchMode}
            onToggleStopwatchMode={toggleStopwatchMode}
            sessionMinutes={sessionMinutes}
            currentTask={currentTask}
            onSetCurrentTask={setCurrentTask}
          />
        );
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
      case "Review":
        content = <Review />;
        break;
      case "Insights":
        content = <Insights />;
        break;
      case "Friends":
        content = <Friends />;
        break;
      case "Settings":
        content = <Settings />;
        break;
      case "Streak":
        content = (
          <StreakScreen
            onClose={() => setSelected(previousPage)}
          />
        );
        break;
      default:
        content = <div>Select a page from the sidebar</div>;
    }
  }

  return (
    <Layout selected={selected} setSelected={setSelected}>
      {content}
      <QuickAddTaskModal
        isOpen={isQuickAddModalOpen}
        onClose={() => setIsQuickAddModalOpen(false)}
        onAddTask={handleQuickAddTask}
        onAddToReviewInbox={handleAddToReviewInbox}
      />
      <QuickAddNoteModal
        isOpen={isQuickAddNoteModalOpen}
        onClose={() => setIsQuickAddNoteModalOpen(false)}
        onAddNote={handleQuickAddNote}
      />
      {/* Global Quick Add Modals (triggered by global shortcuts) */}
      <GlobalQuickAddTask
        isOpen={isGlobalQuickAddTaskOpen}
        onClose={() => setIsGlobalQuickAddTaskOpen(false)}
        onAddTask={handleGlobalQuickAddTask}
      />
      <GlobalQuickAddNote
        isOpen={isGlobalQuickAddNoteOpen}
        onClose={() => setIsGlobalQuickAddNoteOpen(false)}
        onAddNote={handleGlobalQuickAddNote}
      />
    </Layout>
  );
};

export default PageContent;
