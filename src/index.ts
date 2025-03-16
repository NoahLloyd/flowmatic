import {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  nativeImage,
  Menu,
  globalShortcut,
} from "electron";
import axios from "axios";
import path from "path";

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
    },
    icon: path.join(__dirname, "assets", "icon.jpg"), // Add this line for window icon
  });

  if (process.platform === "darwin") {
    app.dock.setIcon(path.join(__dirname, "assets", "icon.jpg"));
  }

  // Register global shortcut
  globalShortcut.register("Alt+Space", () => {
    if (mainWindow) {
      mainWindow.webContents.send("toggle-timer");
    }
  });

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
const API_BASE_URL = "http://127.0.0.1:8000"; // local development server
// const API_BASE_URL = "https://flow-backend-9kgo.onrender.com"; // production server

ipcMain.handle("api-request", async (_event, { method, endpoint, options }) => {
  try {
    const response = await axios({
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: options?.headers, // Pass headers directly
      data: options?.body, // Use body for request data
      // Remove params as we're not using query parameters for auth
    });
    return response.data;
  } catch (error) {
    console.error(`Error making ${method} request to ${endpoint}:`, error);
    if (axios.isAxiosError(error) && error.response) {
      throw error.response.data;
    }
    throw error;
  }
});

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
