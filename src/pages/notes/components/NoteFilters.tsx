import React from "react";
import { Search, Eye, EyeOff, LayoutGrid, AlignLeft } from "lucide-react";

interface NoteFiltersProps {
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  searchInputRef: React.RefObject<HTMLInputElement>;
  filteredNoteCount: number;
  showProcessed: boolean;
  setShowProcessed: React.Dispatch<React.SetStateAction<boolean>>;
  sortOrder: "newest" | "oldest" | "alphabetical";
  setSortOrder: React.Dispatch<
    React.SetStateAction<"newest" | "oldest" | "alphabetical">
  >;
  viewMode: "grid" | "list";
  setViewMode: React.Dispatch<React.SetStateAction<"grid" | "list">>;
  saveMessage: { type: string; text: string };
}

const NoteFilters: React.FC<NoteFiltersProps> = ({
  searchQuery,
  setSearchQuery,
  searchInputRef,
  showProcessed,
  setShowProcessed,
  sortOrder,
  setSortOrder,
  viewMode,
  setViewMode,
}) => {
  return (
    <div className="mb-6 flex items-center gap-3">
      <div className="flex-1">
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 text-gray-800 dark:text-gray-200"
          />
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400" />
        </div>
      </div>

      <button
        onClick={() => setShowProcessed(!showProcessed)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm
          ${
            showProcessed
              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
              : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          }`}
      >
        {showProcessed ? (
          <>
            <Eye className="w-3.5 h-3.5" />
            <span>Showing processed</span>
          </>
        ) : (
          <>
            <EyeOff className="w-3.5 h-3.5" />
            <span>Hiding processed</span>
          </>
        )}
      </button>

      <select
        value={sortOrder}
        onChange={(e) => setSortOrder(e.target.value as any)}
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-sm py-1.5 px-3 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 text-gray-800 dark:text-gray-200"
      >
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
        <option value="alphabetical">Alphabetical</option>
      </select>

      <div className="flex bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <button
          onClick={() => setViewMode("grid")}
          className={`p-1.5 ${
            viewMode === "grid"
              ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              : "text-gray-500 dark:text-gray-400"
          }`}
          title="Grid view"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
        <button
          onClick={() => setViewMode("list")}
          className={`p-1.5 ${
            viewMode === "list"
              ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              : "text-gray-500 dark:text-gray-400"
          }`}
          title="List view"
        >
          <AlignLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default NoteFilters;
