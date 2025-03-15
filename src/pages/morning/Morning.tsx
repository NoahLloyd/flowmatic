import React, { useState, useEffect, useCallback } from "react";
import { Calendar, Star, Check, Loader } from "lucide-react";
import { api } from "../../utils/api";
import { MorningEntry } from "../../types/Morning";
import { useAuth } from "../../context/AuthContext";
import { debounce } from "lodash";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const Morning = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<MorningEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState("");
  const [streak, setStreak] = useState(0);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [highlightedDates, setHighlightedDates] = useState<Date[]>([]);

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // Load entries and streak on mount
  useEffect(() => {
    const loadEntries = async () => {
      try {
        const data = await api.getAllEntries();
        setEntries(data.entries);
        setStreak(data.streak);

        const dates = data.entries
          .filter((entry) => entry.content?.trim())
          .map((entry) => new Date(entry.date));
        setHighlightedDates(dates);
      } catch (error) {
        console.error("Failed to load entries:", error);
      }
    };

    loadEntries();
  }, []);

  // Load current date's entry
  useEffect(() => {
    const loadCurrentEntry = async () => {
      try {
        const { content } = await api.getEntry(selectedDate);
        setCurrentEntry(content);
      } catch (error) {
        console.error("Failed to load entry:", error);
      }
    };

    loadCurrentEntry();
  }, [selectedDate]);

  // Debounced save function
  const debouncedSave = useCallback(
    debounce(async (date: string, content: string) => {
      try {
        setIsSaving(true);
        await api.updateEntry(date, content);
        setLastSaved(new Date());
        setHasPendingChanges(false);
        setEntries((prevEntries) => {
          const userId = localStorage.getItem("name");
          const entryIndex = prevEntries.findIndex(
            (entry) => entry.date === date && entry.user_id === userId
          );
          if (entryIndex >= 0) {
            const newEntries = [...prevEntries];
            newEntries[entryIndex] = {
              date,
              content,
              user_id: userId,
            };
            return newEntries;
          } else {
            return [
              ...prevEntries,
              {
                date,
                content,
                user_id: userId,
              },
            ];
          }
        });
      } catch (error) {
        console.error("Failed to save entry:", error);
      } finally {
        setIsSaving(false);
      }
    }, 500),
    []
  );

  // Auto-save when content changes
  useEffect(() => {
    if (currentEntry) {
      debouncedSave(selectedDate, currentEntry);
    }
  }, [currentEntry, selectedDate, debouncedSave]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setHasPendingChanges(true);
    let newText = e.target.value;
    const lastChar = newText[e.target.selectionStart - 1];
    const textBeforeCursor = newText.slice(0, e.target.selectionStart);
    const textAfterCursor = newText.slice(e.target.selectionStart);
    const lastWord = textBeforeCursor.split("\n").pop()?.trim();

    if (lastChar === " ") {
      if (lastWord === "#") {
        newText = textBeforeCursor.slice(0, -2) + "# " + textAfterCursor;
      } else if (lastWord === "-") {
        newText = textBeforeCursor.slice(0, -2) + "• " + textAfterCursor;
      } else if (lastWord === "*") {
        newText = textBeforeCursor.slice(0, -2) + "**" + textAfterCursor;
      }
    }

    setCurrentEntry(newText);
  };

  const handleDateChange = (date: Date) => {
    setSelectedDate(date.toISOString().split("T")[0]);
    setIsCalendarOpen(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-8 dark:bg-slate-900">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <Star className="w-5 h-5 text-yellow-500" />
            <span className="text-slate-700 dark:text-slate-200">
              {streak} day streak
            </span>
          </div>
        </div>
        <div className="relative flex items-center space-x-2">
          <button
            onClick={() => setIsCalendarOpen(!isCalendarOpen)}
            className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            {isSaving || hasPendingChanges ? (
              <Loader className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            ) : lastSaved ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : null}
          </button>
          {isCalendarOpen && (
            <div className="absolute top-full right-0 mt-2 z-10">
              <DatePicker
                selected={new Date(selectedDate)}
                onChange={handleDateChange}
                inline
                maxDate={new Date()}
                highlightDates={highlightedDates}
                dayClassName={(date) =>
                  highlightedDates.some(
                    (d) =>
                      d.toISOString().split("T")[0] ===
                      date.toISOString().split("T")[0]
                  )
                    ? "highlighted-date"
                    : undefined
                }
              />
            </div>
          )}
        </div>
      </div>

      <div className="w-full mt-4">
        <textarea
          value={currentEntry}
          onChange={handleTextChange}
          placeholder="Write your morning entry here..."
          className="w-full h-[calc(100vh-16rem)] p-6 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-600 resize-none font-sans text-slate-700 dark:text-slate-200 text-lg leading-relaxed placeholder-slate-400 dark:placeholder-slate-500"
          spellCheck="true"
        />
      </div>
    </div>
  );
};

export default Morning;
