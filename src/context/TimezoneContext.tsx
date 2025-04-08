import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

type TimezoneContextType = {
  timezone: string;
  setTimezone: (timezone: string) => void;
  formatDate: (date: Date | string | number) => string;
  formatTime: (date: Date | string | number) => string;
  formatDateTime: (date: Date | string | number) => string;
  getUserTimezone: () => string;
};

const TimezoneContext = createContext<TimezoneContextType | undefined>(
  undefined
);

// Get user's current timezone
const getUserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    return "UTC";
  }
};

export const TimezoneProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [timezone, setTimezoneState] = useState<string>(
    user?.preferences?.timezone || getUserTimezone()
  );

  // Update timezone when user preferences change
  useEffect(() => {
    if (user?.preferences?.timezone) {
      setTimezoneState(user.preferences.timezone);
    }
  }, [user?.preferences?.timezone]);

  // Function to format a date according to the user's timezone
  const formatDate = (date: Date | string | number) => {
    try {
      return new Date(date).toLocaleDateString("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (error) {
      console.error("Failed to format date with timezone:", error);
      return new Date(date).toLocaleDateString("en-US");
    }
  };

  // Function to format a time according to the user's timezone
  const formatTime = (date: Date | string | number) => {
    try {
      return new Date(date).toLocaleTimeString("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      console.error("Failed to format time with timezone:", error);
      return new Date(date).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  };

  // Function to format a date and time according to the user's timezone
  const formatDateTime = (date: Date | string | number) => {
    try {
      return new Date(date).toLocaleString("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      console.error("Failed to format datetime with timezone:", error);
      return new Date(date).toLocaleString("en-US");
    }
  };

  // Function to set the timezone
  const setTimezone = (newTimezone: string) => {
    setTimezoneState(newTimezone);
  };

  return (
    <TimezoneContext.Provider
      value={{
        timezone,
        setTimezone,
        formatDate,
        formatTime,
        formatDateTime,
        getUserTimezone,
      }}
    >
      {children}
    </TimezoneContext.Provider>
  );
};

export const useTimezone = () => {
  const context = useContext(TimezoneContext);
  if (context === undefined) {
    throw new Error("useTimezone must be used within a TimezoneProvider");
  }
  return context;
};

export default TimezoneContext;
