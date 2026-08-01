/**
 * Flowmatic's daily data rolls over at 3:00 AM instead of midnight. This lets
 * late-night work, signals, and completed daily tasks stay attached to the day
 * that was still in progress when they were recorded.
 */
export const APP_DAY_RESET_HOUR = 3;

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const getDateParts = (date: Date, timezone?: string): DateParts => {
  if (!timezone) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
    };
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
  };
};

const formatDateParts = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/** Return the YYYY-MM-DD key for the app day containing `date`. */
export const getAppDayKey = (
  date: Date = new Date(),
  timezone?: string,
): string => {
  let parts: DateParts;
  try {
    parts = getDateParts(date, timezone);
  } catch {
    parts = getDateParts(date);
  }

  if (parts.hour >= APP_DAY_RESET_HOUR) {
    return formatDateParts(parts.year, parts.month, parts.day);
  }

  // Use UTC only as a calendar-arithmetic container. The source parts already
  // represent the requested timezone, so this safely handles month/year edges.
  const previousDay = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day - 1),
  );
  return formatDateParts(
    previousDay.getUTCFullYear(),
    previousDay.getUTCMonth() + 1,
    previousDay.getUTCDate(),
  );
};

/** Return a local Date representing the current app day's calendar date. */
export const getAppDayDate = (date: Date = new Date()): Date => {
  const [year, month, day] = getAppDayKey(date).split("-").map(Number);
  return new Date(year, month - 1, day);
};

/** Check whether a timestamp belongs to the current app day. */
export const isCurrentAppDay = (
  value: Date | string | number,
  now: Date = new Date(),
  timezone?: string,
): boolean => {
  const date = value instanceof Date ? value : new Date(value);
  return (
    !Number.isNaN(date.getTime()) &&
    getAppDayKey(date, timezone) === getAppDayKey(now, timezone)
  );
};

/**
 * Return the hour elapsed within an app day. Midnight through 2:59 AM maps to
 * 24–26.99, which is useful for warnings scheduled before the 3:00 AM reset.
 */
export const getAppDayHour = (
  date: Date = new Date(),
  timezone?: string,
): number => {
  let parts: DateParts;
  try {
    parts = getDateParts(date, timezone);
  } catch {
    parts = getDateParts(date);
  }
  const hour = parts.hour + parts.minute / 60;
  return parts.hour < APP_DAY_RESET_HOUR ? hour + 24 : hour;
};
