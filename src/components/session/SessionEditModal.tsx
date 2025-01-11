import React, { useState } from "react";
import { Session } from "../../types/Session";

interface SessionEditModalProps {
  session: Session;
  onClose: () => void;
  onSave: (updatedSession: Session) => Promise<void>;
  onDelete: () => Promise<void>;
}

const SessionEditModal: React.FC<SessionEditModalProps> = ({
  session,
  onClose,
  onSave,
  onDelete,
}) => {
  const [formData, setFormData] = useState<Session>({ ...session });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "minutes" || name === "focus" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
    onClose();
  };

  const handleDelete = async () => {
    await onDelete();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-slate-200">
          Edit Session
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              className="mt-1 w-full p-2 border rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-200 border-gray-300 dark:border-slate-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
              Task
            </label>
            <input
              type="text"
              name="task"
              value={formData.task}
              onChange={handleInputChange}
              className="mt-1 w-full p-2 border rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-200 border-gray-300 dark:border-slate-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
              Project
            </label>
            <input
              type="text"
              name="project"
              value={formData.project}
              onChange={handleInputChange}
              className="mt-1 w-full p-2 border rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-200 border-gray-300 dark:border-slate-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
              Minutes
            </label>
            <input
              type="number"
              name="minutes"
              value={formData.minutes}
              onChange={handleInputChange}
              className="mt-1 w-full p-2 border rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-200 border-gray-300 dark:border-slate-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
              Focus Level (1-5)
            </label>
            <input
              type="number"
              name="focus"
              min="1"
              max="5"
              value={formData.focus}
              onChange={handleInputChange}
              className="mt-1 w-full p-2 border rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-200 border-gray-300 dark:border-slate-600"
            />
          </div>
          <div className="flex justify-between pt-4">
            <button
              type="button"
              onClick={handleDelete}
              className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 px-4 py-2 rounded hover:bg-red-200 dark:hover:bg-red-800"
            >
              Delete
            </button>
            <div className="space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-slate-200 px-4 py-2 rounded hover:bg-gray-300 dark:hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 px-4 py-2 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SessionEditModal;
