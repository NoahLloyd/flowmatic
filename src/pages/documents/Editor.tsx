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
  const saveTimeoutRef = useRef<number | null>(null);
  const { isDarkMode } = useTheme();
  const [prevDocumentId, setPrevDocumentId] = useState<string>(documentId);
  const lastSavedContentRef = useRef<string>(initialContent || "");

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
          "prose dark:prose-invert prose-sm sm:prose-base focus:outline-none p-6",
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

      // UI updates immediately because TipTap handles its own rendering

      // Debounce the save operation
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = window.setTimeout(() => {
        // Only save if content has changed since last save
        if (content !== lastSavedContentRef.current) {
          lastSavedContentRef.current = content;
          onUpdate(content);
        }
      }, 750);
    },
  });

  // Only reset editor content when switching to a different document
  useEffect(() => {
    if (editor && documentId !== prevDocumentId) {
      // Switching documents - update content
      editor.commands.setContent(initialContent || "");
      lastSavedContentRef.current = initialContent || "";
      setPrevDocumentId(documentId);

      // Focus the editor for better UX when switching documents, but don't force cursor to end
      editor.commands.focus();
    } else if (
      editor &&
      initialContent !== lastSavedContentRef.current &&
      initialContent !== editor.getHTML()
    ) {
      // External content update (like from API)

      // Store the current selection
      const { from, to } = editor.view.state.selection;

      // Update content
      editor.commands.setContent(initialContent || "");
      lastSavedContentRef.current = initialContent || "";

      // Try to restore cursor position
      try {
        editor.commands.setTextSelection({ from, to });
      } catch (e) {
        // If position restoration fails, just don't move the cursor
      }
    }
  }, [editor, documentId, prevDocumentId, initialContent]);

  // Update editor when dark mode changes
  useEffect(() => {
    if (editor) {
      // Don't force refocus on theme change
      // Just refresh the editor
      const view = editor.view;
      requestAnimationFrame(() => {
        view.updateState(view.state);
      });
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
    </div>
  );
};

export default Editor;
