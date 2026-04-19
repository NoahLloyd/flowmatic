import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
  DroppableProvided,
  DraggableProvided,
} from "@hello-pangea/dnd";
import {
  PenLine,
  Eye,
  Heart,
  Star,
  Wind,
  GripVertical,
  Trash2,
  Plus,
  Copy,
  CalendarDays,
  CheckSquare,
} from "lucide-react";
import { api } from "../../utils/api";
import {
  MorningActivity,
  DayOfWeek,
  WeeklyMorningSchedule,
} from "../../types/Morning";

const DEFAULT_BREATHWORK_TEXT = `1. Sit comfortably with your back straight
2. Breathe in deeply through your nose for 4 counts
3. Hold your breath for 4 counts
4. Exhale through your mouth for 6 counts
5. Repeat for 5-10 cycles`;

const DAYS_OF_WEEK: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const MorningSettings = () => {
  const { user } = useAuth();
  const [successMessage, setSuccessMessage] = useState<string>("");

  const [selectedDay, setSelectedDay] = useState<DayOfWeek>("monday");

  // Initialize weekly schedule with default activities for each day
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklyMorningSchedule>(
    () => {
      const defaultSchedule: WeeklyMorningSchedule = {};
      DAYS_OF_WEEK.forEach((day) => {
        defaultSchedule[day] = [
          {
            id: "writing",
            type: "writing",
            enabled: true,
            timerMinutes: 15,
            title: "Stream of Consciousness Writing",
          },
        ];
      });
      return defaultSchedule;
    }
  );

  // Format day name for display (capitalize first letter)
  const formatDayName = (day: string): string => {
    return day.charAt(0).toUpperCase() + day.slice(1);
  };

  // Load weekly schedule from user preferences
  useEffect(() => {
    if (user?.preferences?.weeklyMorningSchedule) {
      setWeeklySchedule(user.preferences.weeklyMorningSchedule);
    } else if (user?.preferences?.morningActivities) {
      // Migration from old format: apply the same activities to all days
      const migratedSchedule: WeeklyMorningSchedule = {};
      DAYS_OF_WEEK.forEach((day) => {
        migratedSchedule[day] = [...user.preferences.morningActivities];
      });
      setWeeklySchedule(migratedSchedule);
    }
  }, [user]);

  // Store current values for the parent component to access
  React.useEffect(() => {
    // @ts-ignore - This is a hack to expose state to parent component
    window.__morningSettings = {
      weeklyMorningSchedule: weeklySchedule,
    };
  }, [weeklySchedule]);

  // Get activities for the currently selected day
  const activities = weeklySchedule[selectedDay] || [];

  // Handle activity reordering for the current day
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(activities);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setWeeklySchedule((prev) => ({
      ...prev,
      [selectedDay]: items,
    }));
  };

  // Toggle activity enabled state
  const toggleActivity = (id: string) => {
    setWeeklySchedule((prev) => ({
      ...prev,
      [selectedDay]: prev[selectedDay].map((activity) =>
        activity.id === id
          ? { ...activity, enabled: !activity.enabled }
          : activity
      ),
    }));
  };

  // Update activity timer minutes
  const updateTimerMinutes = (id: string, minutes: number) => {
    setWeeklySchedule((prev) => ({
      ...prev,
      [selectedDay]: prev[selectedDay].map((activity) =>
        activity.id === id ? { ...activity, timerMinutes: minutes } : activity
      ),
    }));
  };

  // Update activity text (for visualization or breathwork)
  const updateActivityText = (id: string, text: string) => {
    setWeeklySchedule((prev) => ({
      ...prev,
      [selectedDay]: prev[selectedDay].map((activity) =>
        activity.id === id ? { ...activity, text } : activity
      ),
    }));
  };

  // Remove an activity
  const removeActivity = (id: string) => {
    // Remove the restriction on deleting the writing activity
    setWeeklySchedule((prev) => ({
      ...prev,
      [selectedDay]: prev[selectedDay].filter((activity) => activity.id !== id),
    }));
  };

  // Add a new activity
  const addActivity = (type: MorningActivity["type"]) => {
    // Check if this type already exists
    const exists = activities.some((a) => a.type === type);
    if (exists) return;

    // Set appropriate default timer minutes based on activity type
    let defaultTimerMinutes = 5; // Default for most
    if (type === "writing") {
      defaultTimerMinutes = 15;
    } else if (type === "visualization") {
      defaultTimerMinutes = 10;
    } else if (type === "breathwork") {
      defaultTimerMinutes = 5;
    }

    const newActivity: MorningActivity = {
      id: `${type}-${Date.now()}`,
      type,
      enabled: true,
      timerMinutes: defaultTimerMinutes,
      title: type.charAt(0).toUpperCase() + type.slice(1),
      text: type === "breathwork" ? DEFAULT_BREATHWORK_TEXT : "",
    };

    setWeeklySchedule((prev) => ({
      ...prev,
      [selectedDay]: [...prev[selectedDay], newActivity],
    }));
  };

  // Apply current day's schedule to all days
  const applyToAllDays = () => {
    const currentDayActivities = [...weeklySchedule[selectedDay]];

    const updatedSchedule: WeeklyMorningSchedule = {};
    DAYS_OF_WEEK.forEach((day) => {
      updatedSchedule[day] = [...currentDayActivities];
    });

    setWeeklySchedule(updatedSchedule);

    // Show success message
    setSuccessMessage(
      `Applied ${formatDayName(selectedDay)}'s routine to all days of the week`
    );

    // Clear message after 3 seconds
    setTimeout(() => {
      setSuccessMessage("");
    }, 3000);
  };

  // Get icon for activity type
  const getActivityIcon = (type: MorningActivity["type"]) => {
    switch (type) {
      case "writing":
        return <PenLine className="w-4 h-4 text-blue-500" />;
      case "visualization":
        return <Eye className="w-4 h-4 text-purple-500" />;
      case "gratitude":
        return <Heart className="w-4 h-4 text-red-500" />;
      case "affirmations":
        return <Star className="w-4 h-4 text-yellow-500" />;
      case "breathwork":
        return <Wind className="w-4 h-4 text-cyan-500" />;
      case "tasks":
        return <CheckSquare className="w-4 h-4 text-emerald-500" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">
          Morning Page Settings
        </h2>
      </div>

      {/* Notification message */}
      {successMessage && (
        <div className="p-3 rounded-lg text-sm flex items-center bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800">
          {successMessage}
        </div>
      )}

      {/* Day selector */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          <h3 className="text-md font-medium text-slate-800 dark:text-slate-200">
            Select Day
          </h3>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
          {DAYS_OF_WEEK.map((day) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-3 py-2 text-sm rounded-md flex items-center justify-center ${
                selectedDay === day
                  ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-800 font-medium"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
            >
              {formatDayName(day).slice(0, 3)}
            </button>
          ))}
        </div>

        <div className="mt-4 flex justify-between items-center border-t border-slate-200 dark:border-slate-700 pt-4">
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Currently editing{" "}
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {formatDayName(selectedDay)}
            </span>
            's routine
          </div>
          <button
            onClick={applyToAllDays}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600"
          >
            <Copy className="w-4 h-4" />
            Apply to all days
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-4">
          {formatDayName(selectedDay)}'s Activities
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Arrange your morning activities in the order you want them to appear.
          Drag to reorder.
        </p>

        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="morning-activities-droppable">
            {(provided: DroppableProvided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-4"
              >
                {activities.map((activity, index) => (
                  <Draggable
                    key={activity.id}
                    draggableId={activity.id}
                    index={index}
                  >
                    {(provided: DraggableProvided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-900/50"
                      >
                        <div className="flex items-center mb-3">
                          <div
                            {...provided.dragHandleProps}
                            className="mr-2 cursor-grab"
                          >
                            <GripVertical className="w-5 h-5 text-slate-400" />
                          </div>
                          <div className="mr-3">
                            {getActivityIcon(activity.type)}
                          </div>
                          <h4 className="text-md font-medium text-slate-700 dark:text-slate-300 flex-grow">
                            {activity.title}
                          </h4>
                          <div className="flex items-center space-x-2">
                            <label className="inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={activity.enabled}
                                onChange={() => toggleActivity(activity.id)}
                                className="sr-only peer"
                              />
                              <div className="relative w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-slate-300 dark:peer-focus:ring-slate-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-slate-600 dark:peer-checked:bg-slate-300"></div>
                              <span className="ml-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                                {activity.enabled ? "Enabled" : "Disabled"}
                              </span>
                            </label>
                            <button
                              onClick={() => removeActivity(activity.id)}
                              className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800"
                            >
                              <Trash2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                            </button>
                          </div>
                        </div>

                        <div className="pl-10 space-y-4">
                          {/* Timer settings for supported activities */}
                          {(activity.type === "writing" ||
                            activity.type === "gratitude" ||
                            activity.type === "affirmations" ||
                            activity.type === "visualization" ||
                            activity.type === "breathwork") && (
                            <div className="flex items-center">
                              <label className="block text-sm text-slate-600 dark:text-slate-400 w-32">
                                Timer Duration:
                              </label>
                              <div className="flex items-center">
                                <input
                                  type="number"
                                  min="1"
                                  max="60"
                                  value={activity.timerMinutes}
                                  onChange={(e) =>
                                    updateTimerMinutes(
                                      activity.id,
                                      parseInt(e.target.value) || 1
                                    )
                                  }
                                  className="w-20 px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                                />
                                <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">
                                  minutes
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Text input for visualization prompt */}
                          {activity.type === "visualization" && (
                            <div>
                              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">
                                Visualization Prompt:
                              </label>
                              <textarea
                                value={activity.text || ""}
                                onChange={(e) =>
                                  updateActivityText(
                                    activity.id,
                                    e.target.value
                                  )
                                }
                                placeholder="Enter your visualization prompt here..."
                                className="w-full h-24 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-800 text-slate-800 dark:text-slate-200 resize-none"
                              />
                            </div>
                          )}

                          {/* Text input for breathwork instructions */}
                          {activity.type === "breathwork" && (
                            <div>
                              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">
                                Breathwork Instructions:
                              </label>
                              <textarea
                                value={activity.text || DEFAULT_BREATHWORK_TEXT}
                                onChange={(e) =>
                                  updateActivityText(
                                    activity.id,
                                    e.target.value
                                  )
                                }
                                placeholder="Enter breathwork instructions..."
                                className="w-full h-24 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-800 text-slate-800 dark:text-slate-200 resize-none"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {/* Add new activity section */}
        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
          <h4 className="text-md font-medium text-slate-700 dark:text-slate-300 mb-3">
            Add Activity
          </h4>
          <div className="flex flex-wrap gap-2">
            {[
              {
                type: "writing",
                label: "Writing",
                icon: <PenLine className="w-4 h-4 mr-1" />,
              },
              {
                type: "visualization",
                label: "Visualization",
                icon: <Eye className="w-4 h-4 mr-1" />,
              },
              {
                type: "gratitude",
                label: "Gratitude",
                icon: <Heart className="w-4 h-4 mr-1" />,
              },
              {
                type: "affirmations",
                label: "Affirmations",
                icon: <Star className="w-4 h-4 mr-1" />,
              },
              {
                type: "breathwork",
                label: "Breathwork",
                icon: <Wind className="w-4 h-4 mr-1" />,
              },
              {
                type: "tasks",
                label: "Tasks",
                icon: <CheckSquare className="w-4 h-4 mr-1" />,
              },
            ].map((activity) => {
              const alreadyExists = activities.some(
                (a) => a.type === activity.type
              );
              return (
                <button
                  key={activity.type}
                  onClick={() =>
                    addActivity(activity.type as MorningActivity["type"])
                  }
                  disabled={alreadyExists}
                  className={`px-3 py-2 rounded-md flex items-center text-sm ${
                    alreadyExists
                      ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {activity.icon}
                  {activity.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MorningSettings;
