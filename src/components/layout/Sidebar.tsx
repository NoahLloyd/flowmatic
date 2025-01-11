import React from "react";
import SidebarItem from "./SidebarItem";
import {
  Users,
  Settings,
  Sunrise,
  Check,
  Compass,
  BarChart2,
  ChevronsUpDown,
  User,
  Moon,
  Sun,
} from "lucide-react";
import logoImage from "../../assets/logo-black-Template.png";
import logoDarkImage from "../../assets/logo-white-Template.png";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";

type SidebarProps = {
  selected: string;
  onSelect: (label: string) => void;
  title: string;
};

const Sidebar: React.FC<SidebarProps> = ({ selected, onSelect, title }) => {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { user } = useAuth();

  const displayName = user?.email ? user.email.split("@")[0] : title;

  const icons = [
    { label: "Compass", icon: Compass },
    { label: "Friends", icon: Users },
    { label: "Tasks", icon: Check },
    { label: "Morning", icon: Sunrise },
    { label: "Insights", icon: BarChart2 },
    { label: "Settings", icon: Settings },
  ];

  return (
    <div className="w-64 flex flex-col pr-4 space-y-4">
      <div className="p-4 flex items-center justify-between bg-white/10 dark:bg-slate-800 dark:border-slate-700 border rounded-xl">
        <div className="flex items-center">
          <img
            src={isDarkMode ? logoDarkImage : logoImage}
            alt="Logo"
            className="w-8 h-8 mr-4"
          />
          <h1 className="text-lg font-medium text-slate-700 dark:text-slate-200">
            Flowmatic
          </h1>
        </div>
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-lg hover:bg-slate-200/20 dark:hover:bg-slate-700 transition-colors"
        >
          {isDarkMode ? (
            <Sun className="w-5 h-5 text-slate-200" />
          ) : (
            <Moon className="w-5 h-5 text-slate-600" />
          )}
        </button>
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

      <div className="flex-grow" />

      <div
        onClick={() => onSelect("Settings")}
        className="p-4 shadow cursor-pointer bg-white dark:bg-slate-800 rounded-xl flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
      >
        <div className="flex items-center">
          <User className="w-6 h-6 mr-2 text-slate-700 dark:text-slate-200" />
          <span className="text-md font-medium text-slate-700 dark:text-slate-200">
            {displayName}
          </span>
        </div>
        <ChevronsUpDown className="w-5 h-5 text-slate-700 dark:text-slate-200" />
      </div>
    </div>
  );
};

export default Sidebar;
