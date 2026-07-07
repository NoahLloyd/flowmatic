import { ipcMain } from "electron";
import path from "path";
import fs from "fs";
import os from "os";
import { execFile } from "child_process";

// Dayflow (github.com/JerryZLiu/Dayflow) is a local-first macOS time tracker.
// It keeps everything in a GRDB/SQLite database at:
//   ~/Library/Application Support/Dayflow/chunks.sqlite
//
// Focus time is derived from the `timeline_cards` table: each row is a titled
// block of time with a `category`. Everything except "Distraction" and "Idle"
// counts as focused work — this mirrors Dayflow's own focus/distraction split
// (see its `day_goal_categories` table, where every real category is tagged
// `focus` and only "Distraction" is tagged `distraction`; "Idle" belongs to
// neither).
//
// We read the DB via the system `sqlite3` binary with `-readonly`, so we never
// take a write lock or trigger a checkpoint on a database another app owns.

const DAYFLOW_DB = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "Dayflow",
  "chunks.sqlite",
);

// Focus minutes per local day. CAST(...AS INTEGER) keeps the payload tiny and
// the renderer converts to hours. Rows with NULL start_ts (not yet analysed)
// are skipped.
const FOCUS_BY_DAY_SQL =
  "SELECT day, " +
  "CAST(ROUND(SUM(CASE WHEN category NOT IN ('Distraction','Idle') " +
  "THEN (end_ts - start_ts) ELSE 0 END) / 60.0) AS INTEGER) AS focus_minutes " +
  "FROM timeline_cards " +
  "WHERE is_deleted = 0 AND start_ts IS NOT NULL " +
  "GROUP BY day ORDER BY day;";

export type DayflowFocusResult =
  | {
      ok: true;
      dbPath: string;
      days: Array<{ day: string; focusHours: number }>;
    }
  | { ok: false; dbPath: string; error: string };

function runSqlite(dbPath: string, sql: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "/usr/bin/sqlite3",
      ["-readonly", "-json", dbPath, sql],
      { timeout: 10000, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout);
      },
    );
  });
}

export function registerDayflowIPC() {
  ipcMain.handle("dayflow:get-focus", async (): Promise<DayflowFocusResult> => {
    try {
      if (!fs.existsSync(DAYFLOW_DB)) {
        return {
          ok: false,
          dbPath: DAYFLOW_DB,
          error:
            "Dayflow database not found. Make sure Dayflow is installed and has tracked at least one day.",
        };
      }

      const raw = await runSqlite(DAYFLOW_DB, FOCUS_BY_DAY_SQL);
      // `sqlite3 -json` prints an empty string (not "[]") when there are no rows.
      const rows: Array<{ day: string; focus_minutes: number }> = raw.trim()
        ? JSON.parse(raw)
        : [];

      const days = rows
        .filter((r) => r && typeof r.day === "string")
        .map((r) => ({
          day: r.day,
          focusHours: Math.max(0, (Number(r.focus_minutes) || 0) / 60),
        }));

      return { ok: true, dbPath: DAYFLOW_DB, days };
    } catch (err: any) {
      return {
        ok: false,
        dbPath: DAYFLOW_DB,
        error: err?.message || String(err),
      };
    }
  });
}
