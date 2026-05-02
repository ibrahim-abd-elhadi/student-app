import { contextBridge, ipcRenderer } from 'electron';

console.log("✅ PRELOAD LOADED");

// 🔥 expose مرة واحدة فقط
contextBridge.exposeInMainWorld('studentApi', {
  /* ================= LOGIN ================= */
  loginComplete: (payload: any) => ipcRenderer.invoke('login:complete', payload),

  /* ================= GENERAL ================= */
  hostInfo: () => ipcRenderer.invoke('host:info'),
  deviceInfo: () => ipcRenderer.invoke('device:info'),
  getSession: () => ipcRenderer.invoke('session:get'),

  /* ================= DASHBOARD ================= */
  dashboardReady: () => ipcRenderer.invoke('dashboard:ready'),

  /* ================= LOCK ================= */
  applyLock: (msg: string) => ipcRenderer.invoke('lock:apply', msg),
  releaseLock: () => ipcRenderer.invoke('lock:release'),

  /* ================= EXAM ================= */
  openExam: (payload: any) => ipcRenderer.invoke('exam:open', payload),
  closeExam: () => ipcRenderer.invoke('exam:close'),

  /* ================= ACTIVITY TRACKING ================= */
  reportActivity: (type: string, data?: any) => ipcRenderer.invoke('activity:report', { type, data }),

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

  onStudentDetected: (cb: (p: any) => void) => {
    const handler = (_: any, p: any) => cb(p);
    ipcRenderer.on('student:detected', handler);
    return () => ipcRenderer.removeListener('student:detected', handler);
  },

  onStudentActivity: (cb: (p: any) => void) => {
    const handler = (_: any, p: any) => cb(p);
    ipcRenderer.on('student:activity', handler);
    return () => ipcRenderer.removeListener('student:activity', handler);
  },
});

/* ================= TYPES ================= */
declare global {
  interface Window {
    studentApi: {
      loginComplete: (p: any) => Promise<void>;
      hostInfo: () => Promise<{ hostname: string; platform: string }>;
      deviceInfo: () => Promise<any>;
      getSession: () => Promise<any>;
      dashboardReady: () => Promise<void>;
      applyLock: (msg: string) => Promise<void>;
      releaseLock: () => Promise<void>;
      openExam: (p: any) => Promise<void>;
      closeExam: () => Promise<void>;
      reportActivity: (type: string, data?: any) => Promise<void>;
      onExamStart: (cb: (p: any) => void) => () => void;
      onExamReload: (cb: (p: any) => void) => () => void;
      onStudentDetected: (cb: (p: any) => void) => () => void;
      onStudentActivity: (cb: (p: any) => void) => () => void;
    };
  }
}