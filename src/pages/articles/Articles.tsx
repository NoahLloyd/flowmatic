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

const Articles: React.FC = () => {
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

  // For displaying content in view mode
  const ContentDisplay = ({ content }: { content: string }) => {
    if (!content) {
      return <p className="text-gray-500 dark:text-gray-400">No content</p>;
    }

    return (
      <div
        className="prose prose-gray dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  };

  // Handle editor content changes
  const handleContentChange = () => {
    if (editor && activeArticle) {
      handleUpdateArticle("content", editor.getHTML());
    }
  };

  // Save the current article
  const handleSaveArticle = async () => {
    if (activeArticle) {
      // Make sure we have the latest content from the editor
      if (editor) {
        handleUpdateArticle("content", editor.getHTML());
      }
      await saveArticles();
    }
  };

  if (!editor) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        Loading editor...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header with action buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-900 dark:text-white flex items-center">
            <BookOpen className="w-6 h-6 mr-2" />
            Articles
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Write and manage your longform content
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleCreateArticle}
            className="flex items-center px-3 py-2 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-sm rounded-md transition-colors"
          >
            <PlusCircle className="w-4 h-4 mr-1" />
            New Article
          </button>
          {activeArticle && (
            <button
              onClick={handleSaveArticle}
              disabled={isSaving}
              className="flex items-center px-3 py-2 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-sm rounded-md transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              {isSaving ? "Saving..." : "Save"}
            </button>
          )}
        </div>
      </div>

      {/* Save message notification */}
      {saveMessage.text && (
        <div
          className={`p-3 rounded-md text-sm flex items-center mb-6 ${
            saveMessage.type === "success"
              ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800"
          }`}
        >
          {saveMessage.type === "success" ? (
            <Check className="w-4 h-4 mr-2 text-green-500 dark:text-green-400" />
          ) : (
            <X className="w-4 h-4 mr-2 text-red-500 dark:text-red-400" />
          )}
          {saveMessage.text}
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Articles List Sidebar */}
        <div className="col-span-12 md:col-span-4 lg:col-span-3">
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center">
              <FileText className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
              <h2 className="text-sm font-medium text-gray-900 dark:text-white">
                Your Articles
              </h2>
            </div>
            <div className="max-h-[calc(100vh-250px)] overflow-y-auto">
              {articles.length === 0 ? (
                <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
                  You don't have any articles yet.
                </div>
              ) : (
                <ul className="divide-y divide-gray-200 dark:divide-gray-800">
                  {articles.map((article) => (
                    <li
                      key={article.id}
                      className={`relative transition-colors cursor-pointer ${
                        activeArticle?.id === article.id
                          ? "bg-blue-50 dark:bg-blue-900/30"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                      onClick={() => handleSelectArticle(article)}
                    >
                      <div className="px-4 py-3">
                        <div className="flex justify-between items-start">
                          <div className="truncate pr-8">
                            <h3 className="font-medium text-sm text-gray-900 dark:text-white truncate">
                              {article.title}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {formatDate(article.updated_at)}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteArticle(article.id);
                            }}
                            className="absolute right-3 top-3 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Editor Section */}
        <div className="col-span-12 md:col-span-8 lg:col-span-9">
          {activeArticle ? (
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
              {/* Title section */}
              <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-3">
                <label
                  htmlFor="article-title"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Title
                </label>
                <input
                  ref={titleInputRef}
                  type="text"
                  id="article-title"
                  value={activeArticle.title}
                  onChange={(e) => handleUpdateArticle("title", e.target.value)}
                  className="w-full px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-600"
                />
              </div>

              {/* TipTap Editor with toolbar */}
              <div className="editor-container max-h-[calc(100vh-300px)] flex flex-col">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-200 dark:border-gray-700">
                  {/* Heading */}
                  <MenuButton
                    onClick={() =>
                      editor.chain().focus().toggleHeading({ level: 2 }).run()
                    }
                    isActive={editor.isActive("heading", { level: 2 })}
                  >
                    <Heading className="w-5 h-5" />
                  </MenuButton>

                  {/* Bold */}
                  <MenuButton
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    isActive={editor.isActive("bold")}
                  >
                    <Bold className="w-5 h-5" />
                  </MenuButton>

                  {/* Italic */}
                  <MenuButton
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    isActive={editor.isActive("italic")}
                  >
                    <Italic className="w-5 h-5" />
                  </MenuButton>

                  <div className="h-6 mx-1 border-r border-gray-300 dark:border-gray-600" />

                  {/* Bullet List */}
                  <MenuButton
                    onClick={() =>
                      editor.chain().focus().toggleBulletList().run()
                    }
                    isActive={editor.isActive("bulletList")}
                  >
                    <List className="w-5 h-5" />
                  </MenuButton>

                  {/* Ordered List */}
                  <MenuButton
                    onClick={() =>
                      editor.chain().focus().toggleOrderedList().run()
                    }
                    isActive={editor.isActive("orderedList")}
                  >
                    <ListOrdered className="w-5 h-5" />
                  </MenuButton>

                  <div className="h-6 mx-1 border-r border-gray-300 dark:border-gray-600" />

                  {/* Blockquote */}
                  <MenuButton
                    onClick={() =>
                      editor.chain().focus().toggleBlockquote().run()
                    }
                    isActive={editor.isActive("blockquote")}
                  >
                    <Quote className="w-5 h-5" />
                  </MenuButton>

                  {/* Code Block */}
                  <MenuButton
                    onClick={() =>
                      editor.chain().focus().toggleCodeBlock().run()
                    }
                    isActive={editor.isActive("codeBlock")}
                  >
                    <Code className="w-5 h-5" />
                  </MenuButton>
                </div>

                {/* Editor content */}
                <div
                  ref={editorContainerRef}
                  className="flex-1 overflow-y-auto"
                  onBlur={handleContentChange}
                >
                  <EditorContent
                    editor={editor}
                    className="tiptap-editor prose prose-gray dark:prose-invert max-w-none p-4"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-8 text-center">
              <BookOpen className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600" />
              <h2 className="mt-4 text-xl font-medium text-gray-900 dark:text-white">
                No Article Selected
              </h2>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Select an article from the sidebar or create a new one.
              </p>
              <button
                onClick={handleCreateArticle}
                className="mt-4 px-4 py-2 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-sm rounded-md transition-colors"
              >
                Create Article
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Articles;
