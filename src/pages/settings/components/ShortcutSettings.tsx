import React, { useState, useEffect, useRef } from "react";
import { Command, RotateCcw } from "lucide-react";

interface ShortcutsConfig {
  quickAddTask: string;
  quickAddNote: string;
}

// Extended electron interface for shortcuts
interface ElectronWithShortcuts {
  getShortcuts?: () => Promise<ShortcutsConfig>;
  updateShortcuts?: (shortcuts: ShortcutsConfig) => Promise<ShortcutsConfig>;
}

const DEFAULT_SHORTCUTS: ShortcutsConfig = {
  quickAddTask: "Alt+T",
  quickAddNote: "Alt+N",
};

const ShortcutSettings: React.FC = () => {
  const [shortcuts, setShortcuts] =
    useState<ShortcutsConfig>(DEFAULT_SHORTCUTS);
  const [editingKey, setEditingKey] = useState<keyof ShortcutsConfig | null>(
    null
  );
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get electron with shortcuts methods
  const getElectron = (): ElectronWithShortcuts | null => {
    if (typeof window !== "undefined" && window.electron) {
      return window.electron as unknown as ElectronWithShortcuts;
    }
    return null;
  };

  // Load shortcuts on mount
  useEffect(() => {
    loadShortcuts();
  }, []);

  // Focus input when editing starts
  useEffect(() => {
    if (editingKey && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingKey]);

  const loadShortcuts = async () => {
    try {
      const electron = getElectron();
      if (electron?.getShortcuts) {
        const loadedShortcuts = await electron.getShortcuts();
        setShortcuts(loadedShortcuts);
        // Also store in window for the parent Settings component to access
        (window as any).__shortcutSettings = loadedShortcuts;
      }
    } catch (error) {
      console.error("Failed to load shortcuts:", error);
    }
  };

  const saveShortcuts = async (newShortcuts: ShortcutsConfig) => {
    try {
      const electron = getElectron();
      if (electron?.updateShortcuts) {
        const savedShortcuts = await electron.updateShortcuts(newShortcuts);
        setShortcuts(savedShortcuts);
        (window as any).__shortcutSettings = savedShortcuts;
      }
    } catch (error) {
      console.error("Failed to save shortcuts:", error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!editingKey) return;

    e.preventDefault();
    e.stopPropagation();

    // Handle escape to cancel
    if (e.key === "Escape") {
      setEditingKey(null);
      setRecordedKeys([]);
      return;
    }

    // Build the shortcut string
    const keys: string[] = [];

    if (e.ctrlKey) keys.push("Ctrl");
    if (e.altKey) keys.push("Alt");
    if (e.metaKey) keys.push("Cmd");
    if (e.shiftKey) keys.push("Shift");

    // Add the main key if it's not a modifier
    const mainKey = e.key;
    if (!["Control", "Alt", "Meta", "Shift"].includes(mainKey)) {
      keys.push(mainKey.length === 1 ? mainKey.toUpperCase() : mainKey);
    }

    setRecordedKeys(keys);

    // If we have at least one modifier and one other key, save the shortcut
    if (
      keys.length >= 2 &&
      !["Control", "Alt", "Meta", "Shift"].includes(mainKey)
    ) {
      const shortcutString = keys.join("+");
      const newShortcuts = {
        ...shortcuts,
        [editingKey]: shortcutString,
      };
      saveShortcuts(newShortcuts);
      setEditingKey(null);
      setRecordedKeys([]);
    }
  };

  const handleReset = async () => {
    await saveShortcuts(DEFAULT_SHORTCUTS);
  };

  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  const formatShortcut = (shortcut: string) => {
    return shortcut.split("+").map((key, index) => (
      <span key={index}>
        {index > 0 && <span className="text-gray-400 mx-0.5">+</span>}
        <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono text-xs">
          {key === "Alt" && isMac
            ? "⌥"
            : key === "Cmd" && isMac
            ? "⌘"
            : key === "Ctrl" && isMac
            ? "⌃"
            : key}
        </kbd>
      </span>
    ));
  };

  const shortcutItems = [
    {
      key: "quickAddTask" as const,
      label: "Quick Add Daily Task",
      description: "Opens a floating input to quickly add a daily task",
    },
    {
      key: "quickAddNote" as const,
      label: "Quick Add Note",
      description: "Opens a floating input to quickly add a note",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Configure global keyboard shortcuts that work even when the app is not
          focused.
        </p>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 rounded-md border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Reset to defaults
        </button>
      </div>

      <div className="space-y-3">
        {shortcutItems.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
          >
            <div className="flex-1">
              <div className="font-medium text-sm text-gray-900 dark:text-white">
                {item.label}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {item.description}
              </div>
            </div>
            <div className="ml-4">
              {editingKey === item.key ? (
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={recordedKeys.join(" + ") || "Press keys..."}
                    onKeyDown={handleKeyDown}
                    onBlur={() => {
                      setEditingKey(null);
                      setRecordedKeys([]);
                    }}
                    readOnly
                    className="w-32 px-3 py-1.5 text-sm text-center rounded-md border border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 focus:outline-none"
                    autoFocus
                  />
                  <span className="text-xs text-gray-400">
                    Press Esc to cancel
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => setEditingKey(item.key)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-gray-50 dark:bg-gray-800 transition-colors"
                >
                  {formatShortcut(shortcuts[item.key])}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
        <div className="flex items-start gap-2">
          <Command className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5" />
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <p className="font-medium mb-1">Tips:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>
                Use modifier keys (Alt, Ctrl, Cmd, Shift) combined with another
                key
              </li>
              <li>
                Click on a shortcut to edit it, then press your desired key
                combination
              </li>
              <li>Shortcuts work globally, even when the app is minimized</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShortcutSettings;
