import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('tutorApi', {
  printReport: (html: string) => ipcRenderer.invoke('report:print', html),
});

declare global {
  interface Window {
    tutorApi: {
      printReport: (html: string) => Promise<void>;
    };
  }
}
