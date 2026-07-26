import React, { useState, useEffect, useRef } from "react";
import Signals from "./signal/Signals";
import DayflowFocusStats from "./DayflowFocusStats";
import DayflowTaskBoard from "./DayflowTaskBoard";
import CompassCurrentTasks from "./CompassCurrentTasks";
import { useAuth } from "../../context/AuthContext";
import {
  getAllSignals,
  SignalConfig,
} from "../settings/components/SignalSettings";

// CompassDayflow is the Dayflow-powered variant of the Compass page, selectable
// in Settings. It keeps the current-task hero and the Signals row, swaps the
// timer + session-detail stats for a single Dayflow focus number (with weekly /
// yearly progress), and drops Blocked Tasks so the task list fills the width.
//
// The classic Compass component is left completely untouched; this is a parallel
// page rendered instead of it when `preferences.compassVariant === "dayflow"`.

interface CompassDayflowProps {
  currentTask?: string;
  currentTasks?: string[];
  onRemoveTask?: (title: string) => void;
}

const noop = (): void => {
  return;
};

const CompassDayflow: React.FC<CompassDayflowProps> = ({
  currentTask = "",
  currentTasks = [],
  onRemoveTask = noop,
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
      if (document.body.dataset.taskContextMenuOpen === "true") return;

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
  return (
    <div
      className="p-0 gap-4 flex flex-col h-full relative"
      data-dayflow-compass="true"
      {...(hasTask ? { "data-task-active": "true" } : {})}
    >
      {/* This stripped-down view drops the outer Signals header. All styling is
          scoped to this variant so the classic Compass view is unaffected. */}
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

      {/* Current-task hero — sits just above the task lists (Signals + Focus
          stay on top). Appears when you pick a task via the (w) picker. */}
      {hasTask && (
        <CompassCurrentTasks
          tasks={tasksToShow}
          onRemoveTask={onRemoveTask}
        />
      )}

      {/* A shared drag context lets tasks move in either direction while each
          list retains its own saved order. */}
      <DayflowTaskBoard />
    </div>
  );
};

export default CompassDayflow;
