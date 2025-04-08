import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  BookOpen,
  Save,
  PlusCircle,
  X,
  Edit,
  Trash2,
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Code,
  Heading,
  Check,
  RefreshCw,
  FileText,
} from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import "./TipTapEditor.css";

interface Article {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// Menu button component for the toolbar
const MenuButton = ({
  onClick,
  isActive = false,
  disabled = false,
  children,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`p-2 rounded-md transition-colors ${
      isActive
        ? "bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white"
        : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
    } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
  >
    {children}
  </button>
);

const Write: React.FC = () => {
  const { user, updateUserPreferences } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState({ type: "", text: "" });
  const titleInputRef = useRef<HTMLInputElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Initialize TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Link,
      Placeholder.configure({
        placeholder: "Write something…",
      }),
    ],
    content:
      "<h2>Welcome to TipTap Editor</h2><p>This is a rich text editor that is much more reliable than BlockNote.</p><ul><li>You can create lists</li><li>Format text as <strong>bold</strong> or <em>italic</em></li><li>And much more!</li></ul><p>Try it out!</p>",
    onFocus: () => {
      setIsEditorFocused(true);
    },
    onBlur: () => {
      setIsEditorFocused(false);
    },
  });

  // Track when editor is focused to prevent keyboard shortcuts
  const [isEditorFocused, setIsEditorFocused] = useState(false);

  // Prevent keyboard shortcuts when editor is focused
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditorFocused) {
        // Stop propagation of keyboard events to prevent global shortcuts
        e.stopPropagation();
      }
    };

    // Add the keydown event capture to the editor container
    const editorElement = editorContainerRef.current;
    if (editorElement) {
      editorElement.addEventListener("keydown", handleKeyDown, true);
    }

    return () => {
      if (editorElement) {
        editorElement.removeEventListener("keydown", handleKeyDown, true);
      }
    };
  }, [isEditorFocused]);

  // Update editor content when activeArticle changes
  useEffect(() => {
    if (editor && activeArticle) {
      editor.commands.setContent(activeArticle.content || "<p></p>");
    }
  }, [activeArticle, editor]);

  // Load articles from user preferences
  useEffect(() => {
    if (user?.preferences?.articles) {
      setArticles(user.preferences.articles);
    } else {
      // Initialize with an empty array if no articles exist
      setArticles([]);
    }
  }, [user]);

  // Create a new article
  const handleCreateArticle = useCallback(() => {
    const newArticle: Article = {
      id: Date.now().toString(),
      title: "Untitled Article",
      content: "<p>Start writing here...</p>",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setArticles([newArticle, ...articles]);
    setActiveArticle(newArticle);
    setIsEditing(true);

    // Focus the title input after a short delay
    setTimeout(() => {
      if (titleInputRef.current) {
        titleInputRef.current.focus();
        titleInputRef.current.select();
      }
    }, 100);
  }, [articles]);

  // Select an article to view or edit
  const handleSelectArticle = useCallback((article: Article) => {
    setActiveArticle(article);
    setIsEditing(false);
  }, []);

  // Delete an article
  const handleDeleteArticle = useCallback(
    async (id: string) => {
      if (window.confirm("Are you sure you want to delete this article?")) {
        const updatedArticles = articles.filter((article) => article.id !== id);
        setArticles(updatedArticles);

        if (activeArticle?.id === id) {
          setActiveArticle(
            updatedArticles.length > 0 ? updatedArticles[0] : null
          );
        }

        // Save to user preferences
        await saveArticles(updatedArticles);
      }
    },
    [activeArticle, articles]
  );

  // Update article title or content
  const handleUpdateArticle = useCallback(
    (field: "title" | "content", value: string) => {
      if (!activeArticle) return;

      const updatedArticle = {
        ...activeArticle,
        [field]: value,
        updated_at: new Date().toISOString(),
      };

      setActiveArticle(updatedArticle);

      // Update the article in the articles array
      const updatedArticles = articles.map((article) =>
        article.id === activeArticle.id ? updatedArticle : article
      );

      setArticles(updatedArticles);
    },
    [activeArticle, articles]
  );

  // Save articles to user preferences
  const saveArticles = async (articlesToSave = articles) => {
    try {
      setIsSaving(true);
      setSaveMessage({ type: "", text: "" });

      const updatedPreferences = {
        ...user?.preferences,
        articles: articlesToSave,
      };

      await updateUserPreferences(updatedPreferences);

      setSaveMessage({
        type: "success",
        text: "Articles saved successfully!",
      });
    } catch (error) {
      console.error("Failed to save articles:", error);
      setSaveMessage({
        type: "error",
        text: "Failed to save articles. Please try again.",
      });
    } finally {
      setIsSaving(false);

      // Clear message after 3 seconds
      setTimeout(() => {
        setSaveMessage({ type: "", text: "" });
      }, 3000);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Component to display article content
  const ContentDisplay = ({ content }: { content: string }) => {
    return (
      <div
        className="prose dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  };

  // Update content when editor changes
  const handleContentChange = () => {
    if (editor && activeArticle) {
      handleUpdateArticle("content", editor.getHTML());
    }
  };

  // Save the current article
  const handleSaveArticle = async () => {
    if (!activeArticle) return;
    await saveArticles();
    setIsEditing(false);
  };

  // Calculate sidebar height
  const sidebarHeight = isEditing
    ? "calc(100vh - 220px)"
    : "calc(100vh - 180px)";

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-900 dark:text-white flex items-center">
            <BookOpen className="w-6 h-6 mr-2" />
            Write
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Write and organize your documents
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCreateArticle}
            className="px-4 py-2 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-sm rounded-md flex items-center gap-2 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            New Document
          </button>
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
          {saveMessage.text.replace("Articles", "Documents")}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar with article list */}
        <div className="lg:col-span-1 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
          <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-3 bg-white dark:bg-gray-900">
            <h2 className="text-sm font-medium text-gray-900 dark:text-white flex items-center">
              <FileText className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
              Your Documents
            </h2>
          </div>
          <div
            className="overflow-y-auto bg-white dark:bg-gray-900"
            style={{ maxHeight: sidebarHeight }}
          >
            {articles.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                No documents yet. Create one to get started.
              </div>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-800">
                {articles.map((article) => (
                  <li
                    key={article.id}
                    className={`cursor-pointer transition-colors ${
                      activeArticle?.id === article.id
                        ? "bg-gray-100 dark:bg-gray-800"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    }`}
                    onClick={() => handleSelectArticle(article)}
                  >
                    <div className="px-4 py-3">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {article.title}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {formatDate(article.updated_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Main content area */}
        <div className="lg:col-span-3">
          {activeArticle ? (
            <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
              {/* Article header */}
              <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-3 bg-white dark:bg-gray-900 flex justify-between items-center">
                <div className="flex-1">
                  {isEditing ? (
                    <input
                      ref={titleInputRef}
                      type="text"
                      value={activeArticle.title}
                      onChange={(e) =>
                        handleUpdateArticle("title", e.target.value)
                      }
                      className="w-full p-0 border-0 text-sm font-medium text-gray-900 dark:text-white bg-transparent focus:outline-none focus:ring-0"
                      placeholder="Document Title"
                    />
                  ) : (
                    <h2 className="text-sm font-medium text-gray-900 dark:text-white">
                      {activeArticle.title}
                    </h2>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {formatDate(activeArticle.updated_at)}
                  </p>
                </div>

                {/* Article actions */}
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleSaveArticle}
                        className="p-2 text-green-600 dark:text-green-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
                        title="Save"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="p-2 text-blue-600 dark:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteArticle(activeArticle.id)}
                        className="p-2 text-red-600 dark:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Editor toolbar (only visible when editing) */}
              {isEditing && editor && (
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex flex-wrap gap-1">
                  <MenuButton
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    isActive={editor.isActive("bold")}
                  >
                    <Bold className="w-4 h-4" />
                  </MenuButton>
                  <MenuButton
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    isActive={editor.isActive("italic")}
                  >
                    <Italic className="w-4 h-4" />
                  </MenuButton>
                  <MenuButton
                    onClick={() =>
                      editor.chain().focus().toggleHeading({ level: 2 }).run()
                    }
                    isActive={editor.isActive("heading", { level: 2 })}
                  >
                    <Heading className="w-4 h-4" />
                  </MenuButton>
                  <MenuButton
                    onClick={() =>
                      editor.chain().focus().toggleBulletList().run()
                    }
                    isActive={editor.isActive("bulletList")}
                  >
                    <List className="w-4 h-4" />
                  </MenuButton>
                  <MenuButton
                    onClick={() =>
                      editor.chain().focus().toggleOrderedList().run()
                    }
                    isActive={editor.isActive("orderedList")}
                  >
                    <ListOrdered className="w-4 h-4" />
                  </MenuButton>
                  <MenuButton
                    onClick={() =>
                      editor.chain().focus().toggleBlockquote().run()
                    }
                    isActive={editor.isActive("blockquote")}
                  >
                    <Quote className="w-4 h-4" />
                  </MenuButton>
                  <MenuButton
                    onClick={() =>
                      editor.chain().focus().toggleCodeBlock().run()
                    }
                    isActive={editor.isActive("codeBlock")}
                  >
                    <Code className="w-4 h-4" />
                  </MenuButton>
                </div>
              )}

              {/* Article content */}
              <div
                className="p-5 bg-white dark:bg-gray-900"
                ref={editorContainerRef}
              >
                {isEditing && editor ? (
                  <EditorContent
                    editor={editor}
                    className="tiptap-editor"
                    onBlur={handleContentChange}
                  />
                ) : (
                  <ContentDisplay content={activeArticle.content} />
                )}
              </div>
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-8 flex flex-col items-center justify-center text-center bg-white dark:bg-gray-900">
              <BookOpen className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Document Selected
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">
                Select a document from the sidebar or create a new one to get
                started
              </p>
              <button
                onClick={handleCreateArticle}
                className="px-4 py-2 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-sm rounded-md flex items-center gap-2 transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                New Document
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Write;
