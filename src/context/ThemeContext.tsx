import React, { createContext, useContext, useEffect, useState } from "react";

type ThemeMode = "light" | "dark" | "system";

type ThemeContextType = {
  isDarkMode: boolean;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const getSystemPreference = () => {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    // Check localStorage for saved preference, default to "system"
    const saved = localStorage.getItem("themeMode") as ThemeMode | null;
    return saved && ["light", "dark", "system"].includes(saved) ? saved : "system";
  });

  const [systemPrefersDark, setSystemPrefersDark] = useState(getSystemPreference);

  // Calculate actual dark mode based on themeMode and system preference
  const isDarkMode = themeMode === "system" ? systemPrefersDark : themeMode === "dark";

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  // Apply theme class to document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Save theme mode to localStorage
  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem("themeMode", mode);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, themeMode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
