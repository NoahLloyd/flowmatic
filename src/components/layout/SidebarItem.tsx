import React from "react";

type HighlightType = "none" | "warning" | "urgent";

type SidebarItemProps = {
  Icon: any;
  label: string;
  isSelected: boolean;
  onSelect: (label: string) => void;
  highlight?: HighlightType;
};

const SidebarItem: React.FC<SidebarItemProps> = ({
  Icon,
  label,
  isSelected,
  onSelect,
  highlight = "none",
}) => {
  // Determine background classes based on highlight and selection state
  const getBackgroundClasses = () => {
    if (highlight === "urgent") {
      // Sunday - red/urgent indicator
      return isSelected
        ? "bg-red-500/40 dark:bg-red-600/50 shadow"
        : "bg-red-500/30 dark:bg-red-600/40 hover:bg-red-500/40 dark:hover:bg-red-600/50";
    }
    if (highlight === "warning") {
      // Saturday - amber/warning indicator
      return isSelected
        ? "bg-amber-500/40 dark:bg-amber-600/50 shadow"
        : "bg-amber-500/30 dark:bg-amber-600/40 hover:bg-amber-500/40 dark:hover:bg-amber-600/50";
    }
    // Default - no highlight
    return isSelected
      ? "bg-white/30 dark:bg-slate-800/40 shadow"
      : "hover:bg-white/20 dark:hover:bg-slate-700/30";
  };

  // Determine text classes based on highlight
  const getTextClasses = () => {
    if (highlight === "urgent") {
      return "text-red-900 dark:text-red-100 font-semibold";
    }
    if (highlight === "warning") {
      return "text-amber-900 dark:text-amber-100 font-semibold";
    }
    return "text-slate-700 dark:text-slate-200 font-medium";
  };

  // Determine icon classes based on highlight
  const getIconClasses = () => {
    if (highlight === "urgent") {
      return "w-6 h-6 text-red-900 dark:text-red-100";
    }
    if (highlight === "warning") {
      return "w-6 h-6 text-amber-900 dark:text-amber-100";
    }
    return "w-6 h-6 text-slate-700 dark:text-slate-200";
  };

  return (
    <button
      className={`flex items-center space-x-2 px-4 my-0 py-3 rounded-xl transition duration-200 ease-in-out text-md ${getBackgroundClasses()}`}
      onClick={() => onSelect(label)}
      style={{ border: "none", outline: "none" }}
    >
      <Icon className={getIconClasses()} />
      <span className={getTextClasses()}>{label}</span>
    </button>
  );
};

export default SidebarItem;
