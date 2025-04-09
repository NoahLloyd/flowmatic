import React from "react";
import { FileText, PlusCircle } from "lucide-react";

interface Article {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface SidebarProps {
  articles: Article[];
  activeArticle: Article | null;
  onCreateArticle: () => void;
  onSelectArticle: (article: Article) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  articles,
  activeArticle,
  onCreateArticle,
  onSelectArticle,
}) => {
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="w-64 border-r border-gray-200 dark:border-gray-800 h-full flex flex-col">
      <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-3 bg-white dark:bg-gray-900 flex justify-between items-center">
        <h2 className="text-sm font-medium text-gray-900 dark:text-white flex items-center">
          <FileText className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
          Your Documents
        </h2>
        <button
          onClick={onCreateArticle}
          className="p-1 text-blue-600 dark:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
          title="New Document"
        >
          <PlusCircle className="w-4 h-4" />
        </button>
      </div>
      <div className="overflow-y-auto flex-1 bg-white dark:bg-gray-900">
        {articles.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
            No documents yet. Create one to get started.
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800">
            {articles.map((article) => (
              <li
                key={article.id}
                className={`cursor-pointer transition-colors ${
                  activeArticle?.id === article.id
                    ? "bg-gray-100 dark:bg-gray-800"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                }`}
                onClick={() => onSelectArticle(article)}
              >
                <div className="px-4 py-3">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {article.title}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {formatDate(article.updated_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
