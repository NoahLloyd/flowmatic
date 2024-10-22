import React from "react";
import SidebarItem from "./SidebarItem";
import {
  Home,
  Settings,
  Check,
  Clock,
  BarChart2,
  ChevronsUpDown,
} from "lucide-react";

type SidebarProps = {
  selected: string;
  onSelect: (label: string) => void;
  title: string;
};

const Sidebar: React.FC<SidebarProps> = ({ selected, onSelect, title }) => {
  const icons = [
    { label: "Home", icon: Home },
    { label: "Timer", icon: Clock },
    { label: "Tasks", icon: Check },
    { label: "Stats", icon: BarChart2 },
    { label: "Settings", icon: Settings },
  ];

  return (
    <div className="w-64 flex flex-col pr-4 space-y-4">
      <div className="p-4 shadow bg-white bg-opacity-10 rounded-xl mb-4 flex items-center justify-between">
        <h1 className="text-lg font-medium text-slate-700">{title}</h1>
        <ChevronsUpDown className="w-5 h-5 text-slate-700" />
      </div>
      {icons.map((icon) => (
        <SidebarItem
          key={icon.label}
          Icon={icon.icon}
          label={icon.label}
          isSelected={selected === icon.label}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
};

export default Sidebar;
