import {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  nativeImage,
  Menu,
  globalShortcut,
  screen,
} from "electron";
import path from "path";
import * as fs from "fs";
import { exec } from "child_process";

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const OVERLAY_WINDOW_WEBPACK_ENTRY: string;
declare const OVERLAY_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let overlayType: "task" | "note" = "task";
let tray: Tray | null = null;

// Default shortcuts
const DEFAULT_SHORTCUTS = {
  quickAddTask: "Alt+T",
  quickAddNote: "Alt+N",
};

// Get shortcuts config file path
const getShortcutsPath = () => {
  return path.join(app.getPath("userData"), "shortcuts.json");
};

// Load shortcuts from file
const loadShortcuts = (): typeof DEFAULT_SHORTCUTS => {
  try {
    const shortcutsPath = getShortcutsPath();
    if (fs.existsSync(shortcutsPath)) {
      const data = fs.readFileSync(shortcutsPath, "utf-8");
      return { ...DEFAULT_SHORTCUTS, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error("Error loading shortcuts:", error);
  }
  return DEFAULT_SHORTCUTS;
};

// Save shortcuts to file
const saveShortcuts = (shortcuts: typeof DEFAULT_SHORTCUTS) => {
  try {
    const shortcutsPath = getShortcutsPath();
    fs.writeFileSync(shortcutsPath, JSON.stringify(shortcuts, null, 2));
  } catch (error) {
    console.error("Error saving shortcuts:", error);
  }
};

// Create overlay window or use in-app modal if main window is fullscreen
const createOverlayWindow = (type: "task" | "note") => {
  // Check if main window is in fullscreen mode
  // If so, use in-app modal instead of separate overlay to avoid space switching
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isFullScreen()) {
    // Send event to main window to open in-app modal
    const channel =
      type === "task" ? "global-quick-add-task" : "global-quick-add-note";
    mainWindow.webContents.send(channel);
    mainWindow.focus();
    return;
  }

  // If overlay already exists, just focus it
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.focus();
    overlayWindow.webContents.send("overlay-focus");
    return;
  }

  overlayType = type;

  // Get the display where the cursor is
  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  const { width, height } = display.workAreaSize;
  const { x, y } = display.workArea;

  overlayWindow = new BrowserWindow({
    width: width,
    height: height,
    x: x,
    y: y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    hasShadow: false,
    focusable: true,
    webPreferences: {
      preload: OVERLAY_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWindow.loadURL(OVERLAY_WINDOW_WEBPACK_ENTRY);

  // Hide from dock on macOS
  if (process.platform === "darwin") {
    overlayWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
    });
  }

  // Focus the window
  overlayWindow.once("ready-to-show", () => {
    overlayWindow?.show();
    overlayWindow?.focus();
  });

  // Clean up on close
  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });

  // Note: We don't close on blur because the overlay handles its own backdrop click
  // The user can close with Escape or by clicking the backdrop
};

// Register global shortcuts
const registerGlobalShortcuts = () => {
  // Unregister existing shortcuts first
  globalShortcut.unregisterAll();

  const shortcuts = loadShortcuts();

  // Register toggle timer shortcut
  globalShortcut.register("Alt+Space", () => {
    if (mainWindow) {
      mainWindow.webContents.send("toggle-timer");
    }
  });

  // Register quick add task shortcut
  if (shortcuts.quickAddTask) {
    try {
      globalShortcut.register(shortcuts.quickAddTask, () => {
        createOverlayWindow("task");
      });
    } catch (error) {
      console.error("Failed to register quickAddTask shortcut:", error);
    }
  }

  // Register quick add note shortcut
  if (shortcuts.quickAddNote) {
    try {
      globalShortcut.register(shortcuts.quickAddNote, () => {
        createOverlayWindow("note");
      });
    } catch (error) {
      console.error("Failed to register quickAddNote shortcut:", error);
    }
  }
};

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
    },
    icon: path.join(__dirname, "assets", "icons", "png", "512x512.png"),
  });

  if (process.platform === "darwin") {
    app.dock.setIcon(
      path.join(__dirname, "assets", "icons", "png", "512x512.png")
    );
  }

  // Register all global shortcuts
  registerGlobalShortcuts();

  // Clean up shortcuts when window is closed
  mainWindow.on("closed", () => {
    globalShortcut.unregisterAll();
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  try {
    // Get the absolute path to the icon
    const iconPath = path.join(__dirname, "assets", "logo-black-Template.png");

    console.log("Attempting to load icon from:", iconPath);

    // Create a test image to verify it loads
    const icon = nativeImage.createFromPath(iconPath);
    const resizedIcon = icon.resize({
      width: 16,
      height: 16,
      quality: "best",
    });
    resizedIcon.setTemplateImage(true);

    console.log("Icon created successfully:", !icon.isEmpty());

    // Create the tray
    tray = new Tray(resizedIcon);

    console.log("Tray created successfully");

    tray.setToolTip("Flow");

    // Create context menu
    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Restart timer",
        click: () => {
          if (mainWindow) {
            mainWindow.webContents.send("toggle-timer");
          }
        },
      },
      {
        label: "Show App",
        click: () => {
          if (mainWindow) {
            mainWindow.show();
          }
        },
      },
      {
        label: "Quit",
        click: () => {
          app.quit();
        },
      },
    ]);

    tray.setContextMenu(contextMenu);

    // Add click handler for the tray icon
    tray.on("click", () => {
      if (mainWindow) {
        mainWindow.show();
      }
    });
  } catch (error) {
    console.error("Failed to create tray:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
    });
  }
};

ipcMain.on("update-tray", (_event, text: string) => {
  if (tray) {
    tray.setTitle(text);
  }
});

ipcMain.on("show-window", () => {
  if (mainWindow) {
    mainWindow.show();
  }
});

// Get shortcuts
ipcMain.handle("get-shortcuts", () => {
  return loadShortcuts();
});

// Update shortcuts
ipcMain.handle(
  "update-shortcuts",
  (_event, newShortcuts: typeof DEFAULT_SHORTCUTS) => {
    saveShortcuts(newShortcuts);
    registerGlobalShortcuts();
    return loadShortcuts();
  }
);

// Overlay window IPC handlers
ipcMain.handle("get-overlay-type", () => {
  return overlayType;
});

// Overlay task/note submission: forward to main window renderer which has Supabase session
// The renderer exposes `window.__flowApi` (see app.tsx) so executeJavaScript can call it.
ipcMain.handle("overlay-submit-task", async (_event, title: string) => {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) return false;

    const escapedTitle = JSON.stringify(title);
    const result = await mainWindow.webContents.executeJavaScript(`
      (async () => {
        try {
          const task = await window.__flowApi.createTask({ title: ${escapedTitle}, type: 'day', completed: false, completedAt: null, createdAt: new Date() });
          window.dispatchEvent(new CustomEvent('task-added-from-overlay', { detail: task }));
          return true;
        } catch (e) {
          console.error('Failed to create task from overlay:', e);
          return false;
        }
      })()
    `);

    return result;
  } catch (error) {
    console.error("Failed to create task from overlay:", error);
    return false;
  }
});

ipcMain.handle("overlay-submit-note", async (_event, content: string) => {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) return false;

    const escapedContent = JSON.stringify(content);
    const result = await mainWindow.webContents.executeJavaScript(`
      (async () => {
        try {
          await window.__flowApi.createNote({ content: ${escapedContent}, tags: [] });
          return true;
        } catch (e) {
          console.error('Failed to create note from overlay:', e);
          return false;
        }
      })()
    `);

    return result;
  } catch (error) {
    console.error("Failed to create note from overlay:", error);
    return false;
  }
});

ipcMain.on("overlay-close", () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
  }
});

// Do Not Disturb control for macOS
// Uses Shortcuts app via AppleScript for reliable Focus mode control
// Requires user to have shortcuts named "Focus On" and "Focus Off" set up
const setDoNotDisturb = (enabled: boolean): Promise<boolean> => {
  return new Promise((resolve) => {
    if (process.platform !== "darwin") {
      console.log("Do Not Disturb is only supported on macOS");
      resolve(false);
      return;
    }

    const shortcutName = enabled ? "Focus On" : "Focus Off";

    // Use AppleScript to run the shortcut - better permission handling
    const command = `osascript -e 'tell application "Shortcuts Events" to run shortcut "${shortcutName}"'`;

    console.log(`Running DND shortcut: ${shortcutName}`);

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(
          `Failed to run shortcut "${shortcutName}":`,
          error.message
        );
        if (stderr) console.error("stderr:", stderr);
        resolve(false);
        return;
      }

      console.log(`Do Not Disturb ${enabled ? "enabled" : "disabled"}`);
      resolve(true);
    });
  });
};

// IPC handler for Do Not Disturb
ipcMain.handle("set-do-not-disturb", async (_event, enabled: boolean) => {
  return await setDoNotDisturb(enabled);
});

app.whenReady().then(() => {
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
