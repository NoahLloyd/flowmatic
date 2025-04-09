import React from "react";
import { Plus } from "lucide-react";

interface NoteFormProps {
  newNoteContent: string;
  setNewNoteContent: React.Dispatch<React.SetStateAction<string>>;
  handleCreateNote: () => Promise<void>;
  isSaving: boolean;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  newNoteRef: React.RefObject<HTMLInputElement>;
}

const NoteForm: React.FC<NoteFormProps> = ({
  newNoteContent,
  setNewNoteContent,
  handleCreateNote,
  isSaving,
  handleKeyDown,
  newNoteRef,
}) => {
  return (
    <div className="mb-6 flex gap-3 items-start">
      <input
        ref={newNoteRef}
        type="text"
        placeholder="Capture a new note... (Ctrl+Enter to save)"
        value={newNoteContent}
        onChange={(e) => setNewNoteContent(e.target.value)}
        onKeyDown={handleKeyDown}
        className="flex-1 p-3 h-[45px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 text-gray-800 dark:text-gray-200"
      />
      <button
        onClick={handleCreateNote}
        disabled={!newNoteContent.trim() || isSaving}
        className="px-4 py-2 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 h-[45px] min-w-[120px] justify-center"
      >
        <Plus className="w-5 h-5" />
        <span>Add Note</span>
      </button>
    </div>
  );
};

export default NoteForm;
