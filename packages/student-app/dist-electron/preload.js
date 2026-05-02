"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
console.log("✅ PRELOAD LOADED");
// 🔥 expose مرة واحدة فقط
electron_1.contextBridge.exposeInMainWorld('studentApi', {
    /* ================= LOGIN ================= */
    loginComplete: (payload) => electron_1.ipcRenderer.invoke('login:complete', payload),
    /* ================= GENERAL ================= */
    hostInfo: () => electron_1.ipcRenderer.invoke('host:info'),
    getSession: () => electron_1.ipcRenderer.invoke('session:get'),
    /* ================= DASHBOARD ================= */
    dashboardReady: () => electron_1.ipcRenderer.invoke('dashboard:ready'),
    /* ================= LOCK ================= */
    applyLock: (msg) => electron_1.ipcRenderer.invoke('lock:apply', msg),
    releaseLock: () => electron_1.ipcRenderer.invoke('lock:release'),
    /* ================= EXAM ================= */
    openExam: (payload) => electron_1.ipcRenderer.invoke('exam:open', payload),
    closeExam: () => electron_1.ipcRenderer.invoke('exam:close'),
    /* ================= EVENTS ================= */
    onExamStart: (cb) => {
        const handler = (_, p) => cb(p);
        electron_1.ipcRenderer.on('exam:start', handler);
        return () => electron_1.ipcRenderer.removeListener('exam:start', handler);
    },
    onExamReload: (cb) => {
        const handler = (_, p) => cb(p);
        electron_1.ipcRenderer.on('exam:reload', handler);
        return () => electron_1.ipcRenderer.removeListener('exam:reload', handler);
    },
});
