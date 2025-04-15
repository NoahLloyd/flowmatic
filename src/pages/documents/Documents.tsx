import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { v4 as uuidv4 } from "uuid";
import Editor from "./Editor";
import { api } from "../../utils/api";
import { Document } from "../../types/Document";
import { useTimezone } from "../../context/TimezoneContext";

// Type to represent backend document response
interface ApiDocument extends Omit<Document, "created_at" | "updated_at"> {
  created_at?: string;
  updated_at?: string;
}

// Sort options for documents
type SortOption = "updated_at" | "created_at" | "title";

const Documents = () => {
  // State for managing documents
  const [documents, setDocuments] = useState<Document[]>([]);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [newDocTitle, setNewDocTitle] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Editing state for document titles
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState<string>("");

  // Publication status handling
  const [isPublicationMenuOpen, setIsPublicationMenuOpen] = useState(false);

  // Sort options state
  const [sortBy, setSortBy] = useState<SortOption>("updated_at");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  // Editor ref for focusing
  const editorRef = useRef<any>(null);

  // Get timezone utilities
  const { formatDateTime } = useTimezone();

  // Format date with fallback
  const formatDocumentDate = (date: Date | string | undefined) => {
    try {
      if (!date) return "No date";

      // Log the actual date value we're trying to parse
      console.log("Formatting date:", date, typeof date);

      // Convert to date object and format
      const dateObj = typeof date === "string" ? new Date(date) : date;
      if (!isNaN(dateObj.getTime())) {
        return dateObj.toLocaleString();
      }

      // If parsing fails, just return the raw string
      return typeof date === "string" ? date : "Invalid date";
    } catch (err) {
      console.error("Date formatting error:", err);
      return "Date unavailable";
    }
  };

  // Get publication status display text
  const getPublicationStatusText = (
    status?: "unpublished" | "hidden" | "live"
  ) => {
    switch (status) {
      case "live":
        return "Published - Live";
      case "hidden":
        return "Published - Hidden";
      case "unpublished":
      default:
        return "Not Published";
    }
  };

  // Get publication status icon
  const getPublicationStatusIcon = (
    status?: "unpublished" | "hidden" | "live"
  ) => {
    switch (status) {
      case "live":
        return (
          <svg
            className="h-4 w-4 text-green-500"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        );
      case "hidden":
        return (
          <svg
            className="h-4 w-4 text-yellow-500"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
              clipRule="evenodd"
            />
            <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
          </svg>
        );
      case "unpublished":
      default:
        return (
          <svg
            className="h-4 w-4 text-gray-500"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
    }
  };

  // Load documents from API on initial render
  useEffect(() => {
    const fetchDocuments = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Get documents from API
        const apiDocs = (await api.getUserDocuments()) as ApiDocument[];

        // Log the first document to see its exact structure
        if (apiDocs.length > 0) {
          console.log("First doc:", apiDocs[0]);
        }

        // Convert API docs to our Document format
        const processedDocs = apiDocs.map((doc) => {
          return {
            ...doc,
            created_at: doc.created_at || new Date(),
            updated_at: doc.updated_at || new Date(),
          } as Document;
        });

        setDocuments(processedDocs);

        // Set the most recently updated document as current if it exists
        if (processedDocs.length > 0) {
          const sortedDocs = [...processedDocs].sort((a, b) => {
            const aDate = new Date(a.updated_at);
            const bDate = new Date(b.updated_at);
            return bDate.getTime() - aDate.getTime();
          });
          setCurrentDocId(sortedDocs[0]._id);
        }
      } catch (err) {
        console.error("Error fetching documents:", err);
        setError("Failed to load documents. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  // Create a new document
  const createDocument = useCallback(async () => {
    const title =
      newDocTitle.trim() || `Untitled Document ${documents.length + 1}`;
    setIsLoading(true);
    setError(null);

    try {
      const newDoc = await api.createDocument({
        title,
        content: "",
        publication_status: "unpublished",
      });

      setDocuments((prev) => [...prev, newDoc]);
      setCurrentDocId(newDoc._id);
      setNewDocTitle("");
    } catch (err) {
      console.error("Error creating document:", err);
      setError("Failed to create document. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [newDocTitle, documents.length]);

  // Update document content
  const updateDocumentContent = useCallback(
    async (content: string) => {
      if (!currentDocId) return;

      try {
        await api.updateDocument(currentDocId, { content });

        // Update local state
        setDocuments((prev) =>
          prev.map((doc) =>
            doc._id === currentDocId
              ? { ...doc, content, updated_at: new Date() }
              : doc
          )
        );
      } catch (err) {
        console.error("Error updating document content:", err);
        setError("Failed to save document. Please try again.");
      }
    },
    [currentDocId]
  );

  // Delete a document
  const deleteDocument = useCallback(
    async (id: string) => {
      setIsLoading(true);
      setError(null);

      try {
        await api.deleteDocument(id);

        // Update local state
        setDocuments((prev) => prev.filter((doc) => doc._id !== id));

        // If we're deleting the current document, switch to another one
        if (currentDocId === id) {
          const remainingDocs = documents.filter((doc) => doc._id !== id);
          if (remainingDocs.length > 0) {
            setCurrentDocId(remainingDocs[0]._id);
          } else {
            setCurrentDocId(null);
          }
        }
      } catch (err) {
        console.error("Error deleting document:", err);
        setError("Failed to delete document. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [currentDocId, documents]
  );

  // Start editing a document title
  const startEditingTitle = useCallback((id: string, currentTitle: string) => {
    setEditingTitleId(id);
    setEditedTitle(currentTitle);
  }, []);

  // Save the edited document title
  const saveDocumentTitle = useCallback(async () => {
    if (editingTitleId && editedTitle.trim()) {
      setIsLoading(true);
      setError(null);

      try {
        await api.updateDocument(editingTitleId, { title: editedTitle.trim() });

        // Update local state
        setDocuments((prev) =>
          prev.map((doc) =>
            doc._id === editingTitleId
              ? { ...doc, title: editedTitle.trim(), updated_at: new Date() }
              : doc
          )
        );
      } catch (err) {
        console.error("Error updating document title:", err);
        setError("Failed to update document title. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
    setEditingTitleId(null);
  }, [editingTitleId, editedTitle]);

  // Handle key press in the title input
  const handleTitleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveDocumentTitle();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setEditingTitleId(null);
      }

      // Stop propagation to prevent global shortcuts
      e.stopPropagation();
    },
    [saveDocumentTitle]
  );

  // Get sort function based on current sort option
  const getSortFunction = useCallback((option: SortOption) => {
    switch (option) {
      case "updated_at":
        return (a: Document, b: Document) => {
          const aDate = new Date(a.updated_at);
          const bDate = new Date(b.updated_at);
          return bDate.getTime() - aDate.getTime(); // newest first
        };
      case "created_at":
        return (a: Document, b: Document) => {
          const aDate = new Date(a.created_at);
          const bDate = new Date(b.created_at);
          return bDate.getTime() - aDate.getTime(); // newest first
        };
      case "title":
        return (a: Document, b: Document) => {
          return a.title.localeCompare(b.title); // alphabetical
        };
      default:
        return (a: Document, b: Document) => {
          const aDate = new Date(a.updated_at);
          const bDate = new Date(b.updated_at);
          return bDate.getTime() - aDate.getTime(); // newest first
        };
    }
  }, []);

  // Filter and sort documents based on search query and sort option
  const filteredAndSortedDocuments = useMemo(() => {
    const filtered = !searchQuery.trim()
      ? documents
      : documents.filter((doc) =>
          doc.title.toLowerCase().includes(searchQuery.toLowerCase().trim())
        );

    return [...filtered].sort(getSortFunction(sortBy));
  }, [documents, searchQuery, sortBy, getSortFunction]);

  // Get the current document
  const currentDocument = documents.find((doc) => doc._id === currentDocId);

  // Update document publication status
  const updatePublicationStatus = useCallback(
    async (status: "unpublished" | "hidden" | "live") => {
      if (!currentDocId) return;
      setIsLoading(true);
      setError(null);

      try {
        // Call the API to update publication status
        await api.updateDocumentPublicationStatus(currentDocId, status);

        // Update local state
        setDocuments((prev) =>
          prev.map((doc) =>
            doc._id === currentDocId
              ? { ...doc, publication_status: status, updated_at: new Date() }
              : doc
          )
        );
      } catch (err) {
        console.error("Error updating publication status:", err);
        setError("Failed to update publication status. Please try again.");
      } finally {
        setIsLoading(false);
        setIsPublicationMenuOpen(false);
      }
    },
    [currentDocId]
  );

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if we're in an input, textarea or editor
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement &&
          e.target.classList.contains("ProseMirror"))
      ) {
        return;
      }

      // When 'f' is pressed and a document is open, focus the editor
      if (e.key === "f" && currentDocument) {
        e.preventDefault();

        // Try to focus the editor
        const editorElement = document.querySelector(".ProseMirror");
        if (editorElement) {
          (editorElement as HTMLElement).focus();
        }
      }

      // Arrow key navigation through documents
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();

        if (filteredAndSortedDocuments.length === 0) return;

        const currentIndex = currentDocId
          ? filteredAndSortedDocuments.findIndex(
              (doc) => doc._id === currentDocId
            )
          : -1;

        let newIndex;
        if (e.key === "ArrowDown") {
          // Move down (next document)
          newIndex =
            currentIndex < filteredAndSortedDocuments.length - 1
              ? currentIndex + 1
              : 0; // Wrap to beginning
        } else {
          // Move up (previous document)
          newIndex =
            currentIndex > 0
              ? currentIndex - 1
              : filteredAndSortedDocuments.length - 1; // Wrap to end
        }

        setCurrentDocId(filteredAndSortedDocuments[newIndex]._id);
      }

      // Number keys (1-9, 0) to select documents by position
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();

        const index = e.key === "0" ? 9 : parseInt(e.key) - 1;

        if (index < filteredAndSortedDocuments.length) {
          setCurrentDocId(filteredAndSortedDocuments[index]._id);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [filteredAndSortedDocuments, currentDocId, currentDocument]);

  // Handle escape key to blur editor
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Check if focus is within the editor
        const editorElement = document.querySelector(".ProseMirror");
        const activeElement = document.activeElement;

        if (
          editorElement &&
          activeElement &&
          (editorElement === activeElement ||
            editorElement.contains(activeElement))
        ) {
          // Blur the editor
          (activeElement as HTMLElement).blur();
          e.preventDefault();
        }
      }
    };

    document.addEventListener("keydown", handleEscapeKey);

    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, []);

  return (
    <div className="h-full w-full p-1.5">
      <div
        className="flex h-full w-full bg-gray-50 border rounded-lg border-gray-200 dark:border-gray-800 dark:bg-gray-900 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar */}
        <div className="w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-full">
          {/* Header and search */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-gray-900 dark:text-white">
                Documents
              </h2>

              {/* Sort dropdown */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSortMenuOpen(!sortMenuOpen);
                  }}
                  className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <span>Sort: {sortBy.replace("_", " ")}</span>
                  <svg
                    className="h-3 w-3"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {sortMenuOpen && (
                  <div
                    className="absolute right-0 mt-1 w-40 rounded-md shadow-lg bg-white dark:bg-gray-900 ring-1 ring-black ring-opacity-5 z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      className="py-1"
                      role="menu"
                      aria-orientation="vertical"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSortBy("updated_at");
                          setSortMenuOpen(false);
                        }}
                        className={`w-full text-left block px-4 py-2 text-sm ${
                          sortBy === "updated_at"
                            ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                            : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                        role="menuitem"
                      >
                        Last updated
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSortBy("created_at");
                          setSortMenuOpen(false);
                        }}
                        className={`w-full text-left block px-4 py-2 text-sm ${
                          sortBy === "created_at"
                            ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                            : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                        role="menuitem"
                      >
                        Date created
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSortBy("title");
                          setSortMenuOpen(false);
                        }}
                        className={`w-full text-left block px-4 py-2 text-sm ${
                          sortBy === "title"
                            ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                            : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                        role="menuitem"
                      >
                        Title
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="relative mb-3">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-4 w-4 text-gray-400 dark:text-gray-500"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  e.stopPropagation();
                  setSearchQuery(e.target.value);
                }}
                placeholder="Search documents..."
                className="w-full pl-10 pr-3 py-2 border border-gray-200 dark:border-gray-800 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200"
                onKeyDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newDocTitle}
                onChange={(e) => {
                  e.stopPropagation();
                  setNewDocTitle(e.target.value);
                }}
                placeholder="New document title"
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200"
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    createDocument();
                  }
                }}
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  createDocument();
                }}
                disabled={isLoading}
                className={`bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 shadow-sm ${
                  isLoading ? "opacity-70 cursor-not-allowed" : ""
                }`}
              >
                Add
              </button>
            </div>

            {/* Error message */}
            {error && (
              <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
          </div>

          {/* Document list */}
          <div className="overflow-y-auto flex-1">
            {isLoading && documents.length === 0 ? (
              <div className="p-4 text-gray-500 dark:text-gray-400 text-center">
                Loading documents...
              </div>
            ) : filteredAndSortedDocuments.length > 0 ? (
              <ul className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredAndSortedDocuments.map((doc, index) => (
                  <li key={doc._id} className="relative">
                    <div
                      className={`p-4 cursor-pointer flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800 group ${
                        currentDocId === doc._id
                          ? "bg-gray-100 dark:bg-gray-800"
                          : ""
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentDocId(doc._id);
                      }}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {doc.title}
                        </h3>
                        <div className="flex items-center space-x-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {formatDocumentDate(doc.updated_at)}
                          </span>
                          {doc.publication_status &&
                            doc.publication_status !== "unpublished" && (
                              <span
                                className={`ml-1 flex-shrink-0 inline-block px-1.5 py-0.5 text-xs rounded-full ${
                                  doc.publication_status === "live"
                                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                    : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                }`}
                              >
                                {doc.publication_status === "live"
                                  ? "Live"
                                  : "Hidden"}
                              </span>
                            )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            window.confirm(
                              "Are you sure you want to delete this document?"
                            )
                          ) {
                            deleteDocument(doc._id);
                          }
                        }}
                        className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg
                          className="h-4 w-4 text-gray-500 dark:text-gray-400"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 text-gray-500 dark:text-gray-400 text-center">
                {searchQuery
                  ? "No documents matching your search"
                  : "No documents yet. Create one to get started!"}
              </div>
            )}
          </div>
        </div>

        {/* Editor area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {isLoading && !currentDocument ? (
            <div className="h-full flex items-center justify-center bg-white dark:bg-gray-900">
              <svg
                className="animate-spin h-8 w-8 text-gray-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            </div>
          ) : currentDocument ? (
            <div className="flex flex-col h-full">
              <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4 bg-white dark:bg-gray-900 flex items-center justify-between">
                {/* Left side - document title */}
                <div className="flex items-center">
                  {editingTitleId === currentDocument._id ? (
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => {
                        e.stopPropagation();
                        setEditedTitle(e.target.value);
                      }}
                      onBlur={(e) => {
                        e.stopPropagation();
                        saveDocumentTitle();
                      }}
                      onKeyDown={handleTitleKeyPress}
                      className="flex-1 text-xl font-semibold text-gray-800 dark:text-gray-200 bg-transparent border-none focus:outline-none focus:ring-0 p-0 m-0 w-full"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <h2
                      className="text-sm font-medium text-gray-900 dark:text-white cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditingTitle(
                          currentDocument._id,
                          currentDocument.title
                        );
                      }}
                    >
                      {currentDocument.title}
                    </h2>
                  )}
                </div>

                {/* Right side - publication status dropdown and copy link button */}
                <div className="flex items-center space-x-2">
                  {/* Copy link button - only show for published or hidden docs */}
                  {currentDocument.publication_status &&
                    currentDocument.publication_status !== "unpublished" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const url = `https://noahlr.com/post/${currentDocument._id}`;
                          navigator.clipboard.writeText(url);

                          // Show temporary success message
                          const target = e.currentTarget;
                          const originalText = target.textContent;
                          target.textContent = "Copied!";
                          setTimeout(() => {
                            target.textContent = originalText;
                          }, 2000);
                        }}
                        className="flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200"
                      >
                        <svg
                          className="h-4 w-4 text-gray-500"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.225 5.865.75.75 0 00.977-1.138 2.5 2.5 0 01-.142-3.667l3-3z" />
                          <path d="M11.603 7.963a.75.75 0 00-.977 1.138 2.5 2.5 0 01.142 3.667l-3 3a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.06l-1.224 1.224a4 4 0 105.656 5.656l3-3a4 4 0 00-.225-5.865z" />
                        </svg>
                        <span>Copy Link</span>
                      </button>
                    )}

                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsPublicationMenuOpen(!isPublicationMenuOpen);
                      }}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200"
                    >
                      <span>
                        {getPublicationStatusIcon(
                          currentDocument.publication_status
                        )}
                      </span>
                      <span>
                        {getPublicationStatusText(
                          currentDocument.publication_status
                        )}
                      </span>
                      <svg
                        className="h-4 w-4 text-gray-500"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>

                    {isPublicationMenuOpen && (
                      <div
                        className="absolute right-0 mt-1 w-56 rounded-md shadow-lg bg-white dark:bg-gray-900 ring-1 ring-black ring-opacity-5 z-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div
                          className="py-1"
                          role="menu"
                          aria-orientation="vertical"
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updatePublicationStatus("unpublished");
                            }}
                            className="w-full text-left block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                            role="menuitem"
                          >
                            <div className="flex items-center space-x-2">
                              {getPublicationStatusIcon("unpublished")}
                              <span>Not Published</span>
                            </div>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updatePublicationStatus("hidden");
                            }}
                            className="w-full text-left block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                            role="menuitem"
                          >
                            <div className="flex items-center space-x-2">
                              {getPublicationStatusIcon("hidden")}
                              <span>Published - Hidden</span>
                            </div>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updatePublicationStatus("live");
                            }}
                            className="w-full text-left block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                            role="menuitem"
                          >
                            <div className="flex items-center space-x-2">
                              {getPublicationStatusIcon("live")}
                              <span>Published - Live</span>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg m-4 shadow-sm">
                <Editor
                  initialContent={currentDocument.content}
                  onUpdate={updateDocumentContent}
                  documentId={currentDocument._id}
                />
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center bg-white dark:bg-gray-900">
              <div className="text-center p-8 max-w-md">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  ></path>
                </svg>
                <h3 className="mt-4 text-sm font-medium text-gray-900 dark:text-white">
                  No document selected
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Select a document from the sidebar or create a new one to
                  start editing.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Documents;
