import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarRange,
  Check,
  Pencil,
  RotateCcw,
  Sun,
  Trash2,
} from "lucide-react";
import { Task, TaskType } from "../../types/Task";

interface TaskContextMenuProps {
  task: Task;
  position: { x: number; y: number };
  onClose: () => void;
  onToggleComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onMove: (task: Task, type: TaskType) => void;
  onDelete: (task: Task) => void;
}

const getMoveTarget = (task: Task): { type: TaskType; label: string } => {
  if (task.type === "day") {
    return { type: "week", label: "Move to this week" };
  }

  return { type: "day", label: "Move to today" };
};

const TaskContextMenu: React.FC<TaskContextMenuProps> = ({
  task,
  position,
  onClose,
  onToggleComplete,
  onEdit,
  onMove,
  onDelete,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState(position);
  const moveTarget = getMoveTarget(task);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const gutter = 8;
    const cursorOffset = 4;
    const bounds = menu.getBoundingClientRect();
    const left = Math.max(
      gutter,
      Math.min(position.x + cursorOffset, window.innerWidth - bounds.width - gutter),
    );
    const wouldOverflowBottom =
      position.y + cursorOffset + bounds.height + gutter > window.innerHeight;
    const top = Math.max(
      gutter,
      wouldOverflowBottom
        ? position.y - bounds.height - cursorOffset
        : position.y + cursorOffset,
    );

    setMenuPosition({ x: left, y: top });
  }, [position, task.id]);

  useEffect(() => {
    document.body.dataset.taskContextMenuOpen = "true";

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const handleViewportChange = () => onClose();

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("blur", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      delete document.body.dataset.taskContextMenuOpen;
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("blur", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [onClose]);

  const runAction = (action: () => void) => {
    onClose();
    action();
  };

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-gray-700 transition-colors hover:bg-gray-100 focus:bg-gray-100 focus:outline-none dark:text-gray-200 dark:hover:bg-gray-800 dark:focus:bg-gray-800";

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={`Actions for ${task.title}`}
      className="fixed z-[100] w-48 rounded-lg border border-gray-200 bg-white/95 p-1.5 shadow-xl backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/95"
      style={{ left: menuPosition.x, top: menuPosition.y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button
        type="button"
        role="menuitem"
        className={itemClass}
        onClick={() => runAction(() => onToggleComplete(task))}
      >
        {task.completed ? (
          <RotateCcw className="h-4 w-4 text-gray-400" />
        ) : (
          <Check className="h-4 w-4 text-emerald-500" />
        )}
        <span>{task.completed ? "Mark incomplete" : "Mark complete"}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className={itemClass}
        onClick={() => runAction(() => onEdit(task))}
      >
        <Pencil className="h-4 w-4 text-gray-400" />
        <span>Edit task</span>
      </button>
      {!task.completed && task.type !== moveTarget.type && (
        <button
          type="button"
          role="menuitem"
          className={itemClass}
          onClick={() => runAction(() => onMove(task, moveTarget.type))}
        >
          {moveTarget.type === "day" ? (
            <Sun className="h-4 w-4 text-amber-500" />
          ) : (
            <CalendarRange className="h-4 w-4 text-indigo-500" />
          )}
          <span>{moveTarget.label}</span>
        </button>
      )}
      <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
      <button
        type="button"
        role="menuitem"
        className={`${itemClass} text-red-600 hover:bg-red-50 focus:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 dark:focus:bg-red-950/40`}
        onClick={() => runAction(() => onDelete(task))}
      >
        <Trash2 className="h-4 w-4" />
        <span>Delete task</span>
      </button>
    </div>,
    document.body,
  );
};

export default TaskContextMenu;
