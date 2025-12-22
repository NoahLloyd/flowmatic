import React, { useState, useMemo } from "react";
import { Session } from "../../types/Session";
import { Clock, Calendar, Timer, Brain } from "lucide-react";

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

  // Calculate session timing info
  const sessionInfo = useMemo(() => {
    if (!session.created_at) return null;

    const endTime = new Date(session.created_at);
    const startTime = new Date(endTime.getTime() - session.minutes * 60 * 1000);
    
    const formatTime = (date: Date) => {
      return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    };

    const formatDate = (date: Date) => {
      const today = new Date();
      const isToday = date.toDateString() === today.toDateString();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = date.toDateString() === yesterday.toDateString();

      if (isToday) return 'Today';
      if (isYesterday) return 'Yesterday';
      return date.toLocaleDateString([], { 
        weekday: 'short',
        month: 'short', 
        day: 'numeric' 
      });
    };

    const formatDuration = (minutes: number) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      if (hours === 0) return `${mins}m`;
      if (mins === 0) return `${hours}h`;
      return `${hours}h ${mins}m`;
    };

    const getFocusLabel = (focus: number) => {
      const labels = ['', 'Very Low', 'Low', 'Medium', 'High', 'Very High'];
      return labels[focus] || '';
    };

    const getFocusColor = (focus: number) => {
      const colors = [
        '',
        'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30',
        'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30',
        'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30',
        'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
        'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30',
      ];
      return colors[focus] || '';
    };

    return {
      startTime: formatTime(startTime),
      endTime: formatTime(endTime),
      date: formatDate(endTime),
      duration: formatDuration(session.minutes),
      focusLabel: getFocusLabel(session.focus),
      focusColor: getFocusColor(session.focus),
    };
  }, [session]);

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
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-md border border-gray-200 dark:border-gray-800 shadow-lg">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          Edit Session
        </h2>

        {/* Session Info Display */}
        {sessionInfo && (
          <div className="mb-5 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-2 gap-3">
              {/* Date */}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-300">{sessionInfo.date}</span>
              </div>
              
              {/* Duration */}
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-300">{sessionInfo.duration}</span>
              </div>
              
              {/* Time Range */}
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {sessionInfo.startTime} – {sessionInfo.endTime}
                </span>
              </div>
              
              {/* Focus Level */}
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-gray-400" />
                <span className={`text-sm px-2 py-0.5 rounded-full ${sessionInfo.focusColor}`}>
                  {sessionInfo.focusLabel}
                </span>
              </div>
            </div>

            {/* Project/Task display */}
            {(session.project || session.task) && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-900 dark:text-white font-medium">
                  {session.project || session.task}
                </div>
                {session.project && session.task && session.project !== session.task && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {session.task}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              className="w-full p-2.5 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-gray-400 dark:focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Task
            </label>
            <input
              type="text"
              name="task"
              value={formData.task}
              onChange={handleInputChange}
              className="w-full p-2.5 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-gray-400 dark:focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Project
            </label>
            <input
              type="text"
              name="project"
              value={formData.project}
              onChange={handleInputChange}
              className="w-full p-2.5 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-gray-400 dark:focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Minutes
            </label>
            <input
              type="number"
              name="minutes"
              value={formData.minutes}
              onChange={handleInputChange}
              className="w-full p-2.5 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-gray-400 dark:focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Focus Level (1-5)
            </label>
            <input
              type="number"
              name="focus"
              min="1"
              max="5"
              value={formData.focus}
              onChange={handleInputChange}
              className="w-full p-2.5 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-gray-400 dark:focus:border-gray-500"
            />
          </div>
          <div className="flex justify-between pt-4">
            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200 rounded-md hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
            >
              Delete
            </button>
            <div className="space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200 rounded-md hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
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
