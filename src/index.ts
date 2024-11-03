import { app, BrowserWindow, ipcMain, Tray, nativeImage, Menu } from "electron";
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
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  try {
    // For development, use a direct path to the icon
    const iconPath = path.join(__dirname, "../src/logo-black.png");

    tray = new Tray(nativeImage.createFromPath(iconPath));
    tray.setToolTip("Flow Timer");

    // Add click handler
    tray.on("click", () => {
      if (mainWindow) {
        mainWindow.show();
      }
    });
  } catch (error) {
    console.error("Failed to create tray:", error);
  }

  const contextMenu = Menu.buildFromTemplate([
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

  tray.on("click", () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });
};

ipcMain.on("update-tray-tooltip", (_event, tooltip: string) => {
  if (tray) {
    tray.setToolTip(tooltip);
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
