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
  const [autoDoNotDisturb, setAutoDoNotDisturb] = useState<boolean>(
    user?.preferences?.autoDoNotDisturb || false
  );
  const [stopwatchAlertMinutes, setStopwatchAlertMinutes] = useState<number>(
    user?.preferences?.stopwatchAlertMinutes || 60
  );
  const [signalPercentageGoal, setSignalPercentageGoal] = useState<number>(
    user?.preferences?.signalPercentageGoal || 75
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

  // DND test state
  const [dndTestStatus, setDndTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [dndTestMessage, setDndTestMessage] = useState("");
  const [accessStatus, setAccessStatus] = useState<"idle" | "requesting" | "granted" | "missing" | "error">("idle");
  const [missingShortcuts, setMissingShortcuts] = useState<string[]>([]);

  // Update state when user data changes
  useEffect(() => {
    if (user?.preferences) {
      setDefaultProject(user.preferences.defaultProject || "");
      setDefaultMinutes(user.preferences.defaultMinutes || 60);
      setAutoDoNotDisturb(user.preferences.autoDoNotDisturb || false);
      setStopwatchAlertMinutes(user.preferences.stopwatchAlertMinutes || 60);
      setSignalPercentageGoal(user.preferences.signalPercentageGoal || 75);
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
        autoDoNotDisturb,
        stopwatchAlertMinutes,
        signalPercentageGoal,
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
        ...(signalSettings.customSignals
          ? { customSignals: signalSettings.customSignals }
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
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Stopwatch Break Alert
              </label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="60"
                  value={stopwatchAlertMinutes}
                  onChange={(e) => setStopwatchAlertMinutes(Number(e.target.value))}
                  min={1}
                  max={480}
                  className="w-full p-2.5 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-gray-400 dark:focus:border-gray-500 pr-16"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">
                  minutes
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Background turns red after this many minutes in stopwatch mode
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Signal Percentage Goal
              </label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="75"
                  value={signalPercentageGoal}
                  onChange={(e) => setSignalPercentageGoal(Number(e.target.value))}
                  min={1}
                  max={100}
                  className="w-full p-2.5 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-gray-400 dark:focus:border-gray-500 pr-16"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">
                  %
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Signal score threshold for goal completion
              </p>
            </div>
            <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Auto Do Not Disturb
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Enable DND while timer is running (macOS only)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoDoNotDisturb(!autoDoNotDisturb)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 ${
                    autoDoNotDisturb
                      ? "bg-gray-900 dark:bg-white"
                      : "bg-gray-200 dark:bg-gray-700"
                  }`}
                  role="switch"
                  aria-checked={autoDoNotDisturb}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-900 shadow ring-0 transition duration-200 ease-in-out ${
                      autoDoNotDisturb ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {autoDoNotDisturb && (
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900/40 rounded-md border border-gray-200 dark:border-gray-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      DND Status
                    </span>
                    <button
                      onClick={async () => {
                        setDndTestStatus("testing");
                        setDndTestMessage("Testing Focus On...");
                        try {
                          const onResult: any = await window.electron.setDoNotDisturb(true);
                          const onOk = typeof onResult === "object" ? onResult.success : onResult;
                          const onError = typeof onResult === "object" ? onResult.error : null;
                          if (onOk) {
                            setDndTestMessage("Focus On worked! Testing Focus Off...");
                            await new Promise((r) => setTimeout(r, 1500));
                            const offResult: any = await window.electron.setDoNotDisturb(false);
                            const offOk = typeof offResult === "object" ? offResult.success : offResult;
                            const offError = typeof offResult === "object" ? offResult.error : null;
                            if (offOk) {
                              setDndTestStatus("success");
                              setDndTestMessage("DND is working correctly.");
                            } else {
                              setDndTestStatus("error");
                              setDndTestMessage(offError || "\"Focus Off\" shortcut failed.");
                            }
                          } else {
                            setDndTestStatus("error");
                            setDndTestMessage(onError || "\"Focus On\" shortcut failed.");
                          }
                        } catch (err) {
                          setDndTestStatus("error");
                          setDndTestMessage("Could not run shortcuts. See setup guide below.");
                        }
                      }}
                      disabled={dndTestStatus === "testing"}
                      className="text-xs px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                      {dndTestStatus === "testing" ? "Testing..." : "Test DND"}
                    </button>
                  </div>

                  {dndTestStatus !== "idle" && (
                    <div
                      className={`text-xs px-2 py-1.5 rounded-md mb-2 ${
                        dndTestStatus === "success"
                          ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
                          : dndTestStatus === "error"
                          ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                          : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                      }`}
                    >
                      {dndTestMessage}
                    </div>
                  )}

                  <div className="text-xs text-gray-600 dark:text-gray-400 space-y-3">
                    <p className="font-medium text-gray-700 dark:text-gray-300">
                      Setup Guide
                    </p>

                    {/* Step 1: Check shortcuts exist */}
                    <div className="space-y-1.5">
                      <p className="font-medium text-gray-700 dark:text-gray-300">
                        1. Check shortcuts are set up
                      </p>
                      <p>
                        Flowmatic uses the macOS <code className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">shortcuts</code> CLI
                        to run your Focus shortcuts. No extra permissions needed.
                      </p>
                      <button
                        onClick={async () => {
                          setAccessStatus("requesting");
                          setMissingShortcuts([]);
                          try {
                            const result = await window.electron.requestShortcutsAccess();
                            if (result === "granted") {
                              setAccessStatus("granted");
                            } else if (typeof result === "string" && result.startsWith("missing:")) {
                              setAccessStatus("missing");
                              setMissingShortcuts(result.replace("missing:", "").split(","));
                            } else {
                              setAccessStatus("error");
                            }
                          } catch {
                            setAccessStatus("error");
                          }
                        }}
                        disabled={accessStatus === "requesting"}
                        className="mt-1 text-xs px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 font-medium"
                      >
                        {accessStatus === "requesting"
                          ? "Checking..."
                          : accessStatus === "granted"
                          ? "Shortcuts found"
                          : "Check Shortcuts"}
                      </button>
                      {accessStatus === "granted" && (
                        <p className="text-green-600 dark:text-green-400">
                          Both "Focus On" and "Focus Off" shortcuts found.
                        </p>
                      )}
                      {accessStatus === "missing" && (
                        <p className="text-amber-600 dark:text-amber-400">
                          Missing shortcut{missingShortcuts.length > 1 ? "s" : ""}:{" "}
                          {missingShortcuts.map((s) => `"${s}"`).join(", ")}.
                          Create {missingShortcuts.length > 1 ? "them" : "it"} in the Shortcuts app (step 2 below).
                        </p>
                      )}
                      {accessStatus === "error" && (
                        <p className="text-red-600 dark:text-red-400">
                          Could not check shortcuts. Make sure macOS Shortcuts app is available.
                        </p>
                      )}
                    </div>

                    {/* Step 2: Create shortcuts */}
                    <div className="space-y-1.5">
                      <p className="font-medium text-gray-700 dark:text-gray-300">
                        2. Create the shortcuts
                      </p>
                      <ol className="list-decimal list-inside space-y-1 ml-1">
                        <li>
                          Open the <strong>Shortcuts</strong> app on your Mac
                        </li>
                        <li>
                          Create a shortcut named{" "}
                          <code className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">
                            Focus On
                          </code>{" "}
                          that turns on your preferred Focus mode
                        </li>
                        <li>
                          Create a shortcut named{" "}
                          <code className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">
                            Focus Off
                          </code>{" "}
                          that turns off Focus mode
                        </li>
                      </ol>
                    </div>

                    {/* Step 3: Test */}
                    <div className="space-y-1.5">
                      <p className="font-medium text-gray-700 dark:text-gray-300">
                        3. Test it using the button above
                      </p>
                    </div>
                  </div>
                </div>
              )}
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
