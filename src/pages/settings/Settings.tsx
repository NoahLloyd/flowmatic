import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  ArrowLeftRight,
  Check,
  RefreshCw,
  Save,
  User,
  Clock,
  Palette,
  LogOut,
} from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

const Settings = () => {
  const { user, updateUserPreferences, logout } = useAuth();
  const { isDarkMode } = useTheme();

  // Default color values based on theme
  const defaultLightFromColor = "#E8CBC0";
  const defaultLightToColor = "#636FA4";
  const defaultDarkFromColor = "#1E293B";
  const defaultDarkToColor = "#0F172A";

  // Initialize state from user preferences with theme-aware defaults
  const [defaultProject, setDefaultProject] = useState<string>(
    user?.preferences?.defaultProject || ""
  );
  const [defaultMinutes, setDefaultMinutes] = useState<number>(
    user?.preferences?.defaultMinutes || 60
  );
  const [fromColor, setFromColor] = useState<string>(
    user?.preferences?.fromColor ||
      (isDarkMode ? defaultDarkFromColor : defaultLightFromColor)
  );
  const [toColor, setToColor] = useState<string>(
    user?.preferences?.toColor ||
      (isDarkMode ? defaultDarkToColor : defaultLightToColor)
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState({ type: "", text: "" });

  // Update state when user data changes
  useEffect(() => {
    if (user?.preferences) {
      setDefaultProject(user.preferences.defaultProject || "");
      setDefaultMinutes(user.preferences.defaultMinutes || 60);
      setFromColor(
        user.preferences.fromColor ||
          (isDarkMode ? defaultDarkFromColor : defaultLightFromColor)
      );
      setToColor(
        user.preferences.toColor ||
          (isDarkMode ? defaultDarkToColor : defaultLightToColor)
      );
    }
  }, [user, isDarkMode]);

  const handleSavePreferences = async () => {
    try {
      setIsSaving(true);
      setSaveMessage({ type: "", text: "" });

      const updatedPreferences = {
        ...user?.preferences,
        defaultProject,
        defaultMinutes,
        fromColor,
        toColor,
      };

      await updateUserPreferences(updatedPreferences);
      setSaveMessage({ type: "success", text: "Settings saved successfully!" });
    } catch (error) {
      console.error("Failed to save preferences:", error);
      setSaveMessage({
        type: "error",
        text: "Failed to save settings. Please try again.",
      });
    } finally {
      setIsSaving(false);

      // Clear message after 3 seconds
      setTimeout(() => {
        setSaveMessage({ type: "", text: "" });
      }, 3000);
    }
  };

  const handleResetColors = () => {
    setFromColor(isDarkMode ? defaultDarkFromColor : defaultLightFromColor);
    setToColor(isDarkMode ? defaultDarkToColor : defaultLightToColor);
  };

  const handleLogout = () => {
    logout();
    // No need to navigate - the AuthContext will handle showing the Auth component when logged out
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header with save button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-900 dark:text-white">
            Settings
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage your account preferences
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleSavePreferences}
            disabled={isSaving}
            className="px-4 py-2 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-sm rounded-md flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
            {isSaving ? "Saving..." : "Save changes"}
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm rounded-md flex items-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>

      {/* Notification message */}
      {saveMessage.text && (
        <div
          className={`p-3 rounded-md text-sm flex items-center mb-6 ${
            saveMessage.type === "success"
              ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800"
          }`}
        >
          {saveMessage.type === "success" ? (
            <Check className="w-4 h-4 mr-2 text-green-500 dark:text-green-400" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2 text-red-500 dark:text-red-400" />
          )}
          {saveMessage.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account Info Section */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="border-b border-gray-200 dark:border-gray-800 px-5 py-3 flex items-center">
            <User className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
            <h2 className="text-sm font-medium text-gray-900 dark:text-white">
              Account
            </h2>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Name
              </label>
              <div className="p-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-md border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 text-sm">
                {user?.name || "No name set"}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Email
              </label>
              <div className="p-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-md border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 text-sm">
                {user?.email || "No email set"}
              </div>
            </div>
          </div>
        </div>

        {/* Project & Timer Settings */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="border-b border-gray-200 dark:border-gray-800 px-5 py-3 flex items-center">
            <Clock className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
            <h2 className="text-sm font-medium text-gray-900 dark:text-white">
              Projects & Timers
            </h2>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Default Project
              </label>
              <input
                type="text"
                placeholder="Enter project name"
                value={defaultProject}
                onChange={(e) => setDefaultProject(e.target.value)}
                className="w-full p-2.5 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-gray-400 dark:focus:border-gray-500"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Used when creating new sessions
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Default Minutes
              </label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="60"
                  value={defaultMinutes}
                  onChange={(e) => setDefaultMinutes(Number(e.target.value))}
                  min={1}
                  max={180}
                  className="w-full p-2.5 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-gray-400 dark:focus:border-gray-500 pr-16"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">
                  minutes
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Default timer duration (1-180 minutes)
              </p>
            </div>
          </div>
        </div>

        {/* Color Settings */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="border-b border-gray-200 dark:border-gray-800 px-5 py-3 flex items-center">
            <Palette className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
            <h2 className="text-sm font-medium text-gray-900 dark:text-white">
              Appearance
            </h2>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Color Scheme
                </label>
                <button
                  onClick={handleResetColors}
                  className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reset to {isDarkMode ? "dark" : "light"} defaults
                </button>
              </div>
              <div
                className="h-20 w-full rounded-md border border-gray-200 dark:border-gray-800 mb-3"
                style={{
                  background: `linear-gradient(to right, ${fromColor}, ${toColor})`,
                }}
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    From Color
                  </label>
                  <div className="flex items-center">
                    <input
                      type="color"
                      value={fromColor}
                      onChange={(e) => setFromColor(e.target.value)}
                      className="h-8 w-8 p-0 border-0 rounded-md"
                    />
                    <span className="ml-2 text-xs text-gray-600 dark:text-gray-400 font-mono">
                      {fromColor}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    To Color
                  </label>
                  <div className="flex items-center">
                    <input
                      type="color"
                      value={toColor}
                      onChange={(e) => setToColor(e.target.value)}
                      className="h-8 w-8 p-0 border-0 rounded-md"
                    />
                    <span className="ml-2 text-xs text-gray-600 dark:text-gray-400 font-mono">
                      {toColor}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  const temp = fromColor;
                  setFromColor(toColor);
                  setToColor(temp);
                }}
                className="mt-2 w-full flex items-center justify-center gap-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 p-2 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-colors"
              >
                <ArrowLeftRight className="w-3 h-3" />
                Swap Colors
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Coming Soon Section */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-5 mt-6">
        <h2 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center">
          <span className="text-gray-500 dark:text-gray-400 mr-2">✨</span>
          Coming Soon
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            "Customizable shortcuts",
            "Theme preferences",
            "Notification settings",
            "Integration with third-party services",
            "Advanced analytics",
            "Workflow templates",
          ].map((feature, index) => (
            <div
              key={index}
              className="p-2.5 border border-gray-200 dark:border-gray-800 rounded-md text-xs text-gray-700 dark:text-gray-300"
            >
              {feature}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Settings;
