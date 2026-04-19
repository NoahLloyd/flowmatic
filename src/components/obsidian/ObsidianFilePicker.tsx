import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, FileText } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (file: string) => void;
  /** Paths already attached; these are hidden from the list. */
  excludeFiles?: string[];
}

/**
 * Minimal autocomplete picker over the vault's markdown files. Uses the main
 * process `obsidian:list-files` IPC to enumerate the vault.
 */
const ObsidianFilePicker: React.FC<Props> = ({
  open,
  onClose,
  onPick,
  excludeFiles = [],
}) => {
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setError(null);
    setFiles(null);
    const api = window.electron?.obsidian;
    if (!api?.listFiles) {
      setError("Obsidian integration unavailable");
      return;
    }
    api.listFiles().then((res) => {
      if ("files" in res) {
        setFiles(res.files);
      } else {
        setError(res.error);
      }
    });
    // Focus the search input once the modal opens
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const results = useMemo(() => {
    if (!files) return [];
    const excl = new Set(excludeFiles);
    const available = files.filter((f) => !excl.has(f));
    const q = query.trim().toLowerCase();
    if (!q) return available.slice(0, 50);
    return available
      .filter((f) => f.toLowerCase().includes(q))
      .slice(0, 50);
  }, [files, query, excludeFiles]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Attach Obsidian note
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            } else if (e.key === "Enter" && results[0]) {
              e.preventDefault();
              onPick(results[0]);
            }
          }}
          placeholder="Search notes..."
          className="w-full px-4 py-3 bg-transparent text-sm text-gray-800 dark:text-gray-200 focus:outline-none border-b border-gray-200 dark:border-gray-800"
        />

        <div className="max-h-80 overflow-y-auto">
          {error && (
            <p className="p-4 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          {!error && files === null && (
            <p className="p-4 text-sm text-gray-500 dark:text-gray-400">
              Loading vault...
            </p>
          )}
          {!error && files !== null && results.length === 0 && (
            <p className="p-4 text-sm text-gray-500 dark:text-gray-400">
              No matching notes.
            </p>
          )}
          {results.map((file) => (
            <button
              key={file}
              onClick={() => onPick(file)}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800/60 last:border-b-0 font-mono"
            >
              {file.replace(/\.md$/, "")}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ObsidianFilePicker;
