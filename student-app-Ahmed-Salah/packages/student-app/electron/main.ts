/// <reference types="node" />
import { app, BrowserWindow, Tray, Menu, ipcMain, IpcMainInvokeEvent } from "electron";
import * as path from "path";
import * as os from "os";

// 🔹 Global type declarations for CommonJS globals
declare global {
  var __dirname: string;
  var __filename: string;
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// 🔹 Session storage
interface Session {
  base_url: string;
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    display_name: string;
    classroom_id: string;
  };
}
let currentSession: Session | null = null;

// 🔹 Create hidden window
function createWindow() {
// In CommonJS, __dirname is automatically available
const preloadScript = path.join(__dirname, "preload.js");

mainWindow = new BrowserWindow({
width: 1000,
height: 700,
show: false, // 🔥 start hidden
webPreferences: {
nodeIntegration: false, // ✅ Security: disable direct Node access
contextIsolation: true, // ✅ Security: enable context isolation
preload: preloadScript, // ✅ Use preload script
},
});

mainWindow.webContents.on("devtools-opened", () => {
  mainWindow?.webContents.closeDevTools();
});

mainWindow.loadURL("http://localhost:5174/login"); // ✅ Correct port from vite.config.ts

// 🔹 Prevent closing
mainWindow.on("close", (event: any) => {
event.preventDefault();
mainWindow?.hide();
});
}

// 🔹 Create system tray
function createTray() {
// Use a fallback icon path - in production this should exist in dist-electron/
const iconPath = path.join(__dirname, "icon.png");
tray = new Tray(iconPath);

const contextMenu = Menu.buildFromTemplate([
{
label: "Open",
click: () => mainWindow?.show(),
},
{
label: "Quit",
click: () => {
// Allow app to quit when user explicitly requests it
app.exit(0);
},
},
]);

tray.setToolTip("Student App Running");
tray.setContextMenu(contextMenu);

tray.on("double-click", () => {
mainWindow?.show();
});
}

// 🔹 App ready
app.whenReady().then(async () => {
createWindow();
createTray();
});

// 🔹 Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
app.quit();
} else {
app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});
}

// 🔹 Prevent quitting completely when all windows closed
app.on("window-all-closed", (e: any) => {
e.preventDefault();
});

// 🔹 IPC Handlers for lock mode
ipcMain.on("LOCK_APP", () => {
if (mainWindow) {
mainWindow.setFullScreen(true);
mainWindow.setAlwaysOnTop(true);
mainWindow.show();
}
});

ipcMain.on("UNLOCK_APP", () => {
if (mainWindow) {
mainWindow.setFullScreen(false);
mainWindow.setAlwaysOnTop(false);
}
});

// 🔹 IPC Handlers for Preload Bridge
ipcMain.handle("login:complete", async (event: IpcMainInvokeEvent, payload: Session) => {
currentSession = payload;
// In host mode, load the login page with ?mode=host query
if (mainWindow) {
mainWindow.loadURL(`http://localhost:5174/login?mode=host`);
}
});

ipcMain.handle("host:info", async (event: IpcMainInvokeEvent) => {
return {
hostname: os.hostname(),
platform: process.platform,
};
});

ipcMain.handle("session:get", async (event: IpcMainInvokeEvent) => {
return currentSession;
});

ipcMain.handle("dashboard:ready", async (event: IpcMainInvokeEvent) => {
// Called when dashboard is ready
console.log("[IPC] Dashboard ready");
});

ipcMain.handle("lock:apply", async (event: IpcMainInvokeEvent, message: string) => {
if (mainWindow) {
mainWindow.setFullScreen(true);
mainWindow.setAlwaysOnTop(true);
mainWindow.webContents.send("lock:applied", { message });
mainWindow.show();
}
});

ipcMain.handle("lock:release", async (event: IpcMainInvokeEvent) => {
if (mainWindow) {
mainWindow.setFullScreen(false);
mainWindow.setAlwaysOnTop(false);
mainWindow.webContents.send("lock:released");
}
});

ipcMain.handle("exam:open", async (event: IpcMainInvokeEvent, payload: any) => {
if (mainWindow) {
mainWindow.loadURL(`http://localhost:5174/exam?id=${payload.id}`);
mainWindow.webContents.send("exam:started", payload);
}
});

ipcMain.handle("exam:close", async (event: IpcMainInvokeEvent) => {
if (mainWindow) {
mainWindow.loadURL(`http://localhost:5174/dashboard`);
mainWindow.webContents.send("exam:closed");
}
});
