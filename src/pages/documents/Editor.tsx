import React, { useState, useRef, useCallback, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { useTheme } from "../../context/ThemeContext";
import "./EditorStyles.css";

interface EditorComponentProps {
  initialContent: string;
  onUpdate: (content: string) => void;
  documentId: string;
}

const Editor: React.FC<EditorComponentProps> = ({
  initialContent,
  onUpdate,
  documentId,
}) => {
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const { isDarkMode } = useTheme();

  // Setup editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight,
      Typography,
      Underline,
      Placeholder.configure({
        placeholder: "Write something...",
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Link.configure({
        openOnClick: false,
      }),
    ],
    content: initialContent || "",
    autofocus: true,
    editorProps: {
      attributes: {
        class:
          "prose dark:prose-invert prose-sm sm:prose-base mx-auto focus:outline-none p-6",
      },
      // Add event handlers to prevent global shortcuts from triggering
      handleKeyDown: (view, event) => {
        // Stop propagation to prevent global keyboard shortcuts
        event.stopPropagation();
        return false;
      },
      handleClick: (view, pos, event) => {
        // Stop propagation to prevent global keyboard shortcuts
        event.stopPropagation();
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const content = editor.getHTML();

      // Debounce the save operation
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = window.setTimeout(() => {
        onUpdate(content);
        setLastSavedAt(new Date());
      }, 750);
    },
  });

  // Reset the editor content when documentId changes
  useEffect(() => {
    if (editor && documentId) {
      editor.commands.setContent(initialContent || "");
    }
  }, [editor, documentId, initialContent]);

  // Update editor when dark mode changes
  useEffect(() => {
    if (editor) {
      // Force a refresh when theme changes
      editor.commands.focus("end");
    }
  }, [editor, isDarkMode]);

  // Cleanup the timeout when unmounting
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (!editor) {
    return null;
  }

  return (
    <div
      className={`editor-wrapper ${isDarkMode ? "dark" : ""}`}
      onClick={(e) => e.stopPropagation()}
    >
      <EditorContent
        editor={editor}
        className="editor-content"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      />

      {lastSavedAt && (
        <div className="text-xs text-gray-500 dark:text-gray-400 p-2 text-right border-t border-gray-200 dark:border-gray-700">
          Last saved: {lastSavedAt.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

export default Editor;
