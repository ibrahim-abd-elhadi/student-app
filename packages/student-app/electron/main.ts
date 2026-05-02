import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron';
import * as path from 'path';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import * as os from 'os';

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');

// Hide security warnings in development (remove for production)
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

const isDev = !app.isPackaged;
const DEV_BASE_URL = 'http://localhost:5174';

let loginWin: BrowserWindow | null = null;
let mainWin: BrowserWindow | null = null;

const stateFile = path.join(app.getPath('userData'), 'session.json');

interface Session {
  base_url: string;
  access_token: string;
  refresh_token: string;
  user: { id: string; display_name: string; classroom_id: string };
}

function loadSession(): Session | null {
  try {
    if (!existsSync(stateFile)) return null;
    return JSON.parse(readFileSync(stateFile, 'utf8'));
  } catch {
    return null;
  }
}

function saveSession(s: Session | null) {
  if (s) writeFileSync(stateFile, JSON.stringify(s), 'utf8');
}

function getPreloadPath() {
  return path.join(__dirname, 'preload.js');
}

function getLoginURL() {
  if (isDev) return `${DEV_BASE_URL}/login`;
  return `file://${path.join(__dirname, '..', 'dist-renderer', 'login.html')}`;
}

function getMainAppURL() {
  if (isDev) return `${DEV_BASE_URL}?mode=host`;
  return `file://${path.join(__dirname, '..', 'dist-renderer', 'index.html')}?mode=host`;
}

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

ipcMain.handle('login:complete', async (_, payload: Session) => {
  saveSession(payload);
  loginWin?.close();
  createMainWindow();
});
ipcMain.handle('session:get', async () => loadSession());
ipcMain.handle('host:info', () => ({ hostname: os.hostname(), platform: process.platform }));

// Placeholder handlers – replace with real logic when needed
ipcMain.handle('lock:apply', async (_, msg) => console.log('lock:apply', msg));
ipcMain.handle('lock:release', async () => console.log('lock:release'));
ipcMain.handle('exam:open', async (_, payload) => console.log('exam:open', payload));
ipcMain.handle('exam:close', async () => console.log('exam:close'));

app.whenReady().then(() => {
  createLoginWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createLoginWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !mainWin) app.quit();
});
app.on('will-quit', () => globalShortcut.unregisterAll());