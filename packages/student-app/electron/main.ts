import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron';
import * as path from 'path';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import * as os from 'os';

// Optimization: Disable hardware acceleration for better compatibility
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

const isDev = !app.isPackaged;
const DEV_BASE_URL = 'http://localhost:5174';

// Window references
let loginWin: BrowserWindow | null = null;
let mainWin: BrowserWindow | null = null;
let hostWin: BrowserWindow | null = null;
let examWin: BrowserWindow | null = null;
let lockWin: BrowserWindow | null = null;
let pendingExamPayload: any = null;

// Persistence
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
  else if (existsSync(stateFile)) {
    try { writeFileSync(stateFile, '', 'utf8'); } catch {}
  }
}

function getPreloadPath() {
  return path.join(__dirname, 'preload.js');
}

function getLoginURL() {
  if (isDev) return `${DEV_BASE_URL}/login`;
  return `file://${path.join(__dirname, '..', 'dist-renderer', 'login.html')}`;
}

/** This is the HOST page – the hidden window that maintains the WebSocket */
function getHostURL() {
  if (isDev) return `${DEV_BASE_URL}/login?mode=host`;
  return `file://${path.join(__dirname, '..', 'dist-renderer', 'login.html')}?mode=host`;
}

function getDashboardURL() {
  if (isDev) return `${DEV_BASE_URL}/dashboard.html`;
  return `file://${path.join(__dirname, '..', 'dist-renderer', 'dashboard.html')}`;
}

/** This is the exam page – full‑screen when the exam starts */
function getExamURL() {
  if (isDev) return `${DEV_BASE_URL}/exam.html`;
  return `file://${path.join(__dirname, '..', 'dist-renderer', 'exam.html')}`;
}

function getLockURL(msg?: string) {
  const base = isDev
    ? `${DEV_BASE_URL}/lock.html`
    : `file://${path.join(__dirname, '..', 'dist-renderer', 'lock.html')}`;
  const params = msg ? `?msg=${encodeURIComponent(msg)}` : '';
  return base + params;
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

  mainWin.loadURL(getDashboardURL()).catch(err => console.error('Main window load error:', err));
  mainWin.on('closed', () => { mainWin = null; });
}

function createHostWindow() {
  if (hostWin) return;

  hostWin = new BrowserWindow({
    width: 360,
    height: 220,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      sandbox: false,
    },
  });

  hostWin.webContents.on('did-fail-load', (_, errorCode, errorDesc) => {
    console.error(`Host window failed: ${errorDesc} (${errorCode})`);
  });

  hostWin.loadURL(getHostURL()).catch(err => console.error('Host window load error:', err));
  hostWin.on('closed', () => { hostWin = null; });
}

// ===================== IPC Handlers =====================

ipcMain.handle('login:complete', async (_, payload: Session) => {
  console.log('[main] login:complete');
  saveSession(payload);
  createMainWindow();
  if (loginWin) {
    loginWin.close();
    loginWin = null;
  }
});

ipcMain.handle('host:ready', async () => {
  console.log('[main] host:ready');
  mainWin?.webContents.send('online:ready');
});

ipcMain.handle('session:get', async () => {
  return loadSession();
});

ipcMain.handle('host:info', () => ({ hostname: os.hostname(), platform: process.platform }));

ipcMain.handle('dashboard:ready', async () => {
  console.log('[main] dashboard:ready - starting host connection');
  createHostWindow();
});

ipcMain.handle('lock:apply', async (_, msg: string) => {
  console.log('[main] lock:apply', msg);
  
  // Close any existing lock window first
  if (lockWin) {
    lockWin.close();
    lockWin = null;
  }
  
  lockWin = new BrowserWindow({
    fullscreen: true,
    alwaysOnTop: true,
    frame: false,
    skipTaskbar: true,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Block common escape shortcuts
  globalShortcut.register('Alt+F4', () => {});
  globalShortcut.register('Ctrl+W', () => {});
  globalShortcut.register('Ctrl+Shift+Escape', () => {});
  globalShortcut.register('Cmd+W', () => {});
  globalShortcut.register('Escape', () => {});

  lockWin.loadURL(getLockURL(msg)).catch(console.error);
  lockWin.on('closed', () => {
    lockWin = null;
    globalShortcut.unregisterAll();
  });
});

ipcMain.handle('lock:release', async () => {
  console.log('[main] lock:release');
  if (lockWin) {
    lockWin.close();
    lockWin = null;
  }
  globalShortcut.unregisterAll();
});

ipcMain.handle('exam:open', async (_, payload: any) => {
  console.log('[main] exam:open', payload);
  pendingExamPayload = payload;
  if (examWin) {
    examWin.focus();
    examWin.webContents.send('exam:start', payload);
    return;
  }
  
  examWin = new BrowserWindow({
    fullscreen: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      sandbox: false,
    },
  });

  examWin.loadURL(getExamURL()).catch(err => console.error('[main] exam window load error:', err));

  examWin.on('closed', () => {
    console.log('[main] exam window closed');
    examWin = null;
  });
});

ipcMain.handle('exam:close', async () => {
  console.log('[main] exam:close');
  pendingExamPayload = null;
  if (examWin) {
    examWin.close();
    examWin = null;
  }
});

ipcMain.handle('exam:get-pending', async () => pendingExamPayload);

// ===================== App Lifecycle =====================

app.whenReady().then(() => {
  console.log('[main] App ready, creating login window');
  createLoginWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createLoginWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !mainWin) app.quit();
});
app.on('will-quit', () => globalShortcut.unregisterAll());
