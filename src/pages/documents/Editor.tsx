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
  const [internalContent, setInternalContent] = useState<string>(
    initialContent || ""
  );
  const isUpdatingRef = useRef(false);

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
      setInternalContent(content);

      // Debounce the save operation
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = window.setTimeout(() => {
        isUpdatingRef.current = true;
        onUpdate(content);
        // Reset the flag after a short delay to allow for state updates
        setTimeout(() => {
          isUpdatingRef.current = false;
        }, 50);
      }, 750);
    },
  });

  // Only reset editor content when switching to a different document
  useEffect(() => {
    if (editor && documentId !== prevDocumentId) {
      // Save current cursor position
      const { from, to } = editor.view.state.selection;

      // Update content
      editor.commands.setContent(initialContent || "");
      setInternalContent(initialContent || "");
      setPrevDocumentId(documentId);

      // Focus the editor for better UX when switching documents
      editor.commands.focus();
    } else if (
      editor &&
      initialContent !== internalContent &&
      !isUpdatingRef.current
    ) {
      // If initial content changed but not due to our own updates and not from document switching,
      // this means external content update (like from API)
      setInternalContent(initialContent);

      // Preserve selection if possible
      const { from, to } = editor.view.state.selection;
      editor.commands.setContent(initialContent || "");

      // Try to restore cursor position
      try {
        editor.commands.setTextSelection({ from, to });
      } catch (e) {
        // If position is invalid, just focus at end
        editor.commands.focus("end");
      }
    }
  }, [editor, documentId, prevDocumentId, initialContent, internalContent]);

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
