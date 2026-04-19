import { app, ipcMain, BrowserWindow, shell } from "electron";
import path from "path";
import fs from "fs";
import os from "os";
import { spawn, execFile, ChildProcessWithoutNullStreams } from "child_process";

function findClaudeBinary(): string {
  const home = os.homedir();
  const candidates = [
    path.join(home, ".bun/bin/claude"),
    path.join(home, ".claude/local/claude"),
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
    "/usr/bin/claude",
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      /* noop */
    }
  }
  return "claude";
}

function augmentedPath(): string {
  const home = os.homedir();
  const extras = [
    path.join(home, ".bun/bin"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
  ];
  const existing = process.env.PATH || "";
  return [...extras, existing].filter(Boolean).join(path.delimiter);
}

const SANDBOX_DIRNAME = "insights-sandbox";
const OUTPUT_FILENAME = "output.html";

const OBSIDIAN_VAULT = path.join(
  os.homedir(),
  "Documents",
  "Mapping the future",
);

interface ObsidianTaskOut {
  file: string;
  line: number;
  indent: number;
  raw_text: string;
  text_hash: string;
  display: string;
  tags: string[];
  due_date: string | null;
  scheduled_date: string | null;
  priority: string | null;
}

const TASK_RE = /^(\s*)-\s+\[ \]\s+(.+?)\s*$/;
const TAG_RE = /(?<!\S)#([A-Za-z0-9_/-]+)/g;
const DUE_RE = /📅\s*(\d{4}-\d{2}-\d{2})/;
const SCHEDULED_RE = /⏳\s*(\d{4}-\d{2}-\d{2})/;
const PRIORITY_EMOJIS: Array<[string, string]> = [
  ["🔺", "highest"],
  ["⏫", "high"],
  ["🔼", "medium"],
  ["🔽", "low"],
  ["⏬", "lowest"],
];
const STRIP_EMOJIS = ["🔺", "⏫", "🔼", "🔽", "⏬", "📅", "⏳", "🛫", "✅", "➕", "⏰"];

function hashTask(fileRel: string, body: string): string {
  const crypto = require("crypto") as typeof import("crypto");
  return crypto
    .createHash("sha256")
    .update(`${fileRel}\n${body}`)
    .digest("hex")
    .slice(0, 16);
}

function parseTaskMeta(text: string): Omit<ObsidianTaskOut, "file" | "line" | "indent" | "raw_text" | "text_hash"> {
  const tags = Array.from(new Set(Array.from(text.matchAll(TAG_RE), (m) => m[1]))).sort();
  const due = DUE_RE.exec(text);
  const sched = SCHEDULED_RE.exec(text);
  let priority: string | null = null;
  for (const [emoji, name] of PRIORITY_EMOJIS) {
    if (text.includes(emoji)) {
      priority = name;
      break;
    }
  }
  let display = text;
  for (const emoji of STRIP_EMOJIS) display = display.split(emoji).join("");
  display = display.replace(/\s+/g, " ").trim();
  return {
    display,
    tags,
    due_date: due ? due[1] : null,
    scheduled_date: sched ? sched[1] : null,
    priority,
  };
}

function walkMarkdown(root: string, out: string[], rel = ""): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (rel === "" && (entry.name === "_templates" || entry.name === "templates")) continue;
    const childRel = rel ? path.join(rel, entry.name) : entry.name;
    if (entry.isDirectory()) {
      walkMarkdown(root, out, childRel);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(childRel);
    }
  }
}

function scanObsidianVault(): {
  vault: string;
  vault_abs: string;
  tasks: ObsidianTaskOut[];
  last_sync: string;
  file_count: number;
  vault_exists: boolean;
} {
  const tasks: ObsidianTaskOut[] = [];
  const files: string[] = [];
  const vaultExists = fs.existsSync(OBSIDIAN_VAULT);
  if (vaultExists) {
    walkMarkdown(OBSIDIAN_VAULT, files);
  }
  for (const rel of files) {
    let content: string;
    try {
      content = fs.readFileSync(path.join(OBSIDIAN_VAULT, rel), "utf8");
    } catch {
      continue;
    }
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const m = TASK_RE.exec(lines[i]);
      if (!m) continue;
      const body = m[2].trim();
      if (!body) continue;
      const meta = parseTaskMeta(body);
      tasks.push({
        file: rel,
        line: i,
        indent: m[1].length,
        raw_text: body,
        text_hash: hashTask(rel, body),
        ...meta,
      });
    }
  }
  return {
    vault: path.basename(OBSIDIAN_VAULT),
    vault_abs: OBSIDIAN_VAULT,
    tasks,
    last_sync: new Date().toISOString(),
    file_count: files.length,
    vault_exists: vaultExists,
  };
}

let currentProc: ChildProcessWithoutNullStreams | null = null;
let currentSessionId: string | null = null;
let outputWatcher: fs.FSWatcher | null = null;
let outputPoller: NodeJS.Timeout | null = null;

const getSandboxDir = () =>
  path.join(app.getPath("userData"), SANDBOX_DIRNAME);

const getOutputPath = () => path.join(getSandboxDir(), OUTPUT_FILENAME);

const CLAUDE_MD = `# Flowmatic Insights Sandbox

You are helping me explore my personal productivity data. All data is in \`data/\` as JSON.

## Files in data/

- \`profile.json\` — my user profile and preferences (goals, active signals, settings).
- \`sessions.json\` — focus sessions (date, minutes, focus score, notes).
- \`signals.json\` — daily signals (wake time, minutes to office, exercise, journaling content, etc.).
- \`tasks.json\` — tasks (daily / weekly / future / blocked / shopping, completed state).
- \`writings.json\` — morning journal entries.
- \`weekly_reviews.json\` — my weekly review notes and goals.
- \`notes.json\` — quick notes.
- \`garmin.json\` — Garmin wearable data (sleep, HRV, stress, body battery, steps, resting HR) and \`workouts[]\`. Optional.
- \`anki.json\` — daily Anki flashcard stats (reviews, retention, time). Optional.
- \`github.json\` — daily GitHub contribution counts + yearly breakdown + top repos. Optional.
- \`schema.md\` — field-level schema reference.

## How to answer a question

1. Read the files you need (\`Read\`, \`Bash\` with \`jq\`, or a small Node/Python script).
2. Compute whatever statistic or correlation you need. Prefer \`jq\` or a throw-away script.
3. When a visualization helps, write a self-contained \`output.html\` at the root of this directory. It will be displayed in an iframe next to the chat. Use inline CSS/JS only — no external CDN imports (CSP blocks them). SVG charts hand-rolled are fine; so are HTML tables and styled cards.
4. Always also reply in chat with a concise prose summary.

## Visualization conventions

- Dark-mode friendly (the app's theme is dark): background \`#0b0f19\`, text \`#e5e7eb\`, grid \`#1f2937\`, accent \`#818cf8\` (indigo), success \`#34d399\`, warn \`#f59e0b\`, danger \`#f87171\`.
- Keep charts responsive: \`width: 100%\`, \`viewBox\` on SVG.
- If rendering more than one view per question, use a single \`output.html\` with stacked sections.

## Things you can do freely

- Run \`jq\`, \`node\`, or any CLI tool.
- Write scratch files in this directory.
- Rewrite \`output.html\` as often as you want.

Keep chat responses short; put detail in \`output.html\`.
`;

function ensureSandbox() {
  const dir = getSandboxDir();
  const dataDir = path.join(dir, "data");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dir, "CLAUDE.md"), CLAUDE_MD);
  if (!fs.existsSync(getOutputPath())) {
    fs.writeFileSync(
      getOutputPath(),
      '<!doctype html><html><body style="background:#0b0f19;color:#6b7280;font-family:system-ui;padding:24px">Ask a question to render a chart.</body></html>'
    );
  }
}

function writeDataFiles(files: Record<string, unknown>) {
  const dir = path.join(getSandboxDir(), "data");
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, contents] of Object.entries(files)) {
    const safe = name.replace(/[^a-z0-9_.-]/gi, "_");
    fs.writeFileSync(path.join(dir, safe), JSON.stringify(contents, null, 2));
  }
}

function stopWatcher() {
  if (outputWatcher) {
    outputWatcher.close();
    outputWatcher = null;
  }
  if (outputPoller) {
    clearInterval(outputPoller);
    outputPoller = null;
  }
}

function startWatcher(win: BrowserWindow) {
  stopWatcher();
  const outputPath = getOutputPath();
  let lastMtimeMs = 0;
  let lastSize = -1;
  try {
    const st = fs.statSync(outputPath);
    lastMtimeMs = st.mtimeMs;
    lastSize = st.size;
  } catch {
    /* file may not exist yet */
  }

  const emit = () => {
    try {
      const stat = fs.statSync(outputPath);
      if (stat.mtimeMs === lastMtimeMs && stat.size === lastSize) return;
      lastMtimeMs = stat.mtimeMs;
      lastSize = stat.size;
      const html = fs.readFileSync(outputPath, "utf8");
      if (!win.isDestroyed()) {
        win.webContents.send("insights:preview", html);
      }
    } catch {
      /* ignore transient fs errors */
    }
  };

  // fs.watch for fast path (Linux inotify, macOS FSEvents).
  // On macOS, filename can be null and events fire for renames — be permissive
  // and let emit() filter out no-op changes via stat comparison.
  try {
    outputWatcher = fs.watch(getSandboxDir(), () => emit());
  } catch {
    outputWatcher = null;
  }
  // Polling fallback — fs.watch on macOS is unreliable when files are renamed/replaced
  // (which is what `Write` tool does). Poll every 500ms too.
  outputPoller = setInterval(emit, 500);
}

function killCurrent() {
  if (currentProc) {
    try {
      currentProc.kill("SIGTERM");
    } catch {
      /* noop */
    }
    currentProc = null;
  }
}

function sendMessage(win: BrowserWindow, prompt: string) {
  killCurrent();
  const sandbox = getSandboxDir();

  const args = [
    "-p",
    prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    "bypassPermissions",
    "--include-partial-messages",
  ];
  if (currentSessionId) {
    args.splice(2, 0, "--resume", currentSessionId);
  }

  const claudeBin = findClaudeBinary();
  const resolvedPath = augmentedPath();

  if (!win.isDestroyed()) {
    win.webContents.send("insights:stream", {
      type: "raw",
      text: `$ ${claudeBin} ${args
        .map((a) => (a === prompt ? JSON.stringify(a.slice(0, 60)) : a))
        .join(" ")}`,
    });
  }

  // Strip Electron-specific env vars that can confuse child node processes.
  const cleanEnv: Record<string, string | undefined> = { ...process.env };
  for (const k of Object.keys(cleanEnv)) {
    if (
      k.startsWith("ELECTRON_") ||
      k === "NODE_OPTIONS" ||
      k === "NODE_CHANNEL_FD" ||
      k === "NODE_CHANNEL_SERIALIZATION_MODE"
    ) {
      delete cleanEnv[k];
    }
  }
  cleanEnv.PATH = resolvedPath;

  let proc: ChildProcessWithoutNullStreams;
  try {
    proc = spawn(claudeBin, args, {
      cwd: sandbox,
      env: cleanEnv as NodeJS.ProcessEnv,
      stdio: ["ignore", "pipe", "pipe"],
    }) as ChildProcessWithoutNullStreams;
  } catch (err: any) {
    if (!win.isDestroyed()) {
      win.webContents.send(
        "insights:error",
        `spawn failed for ${claudeBin}: ${err?.message || err}\nPATH=${resolvedPath}`
      );
      win.webContents.send("insights:done", { code: -1, sessionId: currentSessionId });
    }
    return;
  }
  currentProc = proc;

  let stdoutBuf = "";
  proc.stdout.on("data", (chunk: Buffer) => {
    stdoutBuf += chunk.toString("utf8");
    let idx: number;
    while ((idx = stdoutBuf.indexOf("\n")) !== -1) {
      const line = stdoutBuf.slice(0, idx).trim();
      stdoutBuf = stdoutBuf.slice(idx + 1);
      if (!line) continue;
      try {
        const json = JSON.parse(line);
        if (json.type === "system" && json.subtype === "init" && json.session_id) {
          currentSessionId = json.session_id;
        }
        if (!win.isDestroyed()) {
          win.webContents.send("insights:stream", json);
        }
      } catch {
        if (!win.isDestroyed()) {
          win.webContents.send("insights:stream", { type: "raw", text: line });
        }
      }
    }
  });

  proc.stderr.on("data", (chunk: Buffer) => {
    if (!win.isDestroyed()) {
      win.webContents.send("insights:stderr", chunk.toString("utf8"));
    }
  });

  proc.on("close", (code) => {
    if (!win.isDestroyed()) {
      win.webContents.send("insights:done", { code, sessionId: currentSessionId });
    }
    if (currentProc === proc) currentProc = null;
  });

  proc.on("error", (err: NodeJS.ErrnoException) => {
    if (!win.isDestroyed()) {
      win.webContents.send(
        "insights:error",
        `${err.message}${err.code ? ` [${err.code}]` : ""}\nbinary=${claudeBin}\nPATH=${resolvedPath}`
      );
    }
  });
}

export function registerInsightsIPC(getMainWindow: () => BrowserWindow | null) {
  ipcMain.handle("insights:prepare", async () => {
    ensureSandbox();
    const sandbox = getSandboxDir();
    const win = getMainWindow();
    if (win) startWatcher(win);
    return { sandbox, outputPath: getOutputPath() };
  });

  ipcMain.handle("insights:write-data", async (_e, files: Record<string, unknown>) => {
    ensureSandbox();
    writeDataFiles(files);
    return { ok: true };
  });

  ipcMain.handle("insights:write-schema", async (_e, schemaMd: string) => {
    ensureSandbox();
    fs.writeFileSync(path.join(getSandboxDir(), "data", "schema.md"), schemaMd);
    return { ok: true };
  });

  ipcMain.handle("insights:send", async (_e, prompt: string) => {
    ensureSandbox();
    const win = getMainWindow();
    if (!win) throw new Error("No window");
    sendMessage(win, prompt);
    return { ok: true };
  });

  ipcMain.handle("insights:cancel", async () => {
    killCurrent();
    return { ok: true };
  });

  ipcMain.handle("insights:reset-session", async () => {
    killCurrent();
    currentSessionId = null;
    try {
      fs.writeFileSync(
        getOutputPath(),
        '<!doctype html><html><body style="background:#0b0f19;color:#6b7280;font-family:system-ui;padding:24px">Fresh session. Ask a question.</body></html>'
      );
    } catch {
      /* noop */
    }
    return { ok: true };
  });

  ipcMain.handle("insights:read-output", async () => {
    try {
      return fs.readFileSync(getOutputPath(), "utf8");
    } catch {
      return "";
    }
  });

  ipcMain.handle("insights:set-session-id", async (_e, sessionId: string | null) => {
    killCurrent();
    currentSessionId = sessionId;
    return { ok: true };
  });

  ipcMain.handle("insights:write-output", async (_e, html: string) => {
    ensureSandbox();
    try {
      fs.writeFileSync(getOutputPath(), html ?? "");
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("obsidian:read-tasks", async () => {
    try {
      const data = scanObsidianVault();
      console.log(
        `[obsidian] scan: vault_exists=${data.vault_exists} files=${data.file_count} tasks=${data.tasks.length} path=${data.vault_abs}`,
      );
      if (!data.vault_exists) {
        return {
          ok: false as const,
          error: `Vault not found at ${data.vault_abs}`,
        };
      }
      if (data.file_count === 0) {
        return {
          ok: false as const,
          error:
            "Can't read vault. Grant Flowmatic access in System Settings → Privacy & Security → Files and Folders → Documents.",
        };
      }
      // Cache to sandbox for any downstream reader (Insights agent, etc.)
      try {
        const outPath = path.join(
          getSandboxDir(),
          "data",
          "obsidian-tasks.json",
        );
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
      } catch {
        /* cache is best-effort */
      }
      return { ok: true as const, data };
    } catch (err: any) {
      return { ok: false as const, error: err?.message || String(err) };
    }
  });

  // Flip `- [ ]` → `- [x]` for the line whose hash matches, so completing an
  // Obsidian-sourced task in Flowmatic also checks it off in the vault.
  ipcMain.handle(
    "obsidian:mark-complete",
    async (
      _e,
      args: { vaultAbs: string; file: string; textHash: string },
    ) => {
      try {
        const { vaultAbs, file, textHash } = args;
        const fullPath = path.join(vaultAbs, file);
        // Safety: ensure the resolved path is still inside the vault so a
        // malformed `file` can't escape via `..`.
        const resolved = path.resolve(fullPath);
        if (!resolved.startsWith(path.resolve(vaultAbs))) {
          return { ok: false as const, error: "path escapes vault" };
        }

        const content = fs.readFileSync(resolved, "utf8");
        const lines = content.split("\n");
        const crypto = require("crypto") as typeof import("crypto");
        const hashOf = (body: string) =>
          crypto
            .createHash("sha256")
            .update(`${file}\n${body}`)
            .digest("hex")
            .slice(0, 16);

        const taskRe = /^(\s*)-\s+\[ \]\s+(.+?)\s*$/;
        let matchedLine = -1;
        for (let i = 0; i < lines.length; i++) {
          const m = taskRe.exec(lines[i]);
          if (!m) continue;
          const body = m[2].trim();
          if (hashOf(body) === textHash) {
            matchedLine = i;
            break;
          }
        }
        if (matchedLine === -1) {
          return { ok: false as const, error: "task not found" };
        }
        lines[matchedLine] = lines[matchedLine].replace(
          /-\s+\[ \]/,
          "- [x]",
        );
        // Atomic write: tmp file + rename so Obsidian never sees a partial file.
        const tmp = `${resolved}.flowmatic.tmp`;
        fs.writeFileSync(tmp, lines.join("\n"));
        fs.renameSync(tmp, resolved);
        return { ok: true as const, line: matchedLine };
      } catch (err: any) {
        return { ok: false as const, error: err?.message || String(err) };
      }
    },
  );

  // Explicit access check. Unlike `obsidian:read-tasks` which hides the error
  // kind, this returns the raw errno so Settings can distinguish
  // "denied by TCC" from "vault doesn't exist" from "unexpected error".
  ipcMain.handle("obsidian:check-access", async () => {
    const vault = OBSIDIAN_VAULT;
    const parent = path.dirname(vault);
    try {
      // Touching ~/Documents is what triggers the TCC prompt on macOS.
      fs.readdirSync(parent);
    } catch (err: any) {
      return {
        ok: false as const,
        path: vault,
        code: err?.code || "UNKNOWN",
        error: err?.message || String(err),
        stage: "documents" as const,
      };
    }
    if (!fs.existsSync(vault)) {
      return {
        ok: false as const,
        path: vault,
        code: "ENOENT",
        error: "Vault folder not found",
        stage: "vault" as const,
      };
    }
    let files: fs.Dirent[];
    try {
      files = fs.readdirSync(vault, { withFileTypes: true });
    } catch (err: any) {
      return {
        ok: false as const,
        path: vault,
        code: err?.code || "UNKNOWN",
        error: err?.message || String(err),
        stage: "vault" as const,
      };
    }
    const mdCount = files.filter(
      (f) => f.isFile() && f.name.endsWith(".md"),
    ).length;
    return {
      ok: true as const,
      path: vault,
      fileCount: files.length,
      mdCount,
    };
  });

  // Deep-link to the Documents folder pane in Privacy & Security so the user
  // can toggle Flowmatic on (once it appears there).
  ipcMain.handle("obsidian:open-privacy-settings", async () => {
    try {
      await shell.openExternal(
        "x-apple.systempreferences:com.apple.preference.security?Privacy_DocumentsFolder",
      );
      return { ok: true as const };
    } catch (err: any) {
      return { ok: false as const, error: err?.message || String(err) };
    }
  });

  // List every markdown file in the vault. Used by the "attach note" picker.
  ipcMain.handle("obsidian:list-files", async () => {
    try {
      if (!fs.existsSync(OBSIDIAN_VAULT)) {
        return { ok: false as const, error: "Vault not found" };
      }
      const files: string[] = [];
      walkMarkdown(OBSIDIAN_VAULT, files);
      return {
        ok: true as const,
        vault: path.basename(OBSIDIAN_VAULT),
        vault_abs: OBSIDIAN_VAULT,
        files,
      };
    } catch (err: any) {
      return { ok: false as const, error: err?.message || String(err) };
    }
  });

  // Open a vault file in Obsidian via the `obsidian://open` URL scheme.
  ipcMain.handle(
    "obsidian:open-file",
    async (_e, args: { file: string }) => {
      try {
        const vaultName = path.basename(OBSIDIAN_VAULT);
        const url = `obsidian://open?vault=${encodeURIComponent(
          vaultName,
        )}&file=${encodeURIComponent(args.file.replace(/\.md$/, ""))}`;
        await shell.openExternal(url);
        return { ok: true as const };
      } catch (err: any) {
        return { ok: false as const, error: err?.message || String(err) };
      }
    },
  );

  // macOS caches TCC decisions per bundle id. If the previous Flowmatic build
  // was denied silently (no usage description in Info.plist), the prompt will
  // not re-appear until we wipe the cached decision. `tccutil reset` does that
  // without requiring sudo.
  ipcMain.handle("obsidian:reset-permission", async () => {
    if (process.platform !== "darwin") {
      return { ok: false as const, error: "not-macos" };
    }
    return new Promise<{ ok: true } | { ok: false; error: string }>(
      (resolve) => {
        execFile(
          "/usr/bin/tccutil",
          ["reset", "SystemPolicyDocumentsFolder", "com.electron.flowmatic"],
          { timeout: 5000 },
          (error) => {
            if (error) {
              resolve({ ok: false, error: error.message });
            } else {
              resolve({ ok: true });
            }
          },
        );
      },
    );
  });

  ipcMain.handle("anki:read-stats", async () => {
    try {
      const ankiPath = path.join(getSandboxDir(), "data", "anki.json");
      const raw = fs.readFileSync(ankiPath, "utf8");
      const data = JSON.parse(raw) as {
        days?: Array<{ date: string; reviews: number }>;
        queue?: { due_remaining?: number };
        last_sync?: string;
      };
      const today = new Date().toISOString().slice(0, 10);
      const todayEntry = (data.days || []).find((d) => d.date === today);
      return {
        ok: true as const,
        reviewsToday: todayEntry?.reviews ?? 0,
        dueRemaining: data.queue?.due_remaining ?? null,
        lastSync: data.last_sync ?? null,
      };
    } catch (err: any) {
      return { ok: false as const, error: err?.message || String(err) };
    }
  });
}

export function disposeInsights() {
  killCurrent();
  stopWatcher();
}
