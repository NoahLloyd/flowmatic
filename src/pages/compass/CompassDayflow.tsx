import React, { useState, useEffect, useRef } from "react";
import Signals from "./signal/Signals";
import DayflowFocusStats from "./DayflowFocusStats";
import DailyTasks from "./DailyTasks";
import CompassWeekTasks from "./CompassWeekTasks";
import { useAuth } from "../../context/AuthContext";
import {
  getAllSignals,
  SignalConfig,
} from "../settings/components/SignalSettings";

// CompassDayflow is the Dayflow-powered variant of the Compass page, selectable
// in Settings. It keeps the "Working on" hero and the Signals row, swaps the
// timer + session-detail stats for a single Dayflow focus number (with weekly /
// yearly progress), and drops Blocked Tasks so the task list fills the width.
//
// The classic Compass component is left completely untouched; this is a parallel
// page rendered instead of it when `preferences.compassVariant === "dayflow"`.

interface CompassDayflowProps {
  currentTask?: string;
  currentTasks?: string[];
  onOpenTaskPicker?: () => void;
  onRemoveTask?: (title: string) => void;
}

const CompassDayflow: React.FC<CompassDayflowProps> = ({
  currentTask = "",
  currentTasks = [],
  onOpenTaskPicker = () => {},
  onRemoveTask = () => {},
}) => {
  const { user } = useAuth();

  const signalsRef = useRef<HTMLDivElement>(null);
  const [selectedSignalIndex, setSelectedSignalIndex] = useState<number | null>(
    null,
  );
  const [awaitingScaleValue, setAwaitingScaleValue] = useState(false);

  // Visual highlight for the currently selected signal card.
  useEffect(() => {
    if (selectedSignalIndex === null) return;

    const signalCardContainer = signalsRef.current?.querySelector(".grid");
    const signalCards = signalCardContainer?.children;
    if (!signalCards || signalCards.length === 0) return;

    Array.from(signalCards).forEach((card) => {
      (card as HTMLElement).style.boxShadow = "none";
    });

    if (signalCards[selectedSignalIndex]) {
      const selectedCard = signalCards[selectedSignalIndex] as HTMLElement;
      selectedCard.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.5)";
    }

    return () => {
      Array.from(signalCards).forEach((card) => {
        (card as HTMLElement).style.boxShadow = "none";
      });
    };
  }, [selectedSignalIndex]);

  // Signal number-key shortcuts (1-9). This mirrors the classic Compass signal
  // handling; the timer-related keys are intentionally omitted since this
  // variant has no timer.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (document.body.dataset.taskMode === "true") return;
      if (document.body.dataset.quickAddOpen === "true") return;
      if (document.body.dataset.taskPickerOpen === "true") return;

      const keyNum = parseInt(e.key);
      if (isNaN(keyNum) || keyNum < 1 || keyNum > 9) return;
      e.preventDefault();

      const index = keyNum - 1;
      const signalCardContainer = signalsRef.current?.querySelector(".grid");
      const signalCards = signalCardContainer?.children;
      if (!signalCards || signalCards.length === 0) return;

      const activeSignals = user?.preferences?.activeSignals || [];
      const allSignals = getAllSignals(
        user?.preferences?.customSignals as
          | Record<string, SignalConfig>
          | undefined,
      );

      if (selectedSignalIndex !== null) {
        const selectedSignalKey = activeSignals[selectedSignalIndex];
        const selectedSignalConfig = allSignals[selectedSignalKey];

        if (selectedSignalConfig?.type === "water") {
          const waterCard = signalCards[selectedSignalIndex] as HTMLElement;
          if (keyNum === 1) {
            const addSmallButton = waterCard.querySelectorAll("button")[0];
            if (addSmallButton) {
              addSmallButton.click();
              setSelectedSignalIndex(null);
              return;
            }
          } else if (keyNum === 2) {
            const addLargeButton = waterCard.querySelectorAll("button")[1];
            if (addLargeButton) {
              addLargeButton.click();
              setSelectedSignalIndex(null);
              return;
            }
          } else if (keyNum === 3) {
            const editContainer = waterCard.querySelector(".flex-1");
            if (editContainer) {
              editContainer.dispatchEvent(
                new MouseEvent("click", { bubbles: true }),
              );
              setTimeout(() => {
                const input = waterCard.querySelector("input");
                if (input) input.focus();
              }, 50);
              return;
            }
          }
          setSelectedSignalIndex(null);
          return;
        } else if (
          selectedSignalConfig?.type === "scale" &&
          keyNum >= 1 &&
          keyNum <= 5
        ) {
          const scaleButtons =
            signalCards[selectedSignalIndex].querySelectorAll("button");
          if (scaleButtons.length >= keyNum) {
            scaleButtons[keyNum - 1].click();
          }
          setSelectedSignalIndex(null);
          setAwaitingScaleValue(false);
          return;
        }

        setSelectedSignalIndex(null);
        setAwaitingScaleValue(false);
        return;
      }

      if (index < activeSignals.length && index < signalCards.length) {
        const signalKey = activeSignals[index];
        const signalConfig = allSignals[signalKey];
        const targetSignalCard = signalCards[index] as HTMLElement;

        if (signalConfig?.type === "binary") {
          const toggleButton = targetSignalCard.querySelector("button");
          if (toggleButton) {
            toggleButton.click();
          } else {
            targetSignalCard.dispatchEvent(
              new MouseEvent("click", { bubbles: true }),
            );
          }
          return;
        }

        setSelectedSignalIndex(index);
        targetSignalCard.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.5)";

        if (signalConfig?.type === "scale") {
          setAwaitingScaleValue(true);
        } else if (signalConfig?.type === "number") {
          const existingInput = targetSignalCard.querySelector("input");
          if (existingInput) {
            existingInput.focus();
          } else {
            const clickableDiv = targetSignalCard.querySelector(
              "div[class*='cursor-pointer']",
            );
            if (clickableDiv) {
              clickableDiv.dispatchEvent(
                new MouseEvent("click", { bubbles: true }),
              );
              setTimeout(() => {
                const input = targetSignalCard.querySelector("input");
                if (input) input.focus();
              }, 50);
            } else {
              targetSignalCard.dispatchEvent(
                new MouseEvent("click", { bubbles: true }),
              );
              setTimeout(() => {
                const input = targetSignalCard.querySelector("input");
                if (input) input.focus();
              }, 50);
            }
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    selectedSignalIndex,
    awaitingScaleValue,
    user?.preferences?.activeSignals,
  ]);

  const tasksToShow =
    currentTasks.length > 0
      ? currentTasks
      : currentTask
      ? [currentTask]
      : [];
  const hasTask = tasksToShow.length > 0;
  const isSingle = tasksToShow.length === 1;

  return (
    <div
      className="p-0 gap-4 flex flex-col h-full relative"
      data-dayflow-compass="true"
      {...(hasTask ? { "data-task-active": "true" } : {})}
    >
      {/* This stripped-down view drops the section headers — the Signals and
          Tasks cards read fine without their "Signals" / "Tasks" titles here.
          The full-width task list also gets larger, wrapping rows since there's
          room to spare. All scoped to this variant so the classic view is
          unaffected. */}
      <style>{`
        [data-dayflow-compass="true"] .card-header { display: none; }

        /* Signals: drop the outer card box — each signal already sits in its
           own box — and un-inset the grid so it lines up with everything else. */
        [data-dayflow-signals="true"] > div {
          border: none;
          border-radius: 0;
          overflow: visible;
          background: transparent;
        }
        [data-dayflow-signals="true"] > div > .p-5 { padding: 0; }

        /* Roomy, top-aligned rows with a hover affordance. The negative
           margins let the hover background breathe past the text without
           shifting the text itself. */
        [data-dayflow-tasks="true"] .gap-3 {
          align-items: flex-start;
          gap: 0.9rem;
          padding: 0.6rem 0.75rem;
          margin-left: -0.75rem;
          margin-right: -0.75rem;
          border-radius: 0.625rem;
          transition: background-color 120ms ease;
        }
        [data-dayflow-tasks="true"] .gap-3:hover {
          background-color: rgba(128, 128, 128, 0.09);
        }

        /* Bigger, crisper checkboxes (and badges/spacers, which share the
           w-3.5/h-3.5 size). Nudged down to sit on the first text line. */
        [data-dayflow-tasks="true"] .w-3\\.5 {
          width: 1.375rem;
          height: 1.375rem;
          margin-top: 0.2rem;
          border-width: 2px;
          border-radius: 0.4rem;
        }
        /* Completed-task checkmark scales up with its box. */
        [data-dayflow-tasks="true"] .w-2\\.5 {
          width: 0.9rem;
          height: 0.9rem;
        }

        /* Large, wrapping task text in SF Pro Rounded — a free macOS system
           font (no bundling) that's a touch friendlier than the default UI
           sans. Slightly smaller than the numbers above it. */
        [data-dayflow-tasks="true"] span.cursor-text {
          flex: 1 1 auto;
          min-width: 0;
          font-family: "SF Pro Rounded", ui-rounded, -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 1.1875rem;
          line-height: 1.5;
          white-space: normal;
          overflow: visible;
          text-overflow: clip;
          overflow-wrap: anywhere;
        }
        [data-dayflow-tasks="true"] input[type="text"] {
          font-family: "SF Pro Rounded", ui-rounded, -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 1.1875rem;
        }
      `}</style>

      {hasTask && (
        <style>{`[data-task-active="true"] .task-hours-label { display: block; }
[data-task-active="true"] .task-hours-line { display: block; }`}</style>
      )}

      {/* Signals — no outer box in this view; each signal keeps its own. */}
      <div ref={signalsRef} data-dayflow-signals="true">
        <Signals isModalOpen={false} />
      </div>

      {/* Dayflow focus number + weekly/yearly progress */}
      <DayflowFocusStats />

      {/* "Working on" hero — sits just above the task lists (Signals + Focus
          stay on top). Appears when you pick a task via the (w) picker. */}
      {hasTask && (
        <div className="border-l-4 border-indigo-500 dark:border-indigo-400 pl-4 py-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-indigo-500 dark:text-indigo-400">
              Working on
            </span>
            {!isSingle && (
              <span className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                {tasksToShow.length}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            {tasksToShow.map((title, idx) => (
              <div
                key={title + idx}
                onClick={onOpenTaskPicker}
                className={`group flex items-center gap-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 cursor-pointer transition-colors ${
                  isSingle ? "px-5 py-3" : "px-3.5 py-2"
                }`}
              >
                {!isSingle && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      idx === 0
                        ? "bg-indigo-500 dark:bg-indigo-400"
                        : "bg-indigo-300/60 dark:bg-indigo-500/40"
                    }`}
                  />
                )}
                <span
                  className={`flex-1 font-semibold text-gray-900 dark:text-white truncate ${
                    isSingle ? "text-3xl leading-tight" : "text-base"
                  }`}
                >
                  {title}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveTask(title);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 text-xs transition-opacity"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's tasks (capped to a reading measure) beside this week's tasks.
          The grid sets each column's width; data-dayflow-tasks drives the
          larger, wrapping rows in both columns. */}
      <div
        className="flex-1 min-h-0 grid gap-8"
        style={{ gridTemplateColumns: "minmax(0, 44rem) minmax(0, 32rem)" }}
        data-dayflow-tasks="true"
      >
        <div className="min-h-0 flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 dark:text-gray-500 px-1">
            Today
          </span>
          <div className="flex-1 min-h-0 flex flex-col">
            <DailyTasks />
          </div>
        </div>
        <div className="min-h-0 flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 dark:text-gray-500 px-1">
            This week
          </span>
          <div className="flex-1 min-h-0 flex flex-col">
            <CompassWeekTasks />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompassDayflow;
