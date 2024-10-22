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
      className={`flex items-center space-x-4 px-4 my-0 py-3 rounded-xl transition duration-200 ease-in-out text-lg ${
        isSelected
          ? "bg-white bg-opacity-30 shadow"
          : "hover:bg-white hover:bg-opacity-20"
      }`}
      onClick={() => onSelect(label)}
      style={{ border: "none", outline: "none" }}
    >
      <Icon className="w-8 h-8 text-gray-500" />
      <span className="text-gray-700 font-medium">{label}</span>
    </button>
  );
};

export default SidebarItem;
