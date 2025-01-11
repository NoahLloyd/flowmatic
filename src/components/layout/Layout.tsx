import React, { useState } from "react";
import Sidebar from "./Sidebar";
import { useTheme } from "../../context/ThemeContext";

type LayoutProps = {
  children: React.ReactNode;
  selected: string;
  setSelected: (label: string) => void;
};

const Layout: React.FC<LayoutProps> = ({ children, selected, setSelected }) => {
  const { isDarkMode } = useTheme();
  const fromColor = isDarkMode ? "#1E293B" : "#E8CBC0"; // Changed dark mode color to match slate theme
  const toColor = isDarkMode ? "#0F172A" : "#636FA4"; // Changed dark mode color to match slate theme

  return (
    <div
      style={{
        background: `linear-gradient(to bottom right, ${fromColor}, ${toColor})`,
      }}
      className="flex h-screen p-4"
    >
      {/* Sidebar with title */}
      <Sidebar title="User" selected={selected} onSelect={setSelected} />
      {/* Main content area */}
      <div
        className={`flex-1 ${
          isDarkMode ? "bg-slate-900" : "bg-white"
        } rounded-xl overflow-scroll p-6 shadow-lg`}
      >
        {children}
      </div>
    </div>
  );
};
export default Layout;
