import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron';
import * as path from 'path';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import * as os from 'os';

// Optimization: Disable hardware acceleration for better compatibility in restricted environments
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');

// Hide security warnings in development (remove for production)
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

const isDev = !app.isPackaged;
const DEV_BASE_URL = 'http://localhost:5174';

// Window references
let loginWin: BrowserWindow | null = null;
let dashboardWin: BrowserWindow | null = null;
let mainWin: BrowserWindow | null = null;

// Persistence: Store session data in a JSON file within the app's data directory
const stateFile = path.join(app.getPath('userData'), 'session.json');

interface Session {
  base_url: string;
  access_token: string;
  refresh_token: string;
  user: { id: string; display_name: string; classroom_id: string };
}

/**
 * Load session from disk.
 */
function loadSession(): Session | null {
  try {
    if (!existsSync(stateFile)) return null;
    return JSON.parse(readFileSync(stateFile, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Save session to disk.
 */
function saveSession(s: Session | null) {
  if (s) writeFileSync(stateFile, JSON.stringify(s), 'utf8');
}

function getPreloadPath() {
  return path.join(__dirname, 'preload.js');
}

// URL resolution helpers
function getLoginURL() {
  if (isDev) return `${DEV_BASE_URL}/login`;
  return `file://${path.join(__dirname, '..', 'dist-renderer', 'login.html')}`;
}

function getMainAppURL() {
  if (isDev) return `${DEV_BASE_URL}/exam.html?mode=host`;

  return `file://${path.join(__dirname, '..', 'dist-renderer', 'exam.html')}?mode=host`;
}

function getDashboardURL() {
  if (isDev) return `${DEV_BASE_URL}/dashboard.html`;
  return `file://${path.join(__dirname, '..', 'dist-renderer', 'dashboard.html')}`;
}

/**
 * Creates the initial login window.
 */
function createLoginWindow() {
  if (loginWin) return loginWin.focus();

  loginWin = new BrowserWindow({
    width: 420,
    height: 540,
    title: 'Student Login',
    resizable: false,
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      sandbox: false,
    },
  });

  loginWin.once('ready-to-show', () => {
    loginWin?.show();
    loginWin?.focus();
  });

  if (isDev) loginWin.webContents.openDevTools();

  loginWin.loadURL(getLoginURL()).catch(err => console.error('Login load error:', err));
  loginWin.on('closed', () => { loginWin = null; });
}

/**
 * Creates the dashboard window after successful login.
 */
function createDashboardWindow() {
  if (dashboardWin) {
    dashboardWin.show();
    dashboardWin.focus();
    return;
  }
  dashboardWin = new BrowserWindow({
    width: 960,
    height: 720,
    title: 'Student Dashboard',
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      sandbox: false,
    },
  });

  dashboardWin.once('ready-to-show', () => {
    dashboardWin?.show();
    dashboardWin?.focus();
  });

  if (isDev) dashboardWin.webContents.openDevTools();

  dashboardWin
    .loadURL(getDashboardURL())
    .catch((err) => console.error('Dashboard load error:', err));
  dashboardWin.on('closed', () => {
    dashboardWin = null;
  });
}

/**
 * Creates the main application window (exam host).
 */
function createMainWindow() {
  if (mainWin) {
    mainWin.show();
    mainWin.focus();
    return;
  }

  mainWin = new BrowserWindow({
    width: 1200,
    height: 800,
    show: true,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      sandbox: false,
    },
  });

  if (isDev) mainWin.webContents.openDevTools();

  mainWin.webContents.on('did-fail-load', (_, errorCode, errorDesc) => {
    console.error(`Main window failed: ${errorDesc} (${errorCode})`);
  });

  mainWin.loadURL(getMainAppURL()).catch(err => console.error('Main window load error:', err));
  mainWin.on('closed', () => { mainWin = null; });
}

/* ---------- IPC Communication ---------- */

// Handle login completion
ipcMain.handle('login:complete', async (_, payload: Session) => {
  saveSession(payload);
  loginWin?.close();
  createDashboardWindow();
});

// Handle dashboard transition to main app
ipcMain.handle('dashboard:ready', async () => {
  dashboardWin?.close();
  createMainWindow();
});

// Provide stored session to renderer
ipcMain.handle('session:get', async () => loadSession());

// Provide system information
ipcMain.handle('host:info', () => ({ hostname: os.hostname(), platform: process.platform }));

// Event handlers for real-time control (lock, exam, etc.)
ipcMain.handle('lock:apply', async (_, msg) => console.log('lock:apply', msg));
ipcMain.handle('lock:release', async () => console.log('lock:release'));
ipcMain.handle('exam:open', async (_, payload) => console.log('exam:open', payload));
ipcMain.handle('exam:close', async () => console.log('exam:close'));

/* ---------- App lifecycle ---------- */

app.whenReady().then(() => {
  createLoginWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createLoginWindow();
  });
});

app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar to stay active until the user quits explicitly
  if (process.platform !== 'darwin' && !mainWin) app.quit();
});

app.on('will-quit', () => {
  // Clean up all global shortcuts on exit
  globalShortcut.unregisterAll();
});
