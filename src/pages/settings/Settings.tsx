import React, { useState, useEffect, useRef } from "react";
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
  Sunrise,
  Calendar,
  BarChart,
  Globe,
  ClipboardList,
  Keyboard,
} from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useTimezone } from "../../context/TimezoneContext";
import MorningSettings from "../morning/MorningSettings";
import WorkingHoursSettings from "./components/WorkingHoursSettings";
import SignalSettings from "./components/SignalSettings";
import ReviewSettings from "./components/ReviewSettings";
import ShortcutSettings from "./components/ShortcutSettings";

// List of common timezones
const COMMON_TIMEZONES = [
  "Pacific/Honolulu", // HST
  "America/Anchorage", // AKST
  "America/Los_Angeles", // PST/PDT
  "America/Denver", // MST/MDT
  "America/Chicago", // CST/CDT
  "America/New_York", // EST/EDT
  "America/Halifax", // AST/ADT
  "America/Sao_Paulo", // BRT
  "Europe/London", // GMT/BST
  "Europe/Paris", // CET/CEST
  "Europe/Helsinki", // EET/EEST
  "Asia/Istanbul", // TRT
  "Asia/Dubai", // GST
  "Asia/Kolkata", // IST
  "Asia/Singapore", // SGT
  "Asia/Tokyo", // JST
  "Australia/Sydney", // AEST/AEDT
  "Pacific/Auckland", // NZST/NZDT
];

// Format timezone for display
const formatTimezone = (tz: string) => {
  try {
    const now = new Date();
    const offset =
      new Intl.DateTimeFormat("en", {
        timeZoneName: "short",
        timeZone: tz,
      })
        .formatToParts(now)
        .find((part) => part.type === "timeZoneName")?.value || "";

    // Replace region path with more readable format
    const region = tz.replace("_", " ").split("/").pop();

    return `${region} (${offset})`;
  } catch (error) {
    return tz;
  }
};

// Get user's current timezone
const getUserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    return "UTC";
  }
};

const Settings = () => {
  const { user, updateUserPreferences, logout } = useAuth();
  const { isDarkMode } = useTheme();
  const {
    timezone: currentTimezone,
    setTimezone: updateAppTimezone,
    getUserTimezone,
  } = useTimezone();
  const initialMountRef = useRef(true);

  // Default color values
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
  const [lightModeFromColor, setLightModeFromColor] = useState<string>(
    user?.preferences?.lightModeFromColor || defaultLightFromColor
  );
  const [lightModeToColor, setLightModeToColor] = useState<string>(
    user?.preferences?.lightModeToColor || defaultLightToColor
  );
  const [darkModeFromColor, setDarkModeFromColor] = useState<string>(
    user?.preferences?.darkModeFromColor || defaultDarkFromColor
  );
  const [darkModeToColor, setDarkModeToColor] = useState<string>(
    user?.preferences?.darkModeToColor || defaultDarkToColor
  );
  const [timezone, setTimezone] = useState<string>(currentTimezone);
  const [customTimezone, setCustomTimezone] = useState<string>("");
  const [showCustomTimezone, setShowCustomTimezone] = useState<boolean>(
    !COMMON_TIMEZONES.includes(currentTimezone)
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState({ type: "", text: "" });

  // Update state when user data changes
  useEffect(() => {
    if (user?.preferences) {
      setDefaultProject(user.preferences.defaultProject || "");
      setDefaultMinutes(user.preferences.defaultMinutes || 60);
      setLightModeFromColor(
        user.preferences.lightModeFromColor || defaultLightFromColor
      );
      setLightModeToColor(
        user.preferences.lightModeToColor || defaultLightToColor
      );
      setDarkModeFromColor(
        user.preferences.darkModeFromColor || defaultDarkFromColor
      );
      setDarkModeToColor(
        user.preferences.darkModeToColor || defaultDarkToColor
      );
      setTimezone(user.preferences.timezone || getUserTimezone());

      // Check if the user's timezone is in the common list or is custom
      if (
        user.preferences.timezone &&
        !COMMON_TIMEZONES.includes(user.preferences.timezone)
      ) {
        setShowCustomTimezone(true);
        setCustomTimezone(user.preferences.timezone);
      }
    }

    // Mark as initialized after first mount
    if (initialMountRef.current) {
      initialMountRef.current = false;
    }
  }, [user, isDarkMode]);

  // Update local state when currentTimezone changes
  useEffect(() => {
    setTimezone(currentTimezone);
    if (!COMMON_TIMEZONES.includes(currentTimezone)) {
      setShowCustomTimezone(true);
      setCustomTimezone(currentTimezone);
    }
  }, [currentTimezone]);

  // Handle timezone change
  const handleTimezoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedTimezone = e.target.value;

    if (selectedTimezone === "custom") {
      setShowCustomTimezone(true);
    } else {
      setShowCustomTimezone(false);
      setTimezone(selectedTimezone);
    }
  };

  // Handle custom timezone input
  const handleCustomTimezoneChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setCustomTimezone(e.target.value);
    // Only update main timezone if valid
    try {
      // Simple validation - try to format a date with this timezone
      new Intl.DateTimeFormat("en", { timeZone: e.target.value }).format(
        new Date()
      );
      setTimezone(e.target.value);
    } catch (error) {
      // Invalid timezone - don't update main timezone yet
    }
  };

  const handleSavePreferences = async () => {
    try {
      setIsSaving(true);
      setSaveMessage({ type: "", text: "" });

      // Get the values from all child components
      const workingHoursSettings = (window as any).__workingHoursSettings || {};
      const signalSettings = (window as any).__signalSettings || {};
      const morningSettings = (window as any).__morningSettings || {};
      const reviewSettings = (window as any).__reviewSettings || {};

      // Use the custom timezone if showing custom input
      const finalTimezone = showCustomTimezone ? customTimezone : timezone;

      // Update the app-wide timezone immediately
      updateAppTimezone(finalTimezone);

      // Combine all preferences into one object
      const updatedPreferences = {
        ...user?.preferences,
        // Parent component settings
        defaultProject,
        defaultMinutes,
        lightModeFromColor,
        lightModeToColor,
        darkModeFromColor,
        darkModeToColor,
        // For backward compatibility
        fromColor: isDarkMode ? darkModeFromColor : lightModeFromColor,
        toColor: isDarkMode ? darkModeToColor : lightModeToColor,
        timezone: finalTimezone,

        // Working hours settings
        ...(workingHoursSettings.dailyHoursGoals
          ? { dailyHoursGoals: workingHoursSettings.dailyHoursGoals }
          : {}),
        ...(workingHoursSettings.yearlyHoursGoal
          ? { yearlyHoursGoal: workingHoursSettings.yearlyHoursGoal }
          : {}),

        // Signal settings
        ...(signalSettings.activeSignals
          ? { activeSignals: signalSettings.activeSignals }
          : {}),
        ...(signalSettings.signalGoals
          ? { signalGoals: signalSettings.signalGoals }
          : {}),

        // Morning settings
        ...(morningSettings.weeklyMorningSchedule
          ? { weeklyMorningSchedule: morningSettings.weeklyMorningSchedule }
          : {}),

        // Review settings
        ...(reviewSettings.reviewChecklistItems
          ? { reviewChecklistItems: reviewSettings.reviewChecklistItems }
          : {}),
        ...(reviewSettings.reviewQuestions
          ? { reviewQuestions: reviewSettings.reviewQuestions }
          : {}),
      };

      await updateUserPreferences(updatedPreferences);
      setSaveMessage({
        type: "success",
        text: "All settings saved successfully!",
      });

      console.log("All settings saved successfully!");
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
    if (isDarkMode) {
      setDarkModeFromColor(defaultDarkFromColor);
      setDarkModeToColor(defaultDarkToColor);
    } else {
      setLightModeFromColor(defaultLightFromColor);
      setLightModeToColor(defaultLightToColor);
    }
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
                  background: `linear-gradient(to right, ${
                    isDarkMode ? darkModeFromColor : lightModeFromColor
                  }, ${isDarkMode ? darkModeToColor : lightModeToColor})`,
                }}
              />

              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Light Mode Colors
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      From Color
                    </label>
                    <div className="flex items-center">
                      <input
                        type="color"
                        value={lightModeFromColor}
                        onChange={(e) => setLightModeFromColor(e.target.value)}
                        className="h-8 w-8 p-0 border-0 bg-transparent rounded-md"
                      />
                      <span className="ml-2 text-xs text-gray-600 dark:text-gray-400 font-mono">
                        {lightModeFromColor}
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
                        value={lightModeToColor}
                        onChange={(e) => setLightModeToColor(e.target.value)}
                        className="h-8 w-8 p-0 border-0 bg-transparent rounded-md"
                      />
                      <span className="ml-2 text-xs text-gray-600 dark:text-gray-400 font-mono">
                        {lightModeToColor}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const temp = lightModeFromColor;
                    setLightModeFromColor(lightModeToColor);
                    setLightModeToColor(temp);
                  }}
                  className="mt-2 w-full flex items-center justify-center gap-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 p-2 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-colors"
                >
                  <ArrowLeftRight className="w-3 h-3" />
                  Swap Light Mode Colors
                </button>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Dark Mode Colors
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      From Color
                    </label>
                    <div className="flex items-center">
                      <input
                        type="color"
                        value={darkModeFromColor}
                        onChange={(e) => setDarkModeFromColor(e.target.value)}
                        className="h-8 w-8 p-0 border-0 bg-transparent rounded-md"
                      />
                      <span className="ml-2 text-xs text-gray-600 dark:text-gray-400 font-mono">
                        {darkModeFromColor}
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
                        value={darkModeToColor}
                        onChange={(e) => setDarkModeToColor(e.target.value)}
                        className="h-8 w-8 p-0 border-0 bg-transparent rounded-md"
                      />
                      <span className="ml-2 text-xs text-gray-600 dark:text-gray-400 font-mono">
                        {darkModeToColor}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const temp = darkModeFromColor;
                    setDarkModeFromColor(darkModeToColor);
                    setDarkModeToColor(temp);
                  }}
                  className="mt-2 w-full flex items-center justify-center gap-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 p-2 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-colors"
                >
                  <ArrowLeftRight className="w-3 h-3" />
                  Swap Dark Mode Colors
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Timezone Settings */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden mt-6">
        <div className="border-b border-gray-200 dark:border-gray-800 px-5 py-3 flex items-center">
          <Globe className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
          <h2 className="text-sm font-medium text-gray-900 dark:text-white">
            Timezone Settings
          </h2>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Your Timezone
            </label>
            <select
              value={showCustomTimezone ? "custom" : timezone}
              onChange={handleTimezoneChange}
              className="w-full p-2.5 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-gray-400 dark:focus:border-gray-500"
            >
              {/* Display auto-detected timezone first */}
              <option value={getUserTimezone()}>
                {formatTimezone(getUserTimezone())} (Auto-detected)
              </option>

              {/* Common timezones */}
              <optgroup label="Common Timezones">
                {COMMON_TIMEZONES.filter((tz) => tz !== getUserTimezone()).map(
                  (tz) => (
                    <option key={tz} value={tz}>
                      {formatTimezone(tz)}
                    </option>
                  )
                )}
              </optgroup>

              {/* Custom option */}
              <option value="custom">Custom Timezone...</option>
            </select>

            {/* Custom timezone input */}
            {showCustomTimezone && (
              <div className="mt-2">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Enter Custom Timezone (IANA format, e.g. "America/New_York")
                </label>
                <input
                  type="text"
                  value={customTimezone}
                  onChange={handleCustomTimezoneChange}
                  placeholder="Continent/City"
                  className="w-full p-2.5 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-gray-400 dark:focus:border-gray-500"
                />
              </div>
            )}

            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              All times in the app will be displayed in this timezone
            </p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-md text-xs text-gray-600 dark:text-gray-400">
            <div className="font-medium mb-1">
              Current time in selected timezone:
            </div>
            <div className="text-sm text-gray-900 dark:text-white">
              {(() => {
                try {
                  return new Date().toLocaleString("en-US", {
                    timeZone: showCustomTimezone ? customTimezone : timezone,
                    dateStyle: "full",
                    timeStyle: "long",
                  });
                } catch (e) {
                  return "Invalid timezone";
                }
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Settings */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden mt-6">
        <div className="border-b border-gray-200 dark:border-gray-800 px-5 py-3 flex items-center">
          <Keyboard className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
          <h2 className="text-sm font-medium text-gray-900 dark:text-white">
            Keyboard Shortcuts
          </h2>
        </div>
        <div className="p-5">
          <ShortcutSettings />
        </div>
      </div>

      {/* Working Hours Goals Settings */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden mt-6">
        <div className="border-b border-gray-200 dark:border-gray-800 px-5 py-3 flex items-center">
          <Calendar className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
          <h2 className="text-sm font-medium text-gray-900 dark:text-white">
            Focus Goals
          </h2>
        </div>
        <div className="p-5">
          <WorkingHoursSettings />
        </div>
      </div>

      {/* Signal Settings */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden mt-6">
        <div className="border-b border-gray-200 dark:border-gray-800 px-5 py-3 flex items-center">
          <BarChart className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
          <h2 className="text-sm font-medium text-gray-900 dark:text-white">
            Signal Settings
          </h2>
        </div>
        <div className="p-5">
          <SignalSettings />
        </div>
      </div>

      {/* Morning Page Settings */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden mt-6">
        <div className="border-b border-gray-200 dark:border-gray-800 px-5 py-3 flex items-center">
          <Sunrise className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
          <h2 className="text-sm font-medium text-gray-900 dark:text-white">
            Morning Page
          </h2>
        </div>
        <div className="p-5">
          <MorningSettings />
        </div>
      </div>

      {/* Weekly Review Settings */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden mt-6">
        <div className="border-b border-gray-200 dark:border-gray-800 px-5 py-3 flex items-center">
          <ClipboardList className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
          <h2 className="text-sm font-medium text-gray-900 dark:text-white">
            Weekly Review
          </h2>
        </div>
        <div className="p-5">
          <ReviewSettings />
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
