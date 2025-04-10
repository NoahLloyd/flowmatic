import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface QuickAddNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddNote: (content: string) => Promise<void>;
}

const QuickAddNoteModal: React.FC<QuickAddNoteModalProps> = ({
  isOpen,
  onClose,
  onAddNote,
}) => {
  const [noteContent, setNoteContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus the textarea when the modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setNoteContent("");
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Prevent these keypress events from propagating to avoid navigation conflicts
    e.stopPropagation();

    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "Enter") {
      if (e.shiftKey) {
        // Allow Shift+Enter for new lines, do nothing special here
        return;
      } else if (noteContent.trim()) {
        // Regular Enter submits the note and closes modal
        e.preventDefault();
        onClose(); // Close immediately
        onAddNote(noteContent); // Let it run in background
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Overlay with blur effect */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose} // Allow clicking outside to close
          />

          {/* Modal container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-md mx-4 overflow-hidden bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-800"
            onClick={(e) => e.stopPropagation()} // Prevent clicks inside from closing
          >
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-sm font-medium text-gray-900 dark:text-white">
                Quick Add Note
              </h2>
              <button
                onClick={onClose}
                className="p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4">
              <textarea
                ref={textareaRef}
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="What's on your mind?"
                className="w-full h-32 p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 text-gray-800 dark:text-gray-200 text-sm resize-none"
                autoFocus
              />

              <div className="flex justify-between items-center mt-3 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono">
                    Shift
                  </kbd>
                  <span>+</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono">
                    Enter
                  </kbd>
                  <span>for new line</span>
                </div>

                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono">
                    Enter
                  </kbd>
                  <span>to save</span>
                </div>

                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono">
                    Esc
                  </kbd>
                  <span>to cancel</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default QuickAddNoteModal;
