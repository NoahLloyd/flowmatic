import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTimezone } from "../../context/TimezoneContext";
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
  Search,
  Grid,
  List,
  Filter,
  Archive,
  Star,
  AlignLeft,
  LayoutGrid,
  Eye,
  EyeOff,
} from "lucide-react";
import { api } from "../../utils/api";

interface Note {
  id: string;
  content: string;
  created_at: string;
  is_processed: boolean;
  tags: string[];
}

interface Bucket {
  id: string;
  name: string;
  icon: React.ReactNode;
  filter: (note: Note) => boolean;
  color: string;
}

const Notes: React.FC = () => {
  const { user } = useAuth();
  const { formatDate: formatDateWithTimezone } = useTimezone();
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState({ type: "", text: "" });
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [showTagInput, setShowTagInput] = useState<string | null>(null);
  const [newTag, setNewTag] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeBucket, setActiveBucket] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortOrder, setSortOrder] = useState<
    "newest" | "oldest" | "alphabetical"
  >("newest");
  const [draggedNote, setDraggedNote] = useState<string | null>(null);
  const [showProcessed, setShowProcessed] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const newNoteRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const columnRefs = useRef<HTMLDivElement[]>([]);

  // Number of columns in masonry layout
  const getColumnCount = () => {
    if (typeof window === "undefined") return 1;
    if (window.innerWidth < 640) return 1; // sm
    if (window.innerWidth < 768) return 2; // md
    if (window.innerWidth < 1024) return 3; // lg
    return 4; // xl and above
  };

  const [columnCount, setColumnCount] = useState(getColumnCount());

  // Update column count on window resize
  useEffect(() => {
    const handleResize = () => {
      setColumnCount(getColumnCount());
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Load notes from API
  useEffect(() => {
    const fetchNotes = async () => {
      try {
        setIsLoading(true);
        const fetchedNotes = await api.getNotes();
        setNotes(fetchedNotes);

        // Extract all unique tags
        const allTags = fetchedNotes.flatMap((note: Note) => note.tags || []);
        const uniqueTags = Array.from(new Set(allTags)) as string[];
        setAvailableTags(uniqueTags.sort());
      } catch (error) {
        console.error("Failed to fetch notes:", error);
        setSaveMessage({
          type: "error",
          text: "Failed to load notes. Please try again.",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotes();
  }, []);

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

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent 'n' from being added to input when using navigation shortcut
      if (
        e.key === "n" &&
        (e.target as HTMLElement).tagName !== "TEXTAREA" &&
        (e.target as HTMLElement).tagName !== "INPUT"
      ) {
        e.preventDefault();
        if (newNoteRef.current) {
          newNoteRef.current.focus();
        }
      }

      // Handle Escape key to blur active element
      if (e.key === "Escape") {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement) {
          activeElement.blur();
          setShowTagInput(null);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Create buckets based on available tags and status
  const getBuckets = useCallback((): Bucket[] => {
    const popularTags = getPopularTags().slice(0, 3);

    const defaultBuckets: Bucket[] = [
      {
        id: "all",
        name: "All Notes",
        icon: <StickyNote className="w-4 h-4" />,
        filter: () => true,
        color: "bg-gray-100 dark:bg-gray-800",
      },
    ];

    // Add buckets for popular tags
    const tagBuckets = popularTags.map((tag) => ({
      id: `tag-${tag}`,
      name: `#${tag}`,
      icon: <Tag className="w-4 h-4" />,
      filter: (note: Note) => note.tags?.includes(tag) || false,
      color: "bg-yellow-100 dark:bg-yellow-900/30",
    }));

    return [...defaultBuckets, ...tagBuckets];
  }, [notes, availableTags]);

  // Create a new note
  const handleCreateNote = async () => {
    if (!newNoteContent.trim()) return;

    try {
      setIsSaving(true);
      setSaveMessage({ type: "", text: "" });

      const newNote = await api.createNote({
        content: newNoteContent,
        tags: [],
      });

      setNotes([newNote, ...notes]);
      setNewNoteContent("");

      setSaveMessage({
        type: "success",
        text: "Note saved successfully!",
      });
    } catch (error) {
      console.error("Failed to create note:", error);
      setSaveMessage({
        type: "error",
        text: "Failed to save note. Please try again.",
      });
    } finally {
      setIsSaving(false);

      // Clear message after 3 seconds
      setTimeout(() => {
        setSaveMessage({ type: "", text: "" });
      }, 3000);

      // Refocus the textarea
      if (newNoteRef.current) {
        newNoteRef.current.focus();
      }
    }
  };

  // Toggle the processed state of a note
  const handleToggleProcessed = async (id: string) => {
    try {
      setIsSaving(true);

      const noteToUpdate = notes.find((note) => note.id === id);
      if (!noteToUpdate) return;

      const updatedNote = await api.updateNote(id, {
        is_processed: !noteToUpdate.is_processed,
      });

      const updatedNotes = notes.map((note) =>
        note.id === id ? updatedNote : note
      );

      setNotes(updatedNotes);
    } catch (error) {
      console.error("Failed to update note:", error);
      setSaveMessage({
        type: "error",
        text: "Failed to update note. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete a note
  const handleDeleteNote = async (id: string) => {
    try {
      setIsSaving(true);

      await api.deleteNote(id);

      const updatedNotes = notes.filter((note) => note.id !== id);
      setNotes(updatedNotes);

      // Recalculate available tags
      const allTags = updatedNotes.flatMap((note) => note.tags || []);
      const uniqueTags = Array.from(new Set(allTags)) as string[];
      setAvailableTags(uniqueTags.sort());
    } catch (error) {
      console.error("Failed to delete note:", error);
      setSaveMessage({
        type: "error",
        text: "Failed to delete note. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Show tag input for a specific note
  const handleShowTagInput = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setShowTagInput(id);
    setNewTag("");
  };

  // Add a tag to a note
  const handleAddTag = async (noteId: string) => {
    if (!newTag.trim()) {
      setShowTagInput(null);
      return;
    }

    try {
      setIsSaving(true);

      const trimmedTag = newTag.trim().toLowerCase();
      const noteToUpdate = notes.find((note) => note.id === noteId);

      if (!noteToUpdate) return;

      const noteTags = noteToUpdate.tags || [];
      if (noteTags.includes(trimmedTag)) {
        setShowTagInput(null);
        setNewTag("");
        return;
      }

      const updatedTags = [...noteTags, trimmedTag];

      const updatedNote = await api.updateNote(noteId, {
        tags: updatedTags,
      });

      const updatedNotes = notes.map((note) =>
        note.id === noteId ? updatedNote : note
      );

      setNotes(updatedNotes);

      // Update available tags
      if (!availableTags.includes(trimmedTag)) {
        setAvailableTags([...availableTags, trimmedTag].sort());
      }
    } catch (error) {
      console.error("Failed to add tag:", error);
      setSaveMessage({
        type: "error",
        text: "Failed to add tag. Please try again.",
      });
    } finally {
      setIsSaving(false);
      setShowTagInput(null);
      setNewTag("");
    }
  };

  // Remove a tag from a note
  const handleRemoveTag = async (
    noteId: string,
    tagToRemove: string,
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();

    try {
      setIsSaving(true);

      const noteToUpdate = notes.find((note) => note.id === noteId);
      if (!noteToUpdate) return;

      const updatedTags = (noteToUpdate.tags || []).filter(
        (tag) => tag !== tagToRemove
      );

      const updatedNote = await api.updateNote(noteId, {
        tags: updatedTags,
      });

      const updatedNotes = notes.map((note) =>
        note.id === noteId ? updatedNote : note
      );

      setNotes(updatedNotes);

      // Recalculate available tags
      const allTags = updatedNotes.flatMap((note) => note.tags || []);
      const uniqueTags = Array.from(new Set(allTags)) as string[];
      setAvailableTags(uniqueTags.sort());
    } catch (error) {
      console.error("Failed to remove tag:", error);
      setSaveMessage({
        type: "error",
        text: "Failed to remove tag. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Add tag from bucket to note via drag and drop
  const handleDropOnBucket = async (bucketId: string, noteId: string) => {
    if (!noteId || !bucketId) return;

    // Handle tag buckets
    if (bucketId.startsWith("tag-")) {
      const tag = bucketId.replace("tag-", "");
      const noteToUpdate = notes.find((note) => note.id === noteId);

      if (!noteToUpdate || noteToUpdate.tags?.includes(tag)) return;

      try {
        setIsSaving(true);
        const updatedTags = [...(noteToUpdate.tags || []), tag];

        const updatedNote = await api.updateNote(noteId, {
          tags: updatedTags,
        });

        const updatedNotes = notes.map((note) =>
          note.id === noteId ? updatedNote : note
        );

        setNotes(updatedNotes);
      } catch (error) {
        console.error("Failed to add tag via bucket:", error);
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return formatDateWithTimezone(dateString);
  };

  // Filter and sort notes
  const getFilteredAndSortedNotes = () => {
    // Apply bucket filter
    let filtered = notes;

    if (activeBucket !== "all") {
      const bucket = getBuckets().find((b) => b.id === activeBucket);
      if (bucket) {
        filtered = notes.filter(bucket.filter);
      }
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (note) =>
          note.content.toLowerCase().includes(query) ||
          note.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Apply processed filter
    if (!showProcessed) {
      filtered = filtered.filter((note) => !note.is_processed);
    }

    // Apply sorting
    return [...filtered].sort((a, b) => {
      if (sortOrder === "newest") {
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      } else if (sortOrder === "oldest") {
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      } else {
        return a.content.localeCompare(b.content);
      }
    });
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit note on Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleCreateNote();
    }
  };

  // Handle tag input key down
  const handleTagKeyDown = (e: React.KeyboardEvent, noteId: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag(noteId);
    } else if (e.key === "Escape") {
      e.preventDefault();
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

    // Sort tags by occurrence count
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);
  };

  // Distribute notes to columns (true masonry layout)
  const distributeNotesToColumns = (
    notes: Note[],
    columnCount: number
  ): Note[][] => {
    // Initialize columns
    const columns: Note[][] = Array.from({ length: columnCount }, () => []);

    // Distribute notes to the column with the fewest notes
    notes.forEach((note) => {
      // Find column with fewest notes
      const columnIndex = columns
        .map((column, index) => ({ index, length: column.length }))
        .sort((a, b) => a.length - b.length)[0].index;

      columns[columnIndex].push(note);
    });

    return columns;
  };

  const filteredNotes = getFilteredAndSortedNotes();
  const noteColumns = distributeNotesToColumns(filteredNotes, columnCount);

  // Setup column refs
  useEffect(() => {
    // Reset column refs when column count changes
    columnRefs.current = Array(columnCount).fill(null);
  }, [columnCount]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Compact Note Creation */}
      <div className="mb-6 flex gap-3 items-start">
        <textarea
          ref={newNoteRef}
          placeholder="Capture a new note... (Ctrl+Enter to save)"
          value={newNoteContent}
          onChange={(e) => setNewNoteContent(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 p-3 h-[45px] max-h-[45px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 text-gray-800 dark:text-gray-200"
        />
        <button
          onClick={handleCreateNote}
          disabled={!newNoteContent.trim() || isSaving}
          className="px-4 py-2 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 h-[45px]"
        >
          <Plus className="w-5 h-5" />
        </button>
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

      {/* Filter and Sorting Bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3 flex-grow">
          <div className="relative flex-grow max-w-xs">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 text-gray-800 dark:text-gray-200"
            />
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400" />
          </div>

          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {filteredNotes.length}{" "}
            {filteredNotes.length === 1 ? "note" : "notes"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Toggle for processed notes */}
          <button
            onClick={() => setShowProcessed(!showProcessed)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm
              ${
                showProcessed
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              }`}
          >
            {showProcessed ? (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Showing processed</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Hiding processed</span>
              </>
            )}
          </button>

          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-sm py-1.5 px-3 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 text-gray-800 dark:text-gray-200"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="alphabetical">Alphabetical</option>
          </select>

          <div className="flex bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 ${
                viewMode === "grid"
                  ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  : "text-gray-500 dark:text-gray-400"
              }`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 ${
                viewMode === "list"
                  ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  : "text-gray-500 dark:text-gray-400"
              }`}
              title="List view"
            >
              <AlignLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Category Buckets */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        {getBuckets().map((bucket) => (
          <div
            key={bucket.id}
            className={`relative p-3 rounded-lg cursor-pointer transition-all ${
              activeBucket === bucket.id
                ? `${bucket.color} ring-2 ring-gray-400 dark:ring-gray-600`
                : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/70"
            }`}
            onClick={() => setActiveBucket(bucket.id)}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add(
                "bg-blue-50",
                "dark:bg-blue-900/20"
              );
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove(
                "bg-blue-50",
                "dark:bg-blue-900/20"
              );
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove(
                "bg-blue-50",
                "dark:bg-blue-900/20"
              );
              if (draggedNote) {
                handleDropOnBucket(bucket.id, draggedNote);
                setDraggedNote(null);
              }
            }}
          >
            <div className="flex items-center mb-1">
              <span className="mr-2 text-gray-700 dark:text-gray-300">
                {bucket.icon}
              </span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {bucket.name}
              </span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {notes.filter(bucket.filter).length} notes
            </div>
          </div>
        ))}
      </div>

      {/* Notes Grid - True Masonry Layout */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Loading notes...
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          {notes.length === 0
            ? "No notes yet. Start capturing your ideas!"
            : "No notes match your current filters."}
        </div>
      ) : viewMode === "grid" ? (
        // True masonry layout
        <div className="flex gap-4">
          {noteColumns.map((column, columnIndex) => (
            <div
              key={columnIndex}
              className="flex-1 flex flex-col gap-4"
              ref={(el) => {
                if (el) columnRefs.current[columnIndex] = el;
              }}
            >
              {column.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  formatDate={formatDate}
                  handleToggleProcessed={handleToggleProcessed}
                  handleShowTagInput={handleShowTagInput}
                  handleDeleteNote={handleDeleteNote}
                  handleRemoveTag={handleRemoveTag}
                  showTagInput={showTagInput}
                  newTag={newTag}
                  setNewTag={setNewTag}
                  handleTagKeyDown={handleTagKeyDown}
                  handleAddTag={handleAddTag}
                  inputRef={inputRef}
                  availableTags={availableTags}
                  setDraggedNote={setDraggedNote}
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        // List view
        <div className="space-y-4">
          {filteredNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              formatDate={formatDate}
              handleToggleProcessed={handleToggleProcessed}
              handleShowTagInput={handleShowTagInput}
              handleDeleteNote={handleDeleteNote}
              handleRemoveTag={handleRemoveTag}
              showTagInput={showTagInput}
              newTag={newTag}
              setNewTag={setNewTag}
              handleTagKeyDown={handleTagKeyDown}
              handleAddTag={handleAddTag}
              inputRef={inputRef}
              availableTags={availableTags}
              setDraggedNote={setDraggedNote}
              isList={true}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Extracted note card component for reuse between grid and list views
const NoteCard: React.FC<{
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
}> = ({
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
}) => {
  return (
    <div
      className={`group relative p-4 rounded-lg border transition-all ${
        note.is_processed
          ? "bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800/50 text-gray-600 dark:text-gray-400"
          : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100"
      } hover:shadow-md dark:hover:shadow-gray-900/30 ${
        isList ? "w-full" : ""
      }`}
      draggable
      onDragStart={() => setDraggedNote(note.id)}
      onDragEnd={() => setDraggedNote(null)}
    >
      {/* Note content */}
      <div className="flex flex-col h-full">
        <p className="flex-grow whitespace-pre-wrap break-words mb-3 text-base">
          {note.content}
        </p>

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
                    className="flex items-center text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full"
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
      <div className="absolute right-2 top-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
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

export default Notes;
