import React, { useState } from "react";
import Sidebar from "./Sidebar";

type LayoutProps = {
  children: React.ReactNode;
  selected: string;
  setSelected: (label: string) => void;
};

const Layout: React.FC<LayoutProps> = ({ children, selected, setSelected }) => {
  return (
    <div className="flex h-screen bg-gradient-to-br from-[#E8CBC0] to-[#636FA4] p-4 ">
      {/* Sidebar with title */}
      <Sidebar title="Noah Lloyd" selected={selected} onSelect={setSelected} />
      {/* Main content area */}
      <div className="flex-1 bg-white rounded-xl p-6 shadow-lg">{children}</div>
    </div>
  );
};
export default Layout;
