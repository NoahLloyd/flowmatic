import React, { useState, useEffect } from "react";
import { api } from "../../utils/api";
import { useTasks } from "../../hooks/useTasks";

interface SessionFormProps {
  onSessionCreated: () => Promise<void>;
}

interface SessionFormData {
  _id: string;
  user_id: string;
  notes: string;
  task: string;
  project: string;
  time: number;
  focus: number;
  created_at: string;
}

const SessionForm: React.FC<SessionFormProps> = ({ onSessionCreated }) => {
  const { tasks } = useTasks();
  const [formData, setFormData] = useState<SessionFormData>({
    _id: "",
    user_id: localStorage.getItem("name"),
    notes: "",
    task: "",
    project:
      localStorage.getItem("defaultProject")?.replace(/^"|"$/g, "") || "1440",
    time: Number(localStorage.getItem("defaultMinutes")) || 60,
    focus: 0,
    created_at: new Date().toISOString(),
  });

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      project:
        localStorage.getItem("defaultProject")?.replace(/^"|"$/g, "") || "1440",
      time: Number(localStorage.getItem("defaultMinutes")) || 60,
    }));
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (focusRating: number) => {
    const submitData = {
      ...formData,
      focus: focusRating,
      minutes: formData.time,
    };

    try {
      const response = await api.submitSession(submitData);
      console.log("Session submitted successfully:", response);
      await onSessionCreated();
      setFormData({
        _id: "",
        user_id: localStorage.getItem("name"),
        notes: "",
        task: "",
        project: localStorage.getItem("defaultProject") || "1440",
        time: Number(localStorage.getItem("defaultMinutes")) || 60,
        focus: 0,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error submitting session:", error);
    }
  };

  const focusLevels = [
    { rating: 1, label: "Distracted", color: "bg-red-800" },
    { rating: 2, label: "Browsing", color: "bg-orange-800" },
    { rating: 3, label: "Attentive", color: "bg-yellow-800" },
    { rating: 4, label: "Locked-in", color: "bg-green-800" },
    { rating: 5, label: "Flow", color: "bg-indigo-800" },
  ];

  const dayTasks = tasks.filter(
    (task) => task.type === "day" && !task.completed
  );

  return (
    <div className="bg-slate-50 dark:bg-gray-800 rounded-xl p-4 border border-slate-200 dark:border-gray-700 hover:border-slate-300 dark:hover:border-gray-600 transition-all duration-200">
      <form className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1 flex gap-4">
            <select
              name="task"
              value={formData.task}
              onChange={handleInputChange}
              className="w-1/2 p-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg focus:outline-none focus:border-slate-300 dark:focus:border-gray-500 text-gray-900 dark:text-gray-100"
            >
              <option value="">Select a task</option>
              {dayTasks.map((task) => (
                <option key={task._id} value={task.title}>
                  {task.title}
                </option>
              ))}
            </select>
            <input
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="Notes"
              className="w-1/2 p-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg focus:outline-none focus:border-slate-300 dark:focus:border-gray-500 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              name="project"
              value={formData.project}
              onChange={handleInputChange}
              placeholder="Project"
              className="w-20 p-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg focus:outline-none focus:border-slate-300 dark:focus:border-gray-500 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
            />
            <input
              type="number"
              name="time"
              value={formData.time}
              onChange={handleInputChange}
              placeholder="Min"
              className="w-16 p-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg focus:outline-none focus:border-slate-300 dark:focus:border-gray-500 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-2">
          {focusLevels.map(({ rating, label, color }) => (
            <button
              key={rating}
              type="button"
              onClick={() => handleSubmit(rating)}
              className="flex-1 flex text-xs text-white rounded-lg hover:scale-105 transition-transform overflow-hidden shadow-sm"
            >
              <div className={`${color} px-3 py-2 font-bold`}>{rating}</div>
              <div
                className={`${color} bg-opacity-80 font-medium px-2.5 py-2 flex-1`}
              >
                {label}
              </div>
            </button>
          ))}
        </div>
      </form>
    </div>
  );
};

export default SessionForm;
