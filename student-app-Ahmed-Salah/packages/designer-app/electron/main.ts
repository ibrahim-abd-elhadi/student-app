import { app, BrowserWindow } from 'electron';
import * as path from 'path';

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    title: 'Exam Designer — مصمم الاختبارات',
    webPreferences: {
      contextIsolation: true,
    },
  });
  if (isDev) {
    win.loadURL('http://localhost:5175');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist-renderer/index.html'));
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
