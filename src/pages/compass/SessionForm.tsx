import React, { useState, useEffect } from "react";
import { api } from "../../utils/api";
import { Task } from "../../types/Task";
import { Session } from "../../types/Session";
import { useAuth } from "../../context/AuthContext";
import { useTimezone } from "../../context/TimezoneContext";

interface SessionFormProps {
  onSessionCreated: () => Promise<void>;
  todaysHours?: number;
  todaysGoal?: number;
}

interface SessionFormData {
  id: string;
  user_id: string;
  notes: string;
  task: string;
  project: string;
  time: number;
  focus: number;
  created_at: string;
}

const SessionForm: React.FC<SessionFormProps> = ({
  onSessionCreated,
  todaysHours = 0,
  todaysGoal,
}) => {
  const { user } = useAuth();
  const { timezone } = useTimezone();
  const [dayTasks, setDayTasks] = useState<Task[]>([]);

  // Fetch active day tasks
  useEffect(() => {
    const fetchDayTasks = async () => {
      try {
        const tasks = await api.getTasksByType("day");
        setDayTasks(tasks.filter((t) => !t.completed));
      } catch (error) {
        console.error("Failed to fetch day tasks:", error);
      }
    };
    fetchDayTasks();
  }, []);

  // Get user's preferred settings from preferences
  const defaultProject = user?.preferences?.defaultProject || "";
  const defaultMinutes = user?.preferences?.defaultMinutes || 60;

  // Get daily goal from user's preferences if not provided
  const getDailyGoal = () => {
    if (todaysGoal) return todaysGoal;

    // Get current day
    const day = new Date().getDay();
    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const dayName = dayNames[day];

    // Check if user has preferences set
    if (
      user?.preferences?.dailyHoursGoals &&
      dayName in user.preferences.dailyHoursGoals
    ) {
      return user.preferences.dailyHoursGoals[dayName];
    }
    return 4; // Default if not set
  };

  const dailyGoal = getDailyGoal();

  const [formData, setFormData] = useState<SessionFormData>({
    id: "",
    user_id: user?.id || "",
    notes: "",
    task: "",
    project: defaultProject,
    time: defaultMinutes,
    focus: 0,
    created_at: new Date().toISOString(),
  });

  // Update form data when user preferences change
  useEffect(() => {
    setFormData((prev: SessionFormData) => ({
      ...prev,
      user_id: user?.id || "",
      project: defaultProject,
      time: defaultMinutes,
    }));
  }, [user, defaultProject, defaultMinutes]);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev: SessionFormData) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Create an ISO string that's in the user's timezone
  const createTimezoneAwareDate = () => {
    try {
      // Get the current date/time
      const now = new Date();

      // This is a trick to create a Date object that has the same
      // wall-clock time in the user's timezone as 'now' has in the local timezone.
      // We'll still return the ISO string which is always in UTC,
      // but the datetime value itself will be appropriate for the user's timezone.
      const nowStr = now.toLocaleString("en-US", { timeZone: timezone });
      const nowInUserTZ = new Date(nowStr);

      // Adjust the UTC time to match the timezone offset
      const offset = now.getTime() - nowInUserTZ.getTime();
      const adjustedDate = new Date(now.getTime() + offset);

      return adjustedDate.toISOString();
    } catch (error) {
      console.error("Error creating timezone-aware date:", error);
      return new Date().toISOString(); // Fallback
    }
  };

  const handleSubmit = async (focusRating: number) => {
    const submitData = {
      ...formData,
      focus: focusRating,
      minutes: formData.time,
      created_at: createTimezoneAwareDate(),
    };

    try {
      const response = await api.submitSession(submitData);
      console.log("Session submitted successfully:", response);
      await onSessionCreated();
      setFormData({
        id: "",
        user_id: user?.id || "",
        notes: "",
        task: "",
        project: defaultProject,
        time: defaultMinutes,
        focus: 0,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error submitting session:", error);
    }
  };

  const focusLevels = [
    {
      rating: 1,
      label: "Distracted",
      bg: "bg-red-100 dark:bg-red-900",
      text: "text-red-700 dark:text-red-200",
    },
    {
      rating: 2,
      label: "Browsing",
      bg: "bg-orange-100 dark:bg-orange-900",
      text: "text-orange-700 dark:text-orange-200",
    },
    {
      rating: 3,
      label: "Attentive",
      bg: "bg-yellow-100 dark:bg-yellow-900",
      text: "text-yellow-700 dark:text-yellow-200",
    },
    {
      rating: 4,
      label: "Locked-in",
      bg: "bg-green-100 dark:bg-green-900",
      text: "text-green-700 dark:text-green-200",
    },
    {
      rating: 5,
      label: "Flow",
      bg: "bg-indigo-100 dark:bg-indigo-900",
      text: "text-indigo-700 dark:text-indigo-200",
    },
  ];

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="border-b border-gray-200 dark:border-gray-800 px-5 py-3 flex items-center">
        <h2 className="text-sm font-medium text-gray-900 dark:text-white">
          Record Session
        </h2>
      </div>
      <div className="p-5 bg-white dark:bg-gray-900">
        <form className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 space-y-4 md:space-y-0 md:flex md:gap-4">
              <select
                name="task"
                value={formData.task}
                onChange={handleInputChange}
                className="w-full md:w-1/2 p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-gray-400 dark:focus:border-gray-500 text-gray-800 dark:text-gray-200 text-sm"
              >
                <option value="">Select a task</option>
                {dayTasks.map((task) => (
                  <option key={task.id} value={task.title}>
                    {task.title}
                  </option>
                ))}
              </select>
              <input
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Notes"
                className="w-full md:w-1/2 p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-gray-400 dark:focus:border-gray-500 text-gray-800 dark:text-gray-200 text-sm placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                name="project"
                value={formData.project}
                onChange={handleInputChange}
                placeholder="Project"
                className="w-full md:w-auto flex-grow p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-gray-400 dark:focus:border-gray-500 text-gray-800 dark:text-gray-200 text-sm placeholder-gray-500 dark:placeholder-gray-400"
              />
              <input
                type="number"
                name="time"
                value={formData.time}
                onChange={handleInputChange}
                placeholder="Min"
                className="w-20 p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-gray-400 dark:focus:border-gray-500 text-gray-800 dark:text-gray-200 text-sm placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            {focusLevels.map(({ rating, label, bg, text }) => (
              <button
                key={rating}
                type="button"
                onClick={() => handleSubmit(rating)}
                className={`w-full flex text-sm ${text} rounded-md transition-all hover:opacity-90 overflow-hidden`}
              >
                <div
                  className={`${bg} px-3 py-2 font-medium flex items-center justify-center`}
                >
                  {rating}
                </div>
                <div className={`${bg} px-3 py-2 flex-1 text-center`}>
                  {label}
                </div>
              </button>
            ))}
          </div>
        </form>
      </div>
    </div>
  );
};

export default SessionForm;
