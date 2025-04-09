import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { YooptaContentValue } from "@yoopta/editor";

import Sidebar from "./components/Sidebar";
import Editor from "./components/Editor";

interface Article {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

const Write: React.FC = () => {
  const { user, updateUserPreferences } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);

  // Load articles from user preferences
  useEffect(() => {
    if (user?.preferences?.articles) {
      setArticles(user.preferences.articles);
    }
  }, [user]);

  // Create a new article
  const handleCreateArticle = useCallback(() => {
    const newArticle: Article = {
      id: Date.now().toString(),
      title: "Untitled Document",
      content: JSON.stringify({}),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const updatedArticles = [newArticle, ...articles];
    setArticles(updatedArticles);
    setActiveArticle(newArticle);
    updateUserPreferences({ ...user?.preferences, articles: updatedArticles });
  }, [articles, user, updateUserPreferences]);

  // Select an article
  const handleSelectArticle = useCallback((article: Article) => {
    setActiveArticle(article);
  }, []);

  // Update article content
  const handleEditorChange = useCallback(
    (value: YooptaContentValue) => {
      if (!activeArticle) return;

      const updatedArticle = {
        ...activeArticle,
        content: JSON.stringify(value),
        updated_at: new Date().toISOString(),
      };

      const updatedArticles = articles.map((article) =>
        article.id === activeArticle.id ? updatedArticle : article
      );

      setActiveArticle(updatedArticle);
      setArticles(updatedArticles);
      updateUserPreferences({
        ...user?.preferences,
        articles: updatedArticles,
      });
    },
    [activeArticle, articles, user, updateUserPreferences]
  );

  // Get editor initial value
  const getEditorInitialValue = useCallback(() => {
    if (!activeArticle) return {};
    try {
      return JSON.parse(activeArticle.content);
    } catch {
      return {};
    }
  }, [activeArticle]);

  return (
    <div className="h-full flex">
      <Sidebar
        articles={articles}
        activeArticle={activeArticle}
        onCreateArticle={handleCreateArticle}
        onSelectArticle={handleSelectArticle}
      />
      <div className="flex-1 h-full flex flex-col">
        {activeArticle ? (
          <div className="flex-1 p-4 overflow-auto">
            <Editor
              initialValue={getEditorInitialValue()}
              onChange={handleEditorChange}
            />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center p-8 bg-white dark:bg-gray-900">
            <p className="text-gray-500 dark:text-gray-400">
              Select a document or create a new one to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Write;
