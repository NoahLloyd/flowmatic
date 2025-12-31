import React, { useState, useEffect } from "react";
import { Plus, Trash2, GripVertical, Save } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import {
  DEFAULT_CHECKLIST_ITEMS,
  DEFAULT_QUESTIONS,
} from "../../../types/Review";

interface ChecklistItemConfig {
  id: string;
  label: string;
}

interface QuestionConfig {
  id: string;
  question: string;
}

const ReviewSettings: React.FC = () => {
  const { user } = useAuth();

  // Checklist items state
  const [checklistItems, setChecklistItems] = useState<ChecklistItemConfig[]>(
    []
  );
  const [newChecklistItem, setNewChecklistItem] = useState("");

  // Questions state
  const [questions, setQuestions] = useState<QuestionConfig[]>([]);
  const [newQuestion, setNewQuestion] = useState("");

  // Load from user preferences or defaults
  useEffect(() => {
    if (user?.preferences?.reviewChecklistItems) {
      setChecklistItems(user.preferences.reviewChecklistItems);
    } else {
      setChecklistItems(DEFAULT_CHECKLIST_ITEMS);
    }

    if (user?.preferences?.reviewQuestions) {
      setQuestions(user.preferences.reviewQuestions);
    } else {
      setQuestions(DEFAULT_QUESTIONS);
    }
  }, [user]);

  // Update global settings object for parent save
  useEffect(() => {
    (window as any).__reviewSettings = {
      reviewChecklistItems: checklistItems,
      reviewQuestions: questions,
    };
  }, [checklistItems, questions]);

  // Checklist handlers
  const handleAddChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    const newItem: ChecklistItemConfig = {
      id: `custom-${Date.now()}`,
      label: newChecklistItem.trim(),
    };
    setChecklistItems([...checklistItems, newItem]);
    setNewChecklistItem("");
  };

  const handleRemoveChecklistItem = (id: string) => {
    setChecklistItems(checklistItems.filter((item) => item.id !== id));
  };

  const handleUpdateChecklistItem = (id: string, label: string) => {
    setChecklistItems(
      checklistItems.map((item) =>
        item.id === id ? { ...item, label } : item
      )
    );
  };

  const handleResetChecklist = () => {
    setChecklistItems(DEFAULT_CHECKLIST_ITEMS);
  };

  // Question handlers
  const handleAddQuestion = () => {
    if (!newQuestion.trim()) return;
    const newQ: QuestionConfig = {
      id: `custom-${Date.now()}`,
      question: newQuestion.trim(),
    };
    setQuestions([...questions, newQ]);
    setNewQuestion("");
  };

  const handleRemoveQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const handleUpdateQuestion = (id: string, question: string) => {
    setQuestions(
      questions.map((q) => (q.id === id ? { ...q, question } : q))
    );
  };

  const handleResetQuestions = () => {
    setQuestions(DEFAULT_QUESTIONS);
  };

  return (
    <div className="space-y-8">
      {/* Checklist Items Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Checklist Items
          </h3>
          <button
            onClick={handleResetChecklist}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            Reset to defaults
          </button>
        </div>

        <div className="space-y-2 mb-4">
          {checklistItems.map((item, index) => (
            <div
              key={item.id}
              className="flex items-center space-x-2 p-2 bg-gray-50 dark:bg-gray-900/40 rounded-md border border-gray-200 dark:border-gray-700"
            >
              <GripVertical className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 cursor-grab" />
              <input
                type="text"
                value={item.label}
                onChange={(e) =>
                  handleUpdateChecklistItem(item.id, e.target.value)
                }
                className="flex-1 bg-transparent text-sm text-gray-800 dark:text-gray-200 focus:outline-none"
              />
              <button
                onClick={() => handleRemoveChecklistItem(item.id)}
                className="p-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={newChecklistItem}
            onChange={(e) => setNewChecklistItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddChecklistItem()}
            placeholder="Add new checklist item..."
            className="flex-1 p-2 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
          <button
            onClick={handleAddChecklistItem}
            className="p-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-md hover:bg-gray-800 dark:hover:bg-gray-200"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Questions Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Questions
          </h3>
          <button
            onClick={handleResetQuestions}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            Reset to defaults
          </button>
        </div>

        <div className="space-y-2 mb-4">
          {questions.map((q, index) => (
            <div
              key={q.id}
              className="flex items-start space-x-2 p-2 bg-gray-50 dark:bg-gray-900/40 rounded-md border border-gray-200 dark:border-gray-700"
            >
              <GripVertical className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 cursor-grab mt-1" />
              <textarea
                value={q.question}
                onChange={(e) => handleUpdateQuestion(q.id, e.target.value)}
                rows={2}
                className="flex-1 bg-transparent text-sm text-gray-800 dark:text-gray-200 focus:outline-none resize-none"
              />
              <button
                onClick={() => handleRemoveQuestion(q.id)}
                className="p-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddQuestion()}
            placeholder="Add new question..."
            className="flex-1 p-2 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
          <button
            onClick={handleAddQuestion}
            className="p-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-md hover:bg-gray-800 dark:hover:bg-gray-200"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Changes will be saved when you click "Save changes" at the top of the page.
      </p>
    </div>
  );
};

export default ReviewSettings;




