import React, { useState, useEffect, useCallback, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import Editor from "./Editor";
import { api } from "../../utils/api";
import { Document } from "../../types/Document";

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

  // Load documents from API on initial render
  useEffect(() => {
    const fetchDocuments = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const docs = await api.getUserDocuments();
        setDocuments(docs);

        // Set the most recently updated document as current if it exists
        if (docs.length > 0) {
          const sortedDocs = [...docs].sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
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
              ? { ...doc, content, updatedAt: new Date() }
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
              ? { ...doc, title: editedTitle.trim(), updatedAt: new Date() }
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

  // Filter documents based on search query
  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return documents;

    const query = searchQuery.toLowerCase().trim();
    return documents.filter((doc) => doc.title.toLowerCase().includes(query));
  }, [documents, searchQuery]);

  // Get the current document
  const currentDocument = documents.find((doc) => doc._id === currentDocId);

  return (
    <div
      className="flex h-screen bg-gray-50 dark:bg-gray-900"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Sidebar */}
      <div className="w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
        {/* Header and search */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3">
            Documents
          </h2>
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
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
              className={`bg-blue-600 dark:bg-blue-500 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${
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
          ) : filteredDocuments.length > 0 ? (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredDocuments.map((doc) => (
                <li key={doc._id} className="relative">
                  <div
                    className={`p-4 cursor-pointer flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750 group ${
                      currentDocId === doc._id
                        ? "bg-blue-50 dark:bg-blue-900/20"
                        : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentDocId(doc._id);
                    }}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      {editingTitleId === doc._id ? (
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
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                          className="w-full px-1 py-1 border border-blue-400 dark:border-blue-500 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        />
                      ) : (
                        <h3
                          className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            startEditingTitle(doc._id, doc.title);
                          }}
                        >
                          {doc.title}
                        </h3>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {new Date(doc.updatedAt).toLocaleString()}
                      </p>
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
                      className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
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
      <div className="flex-1 overflow-auto">
        {isLoading && !currentDocument ? (
          <div className="h-full flex items-center justify-center bg-white dark:bg-gray-800">
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
          <div className="h-full">
            <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-white dark:bg-gray-800 flex items-center">
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
                  className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md text-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <h2
                  className="text-xl font-semibold text-gray-800 dark:text-gray-200 cursor-pointer"
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
            <div className="bg-white dark:bg-gray-800 h-full">
              <Editor
                initialContent={currentDocument.content}
                onUpdate={updateDocumentContent}
                documentId={currentDocument._id}
              />
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center bg-white dark:bg-gray-800">
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
              <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
                No document selected
              </h3>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                Select a document from the sidebar or create a new one to start
                editing.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Documents;
