import React, { useState } from "react";
import Sidebar from "./Sidebar";

type LayoutProps = {
  children: React.ReactNode;
  selected: string;
  setSelected: (label: string) => void;
};

const Layout: React.FC<LayoutProps> = ({ children, selected, setSelected }) => {
  const name = JSON.parse(localStorage.getItem("name"));
  const fromColor = JSON.parse(localStorage.getItem("fromColor")) || "#E8CBC0";
  const toColor = JSON.parse(localStorage.getItem("toColor")) || "#636FA4";

  console.log("fromColor:", fromColor); // Debugging line
  console.log("toColor:", toColor); // Debugging line

  return (
    <div
      style={{
        background: `linear-gradient(to bottom right, ${fromColor}, ${toColor})`,
      }}
      className="flex h-screen p-4"
    >
      {/* Sidebar with title */}
      <Sidebar title={name} selected={selected} onSelect={setSelected} />
      {/* Main content area */}
      <div className="flex-1 bg-white rounded-xl overflow-scroll p-6 shadow-lg">
        {children}
      </div>
    </div>
  );
};
export default Layout;
