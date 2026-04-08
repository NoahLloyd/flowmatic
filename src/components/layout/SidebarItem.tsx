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
  const getClasses = () => {
    if (highlight === "urgent") {
      return {
        bg: isSelected
          ? "bg-red-500/20 dark:bg-red-500/15"
          : "hover:bg-red-500/10 dark:hover:bg-red-500/10",
        accent: "bg-red-500",
        icon: "text-red-600 dark:text-red-400",
        text: "text-red-700 dark:text-red-300 font-semibold",
      };
    }
    if (highlight === "warning") {
      return {
        bg: isSelected
          ? "bg-amber-500/20 dark:bg-amber-500/15"
          : "hover:bg-amber-500/10 dark:hover:bg-amber-500/10",
        accent: "bg-amber-500",
        icon: "text-amber-600 dark:text-amber-400",
        text: "text-amber-700 dark:text-amber-300 font-semibold",
      };
    }
    return {
      bg: isSelected
        ? "bg-white/25 dark:bg-white/[0.08]"
        : "hover:bg-white/15 dark:hover:bg-white/[0.04]",
      accent: "bg-slate-700 dark:bg-slate-300",
      icon: isSelected
        ? "text-slate-800 dark:text-white"
        : "text-slate-500 dark:text-slate-400",
      text: isSelected
        ? "text-slate-800 dark:text-white font-semibold"
        : "text-slate-600 dark:text-slate-300 font-medium",
    };
  };

  const c = getClasses();

  return (
    <button
      className={`relative flex items-center gap-3 pl-4 pr-3 py-3.5 rounded-xl transition-all duration-150 w-full ${c.bg}`}
      onClick={() => onSelect(label)}
      style={{ border: "none", outline: "none" }}
    >
      {/* Left accent bar */}
      <div
        className={`absolute left-0.5 top-1/2 -translate-y-1/2 w-[3px] rounded-full transition-all duration-150 ${c.accent} ${
          isSelected ? "h-5 opacity-100" : "h-0 opacity-0"
        }`}
      />
      <Icon className={`w-[22px] h-[22px] transition-colors duration-150 flex-shrink-0 ${c.icon}`} />
      <span className={`text-[15px] transition-colors duration-150 ${c.text}`}>{label}</span>
    </button>
  );
};

export default SidebarItem;
