import React from "react";

type SidebarItemProps = {
  Icon: any;
  label: string;
  isSelected: boolean;
  onSelect: (label: string) => void;
};

const SidebarItem: React.FC<SidebarItemProps> = ({
  Icon,
  label,
  isSelected,
  onSelect,
}) => {
  return (
    <button
      className={`flex items-center space-x-2 px-4 my-0 py-3 rounded-xl transition duration-200 ease-in-out text-md ${
        isSelected
          ? "bg-white/30 dark:bg-slate-800/40 shadow"
          : "hover:bg-white/20 dark:hover:bg-slate-700/30"
      }`}
      onClick={() => onSelect(label)}
      style={{ border: "none", outline: "none" }}
    >
      <Icon className="w-6 h-6 text-slate-700 dark:text-slate-200" />
      <span className="text-slate-700 dark:text-slate-200 font-medium">
        {label}
      </span>
    </button>
  );
};

export default SidebarItem;
