import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';

const isDev = !app.isPackaged;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Tutor — لوحة التحكم',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist-renderer/index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

/** Print the report HTML to the system printer (or save as PDF). */
ipcMain.handle('report:print', async (_evt, html: string) => {
  const printWin = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return new Promise<void>((resolve, reject) => {
    printWin.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
      printWin.destroy();
      if (success) resolve();
      else reject(new Error(failureReason || 'print_failed'));
    });
  });
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
