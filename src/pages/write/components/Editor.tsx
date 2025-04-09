import React, { useMemo, useState, useEffect, useRef } from "react";
import YooptaEditor, {
  createYooptaEditor,
  YooptaContentValue,
  YooptaOnChangeOptions,
} from "@yoopta/editor";
import Paragraph from "@yoopta/paragraph";
import { HeadingOne, HeadingTwo, HeadingThree } from "@yoopta/headings";
import { BulletedList, NumberedList } from "@yoopta/lists";
import Blockquote from "@yoopta/blockquote";
import { useTheme } from "../../../context/ThemeContext";
import "../YooptaEditor.css";

// Include all necessary plugins
const plugins = [
  Paragraph,
  HeadingOne,
  HeadingTwo,
  HeadingThree,
  BulletedList,
  NumberedList,
  Blockquote,
];

interface EditorProps {
  initialValue?: YooptaContentValue;
  onChange?: (value: YooptaContentValue) => void;
}

const Editor: React.FC<EditorProps> = ({
  initialValue,
  onChange: onChangeCallback,
}) => {
  const editor = useMemo(() => createYooptaEditor(), []);
  const [value, setValue] = useState<YooptaContentValue>(initialValue || {});
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const { isDarkMode } = useTheme();

  // Handle keyboard events when editor is focused
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFocused) {
        // Stop propagation to prevent global shortcuts from triggering
        e.stopPropagation();
      }
    };

    // Use capture phase to intercept events before they reach global listeners
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isFocused]);

  const onChange = (
    value: YooptaContentValue,
    options: YooptaOnChangeOptions
  ) => {
    setValue(value);
    if (onChangeCallback) {
      onChangeCallback(value);
    }
  };

  return (
    <div
      ref={editorRef}
      className={`w-full editor-container ${isDarkMode ? "dark" : ""}`}
      onFocus={() => setIsFocused(true)}
      onBlur={(e) => {
        // Only set unfocused if focus is leaving the editor container
        if (!editorRef.current?.contains(e.relatedTarget as Node)) {
          setIsFocused(false);
        }
      }}
    >
      <div className="content-area bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg">
        <YooptaEditor
          editor={editor}
          plugins={plugins}
          placeholder="Type / for commands or # for headings"
          value={value}
          onChange={onChange}
        />
      </div>
    </div>
  );
};

export default Editor;
