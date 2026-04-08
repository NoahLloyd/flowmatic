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
  ChevronRight,
  Edit,
  LayoutPanelTop,
} from "lucide-react";
import { api } from "../../utils/api";

import NoteForm from "./components/NoteForm";
import NoteFilters from "./components/NoteFilters";
import TagBuckets from "./components/TagBuckets";
import NoteCard from "./components/NoteCard";

export interface Note {
  id: string;
  content: string;
  created_at: string;
  is_processed: boolean;
  tags: string[];
}

export interface Bucket {
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
  const [showAllTags, setShowAllTags] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const newNoteRef = useRef<HTMLInputElement>(null);
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

  // Focus the new note textarea when clicked into, not on page load
  // (auto-focusing on mount steals focus from keyboard navigation)

  // Focus the tag input when shown
  useEffect(() => {
    if (showTagInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showTagInput]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Let 'n' pass through for sidebar navigation — don't intercept it


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
    const popularTags = getPopularTags().slice(0, 5);

    // Check if active bucket is a tag that isn't in popularTags
    const isActiveTagBucket =
      activeBucket.startsWith("tag-") &&
      !popularTags.includes(activeBucket.replace("tag-", ""));

    // If active bucket is a tag that's not in popularTags, add it
    let tagsToInclude = [...popularTags];
    if (isActiveTagBucket) {
      const activeTag = activeBucket.replace("tag-", "");
      tagsToInclude = [
        activeTag,
        ...popularTags.filter((tag) => tag !== activeTag),
      ];
    }

    const defaultBuckets: Bucket[] = [
      {
        id: "all",
        name: "All Notes",
        icon: <LayoutPanelTop className="w-4 h-4" />,
        filter: () => true,
        color:
          "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
      },
    ];

    // Add buckets for popular tags and active tag if it's not already included
    const tagBuckets = tagsToInclude.map((tag) => ({
      id: `tag-${tag}`,
      name: `#${tag}`,
      icon: <Tag className="w-4 h-4" />,
      filter: (note: Note) => note.tags?.includes(tag) || false,
      color: "bg-yellow-100 dark:bg-yellow-900/30",
    }));

    return [...defaultBuckets, ...tagBuckets];
  }, [notes, availableTags, activeBucket]);

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
      if (activeBucket.startsWith("tag-")) {
        // Handle tag filtering directly
        const tagName = activeBucket.replace("tag-", "");
        filtered = notes.filter((note) => note.tags?.includes(tagName));
      } else {
        // Use bucket filter for other buckets
        const bucket = getBuckets().find((b) => b.id === activeBucket);
        if (bucket) {
          filtered = notes.filter(bucket.filter);
        }
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
    const columns: Note[][] = Array.from(
      { length: columnCount },
      () => [] as Note[]
    );

    // Initialize column heights
    const columnHeights: number[] = Array(columnCount).fill(0);

    // Estimate height based on content
    const estimateNoteHeight = (note: Note): number => {
      const contentLength = note.content.length;
      const tagCount = note.tags?.length || 0;

      // Base height + content height + tag height
      return 100 + Math.ceil(contentLength / 2) + tagCount * 10;
    };

    // Distribute notes to the column with the shortest height
    notes.forEach((note) => {
      // Find column with shortest height
      const shortestColumnIndex = columnHeights
        .map((height, index) => ({ index, height }))
        .sort((a, b) => a.height - b.height)[0].index;

      // Add note to the shortest column
      columns[shortestColumnIndex].push(note);

      // Update the column height
      columnHeights[shortestColumnIndex] += estimateNoteHeight(note);
    });

    return columns;
  };

  // Start editing a note
  const handleStartEditing = (noteId: string) => {
    const note = notes.find((n) => n.id === noteId);
    if (note) {
      setEditingNoteId(noteId);
      setEditedContent(note.content);
    }
  };

  // Save edited note
  const handleSaveEditedNote = async (noteId: string) => {
    if (!editedContent.trim()) {
      return;
    }

    const noteToUpdate = notes.find((n) => n.id === noteId);
    if (!noteToUpdate) return;

    try {
      setIsSaving(true);
      const updatedNote = { ...noteToUpdate, content: editedContent.trim() };
      await api.updateNote(noteId, updatedNote);

      // Update local state
      const updatedNotes = notes.map((n) =>
        n.id === noteId ? { ...n, content: editedContent.trim() } : n
      );
      setNotes(updatedNotes);
      setEditingNoteId(null);
      setEditedContent("");
    } catch (error) {
      console.error("Failed to update note:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel editing
  const handleCancelEditing = () => {
    setEditingNoteId(null);
    setEditedContent("");
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
      {/* Replace the old form with the NoteForm component */}
      <NoteForm
        newNoteContent={newNoteContent}
        setNewNoteContent={setNewNoteContent}
        handleCreateNote={handleCreateNote}
        isSaving={isSaving}
        handleKeyDown={handleKeyDown}
        newNoteRef={newNoteRef}
      />

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

      {/* Replace the old filter and sorting bar with the NoteFilters component */}
      <NoteFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchInputRef={searchInputRef}
        filteredNoteCount={filteredNotes.length}
        showProcessed={showProcessed}
        setShowProcessed={setShowProcessed}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        viewMode={viewMode}
        setViewMode={setViewMode}
        saveMessage={saveMessage}
      />

      {/* Replace Category Buckets with TagBuckets component */}
      <TagBuckets
        buckets={getBuckets()}
        activeBucket={activeBucket}
        setActiveBucket={setActiveBucket}
        availableTags={availableTags}
        notes={notes}
        handleDropOnBucket={handleDropOnBucket}
        draggedNote={draggedNote}
        showAllTags={showAllTags}
        setShowAllTags={setShowAllTags}
      />

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
                  editingNoteId={editingNoteId}
                  editedContent={editedContent}
                  setEditedContent={setEditedContent}
                  handleStartEditing={handleStartEditing}
                  handleSaveEditedNote={handleSaveEditedNote}
                  handleCancelEditing={handleCancelEditing}
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
              editingNoteId={editingNoteId}
              editedContent={editedContent}
              setEditedContent={setEditedContent}
              handleStartEditing={handleStartEditing}
              handleSaveEditedNote={handleSaveEditedNote}
              handleCancelEditing={handleCancelEditing}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Notes;
