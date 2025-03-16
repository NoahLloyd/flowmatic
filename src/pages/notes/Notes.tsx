import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  StickyNote,
  Save,
  Plus,
  X,
  Check,
  Trash2,
  ArrowUpRight,
  Tag,
  Clock,
} from "lucide-react";

interface Note {
  id: string;
  content: string;
  created_at: string;
  is_processed: boolean;
  tags: string[];
}

const Notes: React.FC = () => {
  const { user, updateUserPreferences } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState({ type: "", text: "" });
  const [filterProcessed, setFilterProcessed] = useState(true);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [showTagInput, setShowTagInput] = useState<string | null>(null);
  const [newTag, setNewTag] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const newNoteRef = useRef<HTMLTextAreaElement>(null);

  // Load notes from user preferences
  useEffect(() => {
    if (user?.preferences?.quickNotes) {
      setNotes(user.preferences.quickNotes);

      // Extract all unique tags
      const allTags = user.preferences.quickNotes.flatMap(
        (note: Note) => note.tags || []
      );
      const uniqueTags = Array.from(new Set(allTags)) as string[];
      setAvailableTags(uniqueTags.sort());
    } else {
      // Initialize with an empty array if no notes exist
      setNotes([]);
    }
  }, [user]);

  // Focus the new note textarea when the component loads
  useEffect(() => {
    if (newNoteRef.current) {
      newNoteRef.current.focus();
    }
  }, []);

  // Focus the tag input when shown
  useEffect(() => {
    if (showTagInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showTagInput]);

  // Create a new note
  const handleCreateNote = () => {
    if (!newNoteContent.trim()) return;

    const newNote: Note = {
      id: Date.now().toString(),
      content: newNoteContent,
      created_at: new Date().toISOString(),
      is_processed: false,
      tags: [],
    };

    const updatedNotes = [newNote, ...notes];
    setNotes(updatedNotes);
    setNewNoteContent("");
    saveNotes(updatedNotes);

    // Refocus the textarea
    if (newNoteRef.current) {
      newNoteRef.current.focus();
    }
  };

  // Toggle the processed state of a note
  const handleToggleProcessed = (id: string) => {
    const updatedNotes = notes.map((note) =>
      note.id === id ? { ...note, is_processed: !note.is_processed } : note
    );
    setNotes(updatedNotes);
    saveNotes(updatedNotes);
  };

  // Delete a note
  const handleDeleteNote = (id: string) => {
    const updatedNotes = notes.filter((note) => note.id !== id);
    setNotes(updatedNotes);
    saveNotes(updatedNotes);
  };

  // Show tag input for a specific note
  const handleShowTagInput = (id: string) => {
    setShowTagInput(id);
    setNewTag("");
  };

  // Add a tag to a note
  const handleAddTag = (noteId: string) => {
    if (!newTag.trim()) {
      setShowTagInput(null);
      return;
    }

    const trimmedTag = newTag.trim().toLowerCase();

    const updatedNotes = notes.map((note) => {
      if (note.id === noteId) {
        const noteTags = note.tags || [];
        if (!noteTags.includes(trimmedTag)) {
          const updatedTags = [...noteTags, trimmedTag];
          return { ...note, tags: updatedTags };
        }
      }
      return note;
    });

    setNotes(updatedNotes);
    saveNotes(updatedNotes);

    // Update available tags
    if (!availableTags.includes(trimmedTag)) {
      setAvailableTags([...availableTags, trimmedTag].sort());
    }

    setShowTagInput(null);
    setNewTag("");
  };

  // Remove a tag from a note
  const handleRemoveTag = (noteId: string, tagToRemove: string) => {
    const updatedNotes = notes.map((note) => {
      if (note.id === noteId) {
        const updatedTags = (note.tags || []).filter(
          (tag) => tag !== tagToRemove
        );
        return { ...note, tags: updatedTags };
      }
      return note;
    });

    setNotes(updatedNotes);
    saveNotes(updatedNotes);
  };

  // Save notes to user preferences
  const saveNotes = async (notesToSave = notes) => {
    try {
      setIsSaving(true);
      setSaveMessage({ type: "", text: "" });

      const updatedPreferences = {
        ...user?.preferences,
        quickNotes: notesToSave,
      };

      await updateUserPreferences(updatedPreferences);

      setSaveMessage({
        type: "success",
        text: "Notes saved successfully!",
      });
    } catch (error) {
      console.error("Failed to save notes:", error);
      setSaveMessage({
        type: "error",
        text: "Failed to save notes. Please try again.",
      });
    } finally {
      setIsSaving(false);

      // Clear message after 3 seconds
      setTimeout(() => {
        setSaveMessage({ type: "", text: "" });
      }, 3000);
    }
  };

  // Format date for display - simplified to remove minutes/hours
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  // Filter notes based on current filters
  const filteredNotes = notes.filter((note) => {
    if (filterProcessed && note.is_processed) return false;
    if (tagFilter && (!note.tags || !note.tags.includes(tagFilter)))
      return false;
    return true;
  });

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit note on Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      handleCreateNote();
    }
  };

  // Handle tag input key down
  const handleTagKeyDown = (e: React.KeyboardEvent, noteId: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag(noteId);
    } else if (e.key === "Escape") {
      setShowTagInput(null);
    }
  };

  // Calculate most used tags
  const getPopularTags = () => {
    // Count occurrences of each tag
    const tagCounts = notes.reduce((counts, note) => {
      (note.tags || []).forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
      return counts;
    }, {} as Record<string, number>);

    // Sort tags by occurrence count and take top 5
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-900 dark:text-white flex items-center">
            <StickyNote className="w-6 h-6 mr-2" />
            Quick Notes
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Capture ideas quickly and process them later
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {notes.filter((n) => !n.is_processed).length} unprocessed
            </span>
            <button
              onClick={() => setFilterProcessed(!filterProcessed)}
              className={`text-sm px-3 py-1 rounded-md flex items-center gap-1 ${
                filterProcessed
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              {filterProcessed ? "Show all" : "Hide processed"}
            </button>
          </div>

          {availableTags.length > 0 && (
            <div className="relative inline-block">
              <select
                value={tagFilter || ""}
                onChange={(e) => setTagFilter(e.target.value || null)}
                className="appearance-none bg-gray-100 dark:bg-gray-800 border-0 text-sm py-1 pl-3 pr-8 rounded-md focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 text-gray-700 dark:text-gray-200"
              >
                <option value="">All tags</option>
                {availableTags.map((tag) => (
                  <option key={tag} value={tag}>
                    #{tag}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notification message */}
      {saveMessage.text && (
        <div
          className={`p-3 rounded-md text-sm flex items-center mb-6 ${
            saveMessage.type === "success"
              ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800"
          }`}
        >
          {saveMessage.type === "success" ? (
            <Save className="w-4 h-4 mr-2 text-green-500 dark:text-green-400" />
          ) : (
            <X className="w-4 h-4 mr-2 text-red-500 dark:text-red-400" />
          )}
          {saveMessage.text}
        </div>
      )}

      {/* Create new note */}
      <div className="mb-6 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex">
          <textarea
            ref={newNoteRef}
            placeholder="Type to capture a new note... (Ctrl+Enter to save)"
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 min-h-[80px] p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 text-gray-800 dark:text-gray-200"
          />
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={handleCreateNote}
            disabled={!newNoteContent.trim()}
            className="px-3 py-1.5 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-sm rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            Capture
          </button>
        </div>
      </div>

      {/* Notes list */}
      <div className="space-y-3">
        {filteredNotes.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            {notes.length === 0
              ? "No notes yet. Start capturing your ideas!"
              : "No notes match your current filters."}
          </div>
        ) : (
          filteredNotes.map((note) => (
            <div
              key={note.id}
              className={`p-4 rounded-lg border ${
                note.is_processed
                  ? "bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800/50 text-gray-500 dark:text-gray-400"
                  : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100"
              }`}
            >
              <div className="flex justify-between">
                <div className="flex-1">
                  <p className="whitespace-pre-wrap break-words">
                    {note.content}
                  </p>

                  {/* Tags */}
                  {note.tags && note.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {note.tags.map((tag) => (
                        <div
                          key={tag}
                          className="flex items-center text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full"
                        >
                          #{tag}
                          <button
                            onClick={() => handleRemoveTag(note.id, tag)}
                            className="ml-1 text-gray-400 hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Date and quick tags */}
                  <div className="mt-2 flex items-center flex-wrap gap-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">
                      {formatDate(note.created_at)}
                    </span>

                    {/* Quick tag buttons - show 5 most popular tags */}
                    {getPopularTags()
                      .filter((tag) => !note.tags?.includes(tag))
                      .map((tag) => (
                        <button
                          key={tag}
                          onClick={() => {
                            const updatedNotes = notes.map((n) => {
                              if (n.id === note.id) {
                                const updatedTags = [...(n.tags || []), tag];
                                return { ...n, tags: updatedTags };
                              }
                              return n;
                            });
                            setNotes(updatedNotes);
                            saveNotes(updatedNotes);
                          }}
                          className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                        >
                          +{tag}
                        </button>
                      ))}
                  </div>
                </div>

                <div className="ml-4 flex items-center gap-2">
                  <button
                    onClick={() => handleToggleProcessed(note.id)}
                    className={`p-1.5 rounded-md ${
                      note.is_processed
                        ? "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-blue-500 dark:hover:text-blue-400"
                        : "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800/50"
                    }`}
                    title={
                      note.is_processed
                        ? "Mark as unprocessed"
                        : "Mark as processed"
                    }
                  >
                    {note.is_processed ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    onClick={() => handleShowTagInput(note.id)}
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
              </div>

              {/* Tag input - improved with dropdown of existing tags */}
              {showTagInput === note.id && (
                <div className="mt-2">
                  <div className="relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => handleTagKeyDown(e, note.id)}
                      placeholder="Add a tag... (or select one below)"
                      className="w-full p-1.5 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500"
                    />
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1">
                      <button
                        onClick={() => handleAddTag(note.id)}
                        className="p-0.5 text-green-500 hover:text-green-700 dark:hover:text-green-300"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowTagInput(null)}
                        className="p-0.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Quick tag selection */}
                  {availableTags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {availableTags
                        .filter((tag) => !note.tags?.includes(tag))
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
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Notes;
