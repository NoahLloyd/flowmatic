import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

// Type declarations for the overlay API
declare global {
  interface Window {
    overlayApi: {
      getOverlayType: () => Promise<"task" | "note">;
      submitTask: (title: string) => Promise<boolean>;
      submitNote: (content: string) => Promise<boolean>;
      close: () => void;
      onFocus: (callback: () => void) => void;
    };
  }
}

const Overlay: React.FC = () => {
  const [value, setValue] = useState("");
  const [overlayType, setOverlayType] = useState<"task" | "note">("task");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Get the overlay type
    window.overlayApi.getOverlayType().then(setOverlayType);

    // Focus input when window receives focus
    window.overlayApi.onFocus(() => {
      inputRef.current?.focus();
    });

    // Initial focus
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, []);

  const handleSubmit = async () => {
    if (!value.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      let success = false;
      if (overlayType === "task") {
        success = await window.overlayApi.submitTask(value.trim());
      } else {
        success = await window.overlayApi.submitNote(value.trim());
      }

      if (success) {
        setIsClosing(true);
        setTimeout(() => {
          window.overlayApi.close();
        }, 150);
      } else {
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error("Failed to submit:", error);
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsClosing(true);
      setTimeout(() => {
        window.overlayApi.close();
      }, 150);
    } else if (e.key === "Enter" && value.trim()) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "20vh",
        background: "rgba(0, 0, 0, 0.4)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        opacity: isClosing ? 0 : 1,
        transition: "opacity 150ms ease-out",
      }}
      onClick={() => {
        setIsClosing(true);
        setTimeout(() => {
          window.overlayApi.close();
        }, 150);
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "520px",
          margin: "0 24px",
          transform: isClosing
            ? "scale(0.95) translateY(-10px)"
            : "scale(1) translateY(0)",
          opacity: isClosing ? 0 : 1,
          transition: "all 150ms ease-out",
        }}
      >
        <div
          style={{
            background: "rgba(255, 255, 255, 0.95)",
            borderRadius: "16px",
            boxShadow:
              "0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)",
            overflow: "hidden",
          }}
        >
          {/* Header indicator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "12px 16px",
              borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
              gap: "10px",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: overlayType === "task" ? "#10b981" : "#6366f1",
              }}
            />
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                color: "#6b7280",
              }}
            >
              {overlayType === "task" ? "Quick Add Task" : "Quick Add Note"}
            </span>
          </div>

          {/* Input */}
          <div style={{ padding: "16px 20px" }}>
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                overlayType === "task"
                  ? "What needs to be done today?"
                  : "Write a quick note..."
              }
              disabled={isSubmitting}
              autoFocus
              style={{
                width: "100%",
                fontSize: "18px",
                fontWeight: 400,
                border: "none",
                outline: "none",
                background: "transparent",
                color: "#1f2937",
                caretColor: overlayType === "task" ? "#10b981" : "#6366f1",
              }}
            />
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 16px",
              background: "rgba(0, 0, 0, 0.02)",
              borderTop: "1px solid rgba(0, 0, 0, 0.04)",
            }}
          >
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <kbd
                style={{
                  padding: "3px 8px",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  background: "rgba(0, 0, 0, 0.06)",
                  borderRadius: "4px",
                  color: "#6b7280",
                }}
              >
                Enter
              </kbd>
              <span style={{ fontSize: "12px", color: "#9ca3af" }}>to add</span>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <kbd
                style={{
                  padding: "3px 8px",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  background: "rgba(0, 0, 0, 0.06)",
                  borderRadius: "4px",
                  color: "#6b7280",
                }}
              >
                Esc
              </kbd>
              <span style={{ fontSize: "12px", color: "#9ca3af" }}>
                to close
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Mount the app
const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<Overlay />);
}
