import React from "react";
import { Edit, ArrowUpRight, Check, Tag, Trash2, X } from "lucide-react";
import type { Note } from "../Notes";

interface NoteCardProps {
  note: Note;
  formatDate: (date: string) => string;
  handleToggleProcessed: (id: string) => void;
  handleShowTagInput: (id: string, e?: React.MouseEvent) => void;
  handleDeleteNote: (id: string) => void;
  handleRemoveTag: (
    noteId: string,
    tagToRemove: string,
    e?: React.MouseEvent
  ) => void;
  showTagInput: string | null;
  newTag: string;
  setNewTag: React.Dispatch<React.SetStateAction<string>>;
  handleTagKeyDown: (e: React.KeyboardEvent, noteId: string) => void;
  handleAddTag: (noteId: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  availableTags: string[];
  setDraggedNote: React.Dispatch<React.SetStateAction<string | null>>;
  isList?: boolean;
  editingNoteId?: string | null;
  editedContent?: string;
  setEditedContent?: React.Dispatch<React.SetStateAction<string>>;
  handleStartEditing?: (noteId: string) => void;
  handleSaveEditedNote?: (noteId: string) => void;
  handleCancelEditing?: () => void;
}

const NoteCard: React.FC<NoteCardProps> = ({
  note,
  formatDate,
  handleToggleProcessed,
  handleShowTagInput,
  handleDeleteNote,
  handleRemoveTag,
  showTagInput,
  newTag,
  setNewTag,
  handleTagKeyDown,
  handleAddTag,
  inputRef,
  availableTags,
  setDraggedNote,
  isList = false,
  editingNoteId,
  editedContent,
  setEditedContent,
  handleStartEditing,
  handleSaveEditedNote,
  handleCancelEditing,
}) => {
  const isEditing = editingNoteId === note.id;

  return (
    <div
      className={`group relative p-4 rounded-lg border transition-all ${
        note.is_processed
          ? "bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800/50 text-gray-600 dark:text-gray-400"
          : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100"
      } hover:shadow-md dark:hover:shadow-gray-900/30 ${
        isList ? "w-full" : ""
      }`}
      draggable={!isEditing}
      onDragStart={() => !isEditing && setDraggedNote(note.id)}
      onDragEnd={() => !isEditing && setDraggedNote(null)}
    >
      {/* Note content */}
      <div className="flex flex-col h-full">
        {isEditing ? (
          <div className="mb-3">
            <textarea
              value={editedContent}
              onChange={(e) =>
                setEditedContent && setEditedContent(e.target.value)
              }
              className="w-full border border-gray-200 dark:border-gray-700 rounded-md p-2 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 min-h-[100px]"
              autoFocus
            />
            <div className="flex gap-2 mt-2 justify-end">
              <button
                onClick={handleCancelEditing}
                className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleSaveEditedNote && handleSaveEditedNote(note.id)
                }
                className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <p
            className="flex-grow whitespace-pre-wrap break-words mb-3 text-base cursor-pointer"
            onClick={() => handleStartEditing && handleStartEditing(note.id)}
          >
            {note.content}
          </p>
        )}

        <div className="mt-auto">
          {/* Date and tags on same line */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
              {formatDate(note.created_at)}
            </span>

            {/* Tags */}
            {note.tags && note.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {note.tags.map((tag) => (
                  <div
                    key={tag}
                    className="flex items-center text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full border border-gray-200 dark:border-gray-700"
                  >
                    #{tag}
                    <button
                      onClick={(e) => handleRemoveTag(note.id, tag, e)}
                      className="ml-1 text-gray-400 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions - only visible on hover */}
      {!isEditing && (
        <div className="absolute right-2 top-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => handleStartEditing && handleStartEditing(note.id)}
            className="p-1.5 bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 rounded-md"
            title="Edit note"
          >
            <Edit className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleToggleProcessed(note.id)}
            className={`p-1.5 rounded-md ${
              note.is_processed
                ? "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-blue-500 dark:hover:text-blue-400"
                : "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800/50"
            }`}
            title={
              note.is_processed ? "Mark as unprocessed" : "Mark as processed"
            }
          >
            {note.is_processed ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <Check className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={(e) => handleShowTagInput(note.id, e)}
            className="p-1.5 bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 rounded-md"
            title="Add tag"
          >
            <Tag className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleDeleteNote(note.id)}
            className="p-1.5 bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-red-500 dark:hover:text-red-400 rounded-md"
            title="Delete note"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tag input overlay */}
      {showTagInput === note.id && (
        <div className="absolute inset-0 bg-white/95 dark:bg-gray-900/95 z-10 rounded-lg p-4 flex flex-col">
          <div className="mb-3 font-medium text-sm text-gray-800 dark:text-gray-200">
            Add a tag
          </div>
          <div className="flex-grow relative">
            <input
              ref={inputRef}
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => handleTagKeyDown(e, note.id)}
              placeholder="Enter a tag name..."
              className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800"
              autoFocus
            />
          </div>

          {/* Quick tag selection */}
          {availableTags.length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Popular tags:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {availableTags
                  .filter((tag) => !note.tags?.includes(tag))
                  .slice(0, 10)
                  .map((tag) => (
                    <button
                      key={tag}
                      onClick={() => {
                        setNewTag(tag);
                        handleAddTag(note.id);
                      }}
                      className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                    >
                      #{tag}
                    </button>
                  ))}
              </div>
            </div>
          )}

          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => handleShowTagInput("", undefined)}
              className="p-1.5 px-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={() => handleAddTag(note.id)}
              className="p-1.5 px-3 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm rounded-md"
            >
              Add Tag
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoteCard;
