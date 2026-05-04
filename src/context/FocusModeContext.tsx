import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

// Focus mode is the distraction-stripped view toggled by the `\` key. It
// hides the sidebar and lets pages restyle themselves to fill the window.
//
// Owning the state at app level (instead of inside Layout) lets pages —
// notably Compass — react to it without prop-drilling. The toggle key
// listener also lives here so the shortcut works regardless of where the
// user is.

interface FocusModeContextValue {
  isFocusMode: boolean;
  toggleFocusMode: () => void;
  setFocusMode: (on: boolean) => void;
}

const FocusModeContext = createContext<FocusModeContextValue>({
  isFocusMode: false,
  toggleFocusMode: () => {},
  setFocusMode: () => {},
});

export const FocusModeProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [isFocusMode, setIsFocusMode] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't toggle while typing.
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        document.activeElement instanceof HTMLSelectElement ||
        (document.activeElement &&
          document.activeElement.hasAttribute("contenteditable"))
      ) {
        return;
      }
      if (e.key === "\\") {
        e.preventDefault();
        setIsFocusMode((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <FocusModeContext.Provider
      value={{
        isFocusMode,
        toggleFocusMode: () => setIsFocusMode((p) => !p),
        setFocusMode: setIsFocusMode,
      }}
    >
      {children}
    </FocusModeContext.Provider>
  );
};

export const useFocusMode = () => useContext(FocusModeContext);
