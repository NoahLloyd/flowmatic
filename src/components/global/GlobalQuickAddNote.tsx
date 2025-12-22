import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface GlobalQuickAddNoteProps {
  isOpen: boolean;
  onClose: () => void;
  onAddNote: (content: string) => Promise<void>;
}

const GlobalQuickAddNote: React.FC<GlobalQuickAddNoteProps> = ({
  isOpen,
  onClose,
  onAddNote,
}) => {
  const [noteContent, setNoteContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input when the modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setNoteContent("");
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();

    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "Enter" && noteContent.trim() && !isSubmitting) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!noteContent.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await onAddNote(noteContent.trim());
      onClose();
    } catch (error) {
      console.error("Failed to add note:", error);
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Floating Input */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="relative w-full max-w-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="flex items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <div className="w-3 h-3 rounded-full bg-blue-500 mr-3" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Quick Add Note
                </span>
              </div>
              <div className="p-4">
                <input
                  ref={inputRef}
                  type="text"
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="What's on your mind?"
                  disabled={isSubmitting}
                  className="w-full text-lg bg-transparent border-none focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  autoFocus
                />
              </div>
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 font-mono text-[10px]">
                    Enter
                  </kbd>
                  <span>to add</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 font-mono text-[10px]">
                    Esc
                  </kbd>
                  <span>to close</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default GlobalQuickAddNote;

