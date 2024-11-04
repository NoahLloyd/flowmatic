import React from "react";
import SidebarItem from "./SidebarItem";
import {
  Home,
  Settings,
  Pencil,
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
    { label: "Focus", icon: Clock },
    { label: "Tasks", icon: Check },
    { label: "Writing", icon: Pencil },
    { label: "Insights", icon: BarChart2 },
    { label: "Settings", icon: Settings },
  ];

  return (
    <div className="w-64 flex flex-col pr-4 space-y-4">
      <div
        onClick={() => onSelect("Settings")}
        className="p-4 shadow cursor-pointer bg-white bg-opacity-10 rounded-xl mb-4 flex items-center justify-between"
      >
        <div className="flex justift-center items-center">
          <img
            src="/assets/logo-black-Template.png"
            alt="Logo"
            className="w-6 h-6 mr-2"
          />
          <h1 className="text-lg font-medium text-slate-700">{title}</h1>
        </div>
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
