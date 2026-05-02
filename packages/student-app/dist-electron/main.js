"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs_1 = require("fs");
const os = __importStar(require("os"));
electron_1.app.disableHardwareAcceleration();
electron_1.app.commandLine.appendSwitch('disable-gpu');
// Hide security warnings in development (remove for production)
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
const isDev = !electron_1.app.isPackaged;
const DEV_BASE_URL = 'http://localhost:5174';
let loginWin = null;
let mainWin = null;
const stateFile = path.join(electron_1.app.getPath('userData'), 'session.json');
function loadSession() {
    try {
        if (!(0, fs_1.existsSync)(stateFile))
            return null;
        return JSON.parse((0, fs_1.readFileSync)(stateFile, 'utf8'));
    }
    catch {
        return null;
    }
}
function saveSession(s) {
    if (s)
        (0, fs_1.writeFileSync)(stateFile, JSON.stringify(s), 'utf8');
}
function getPreloadPath() {
    return path.join(__dirname, 'preload.js');
}
function getLoginURL() {
    if (isDev)
        return `${DEV_BASE_URL}/login`;
    return `file://${path.join(__dirname, '..', 'dist-renderer', 'login.html')}`;
}
function getMainAppURL() {
    if (isDev)
        return `${DEV_BASE_URL}?mode=host`;
    return `file://${path.join(__dirname, '..', 'dist-renderer', 'index.html')}?mode=host`;
}
function createLoginWindow() {
    if (loginWin)
        return loginWin.focus();
    loginWin = new electron_1.BrowserWindow({
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
    if (isDev)
        loginWin.webContents.openDevTools();
    loginWin.loadURL(getLoginURL()).catch(err => console.error('Login load error:', err));
    loginWin.on('closed', () => { loginWin = null; });
}
function createMainWindow() {
    if (mainWin) {
        mainWin.show();
        mainWin.focus();
        return;
    }
    mainWin = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        show: true,
        webPreferences: {
            preload: getPreloadPath(),
            contextIsolation: true,
            sandbox: false,
        },
    });
    if (isDev)
        mainWin.webContents.openDevTools();
    mainWin.webContents.on('did-fail-load', (_, errorCode, errorDesc) => {
        console.error(`Main window failed: ${errorDesc} (${errorCode})`);
    });
    mainWin.loadURL(getMainAppURL()).catch(err => console.error('Main window load error:', err));
    mainWin.on('closed', () => { mainWin = null; });
}
electron_1.ipcMain.handle('login:complete', async (_, payload) => {
    saveSession(payload);
    loginWin?.close();
    createMainWindow();
});
electron_1.ipcMain.handle('session:get', async () => loadSession());
electron_1.ipcMain.handle('host:info', () => ({ hostname: os.hostname(), platform: process.platform }));
// Placeholder handlers – replace with real logic when needed
electron_1.ipcMain.handle('lock:apply', async (_, msg) => console.log('lock:apply', msg));
electron_1.ipcMain.handle('lock:release', async () => console.log('lock:release'));
electron_1.ipcMain.handle('exam:open', async (_, payload) => console.log('exam:open', payload));
electron_1.ipcMain.handle('exam:close', async () => console.log('exam:close'));
electron_1.app.whenReady().then(() => {
    createLoginWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createLoginWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && !mainWin)
        electron_1.app.quit();
});
electron_1.app.on('will-quit', () => electron_1.globalShortcut.unregisterAll());
