import { contextBridge, ipcRenderer } from 'electron';

console.log("✅ PRELOAD LOADED");

// 🔥 expose مرة واحدة فقط
contextBridge.exposeInMainWorld('studentApi', {
  /* ================= LOGIN ================= */
  loginComplete: (payload: any) => ipcRenderer.invoke('login:complete', payload),

  /* ================= GENERAL ================= */
  hostInfo: () => ipcRenderer.invoke('host:info'),
  getSession: () => ipcRenderer.invoke('session:get'),

  /* ================= DASHBOARD ================= */
  dashboardReady: () => ipcRenderer.invoke('dashboard:ready'),

  /* ================= LOCK ================= */
  applyLock: (msg: string) => ipcRenderer.invoke('lock:apply', msg),
  releaseLock: () => ipcRenderer.invoke('lock:release'),

  /* ================= EXAM ================= */
  openExam: (payload: any) => ipcRenderer.invoke('exam:open', payload),
  closeExam: () => ipcRenderer.invoke('exam:close'),
  hostReady: () => ipcRenderer.invoke('host:ready'),

  /* ================= EVENTS ================= */
  onExamStart: (cb: (p: any) => void) => {
    const handler = (_: any, p: any) => cb(p);
    ipcRenderer.on('exam:start', handler);
    return () => ipcRenderer.removeListener('exam:start', handler);
  },

  onExamReload: (cb: (p: any) => void) => {
    const handler = (_: any, p: any) => cb(p);
    ipcRenderer.on('exam:reload', handler);
    return () => ipcRenderer.removeListener('exam:reload', handler);
  },
});

/* ================= TYPES ================= */
declare global {
  interface Window {
    studentApi: {
      loginComplete: (p: any) => Promise<void>;
      hostInfo: () => Promise<{ hostname: string; platform: string }>;
      getSession: () => Promise<any>;
      dashboardReady: () => Promise<void>;
      applyLock: (msg: string) => Promise<void>;
      releaseLock: () => Promise<void>;
      openExam: (p: any) => Promise<void>;
      closeExam: () => Promise<void>;
      hostReady: () => Promise<void>;
      onExamStart: (cb: (p: any) => void) => () => void;
      onExamReload: (cb: (p: any) => void) => () => void;
    };
  }
}