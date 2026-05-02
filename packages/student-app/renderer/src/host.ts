/**
 * Host runtime: holds the WebSocket connection in the hidden main window and
 * forwards lock/exam events to the Electron main process via the preload bridge.
 *
 * This file is loaded in the login renderer when `?mode=host` is set.
 */
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let activityReportInterval: NodeJS.Timeout | null = null;

export async function startHost() {
  const session = await window.studentApi.getSession();
  if (!session) return;

  // 🔹 Get device info for auto-detection
  const deviceInfo = await window.studentApi.deviceInfo();

  socket = io(`${session.base_url}/ws`, {
    transports: ['websocket'],
    auth: { token: session.access_token },
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5_000,
    extraHeaders: {
      'x-device-hostname': deviceInfo.hostname,
      'x-device-platform': deviceInfo.platform,
    },
  });

  socket.on('connect', () => {
    // eslint-disable-next-line no-console
    console.log('[host] connected with device:', deviceInfo.hostname);
    
    // Start activity reporting
    startActivityTracking();
  });

  socket.on('disconnect', (r) => {
    // eslint-disable-next-line no-console
    console.warn('[host] disconnected', r);
    stopActivityTracking();
  });

  socket.on('lock:apply', async (p: { message?: string }) => {
    await window.studentApi.applyLock(p?.message ?? '');
  });

  socket.on('lock:release', async () => {
    await window.studentApi.releaseLock();
  });

  socket.on('exam:assigned', async (p: any) => {
    await window.studentApi.openExam(p);
  });

  socket.on('exam:closed', async (p: any) => {
    // eslint-disable-next-line no-console
    console.log('[host] exam closed', p);
    await window.studentApi.closeExam();
  });

  socket.on('exam:cancelled', async () => {
    await window.studentApi.closeExam();
  });

  socket.on('student:detected', (data: any) => {
    // eslint-disable-next-line no-console
    console.log('[host] Student detected event:', data);
  });

  // Expose the socket to the exam window via window-shared singleton.
  (window as any).__studentSocket = socket;
}

function startActivityTracking() {
  // Report activity every 30 seconds
  activityReportInterval = setInterval(async () => {
    if (socket?.connected) {
      try {
        socket.emit('student:activity', { type: 'active' });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[host] Failed to report activity:', err);
      }
    }
  }, 30_000);
}

function stopActivityTracking() {
  if (activityReportInterval) {
    clearInterval(activityReportInterval);
    activityReportInterval = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}

export async function reportActivity(type: string, data?: Record<string, any>) {
  if (socket?.connected) {
    socket.emit('student:activity', { type, data });
  } else {
    // Report via Electron IPC as fallback
    await window.studentApi.reportActivity(type, data);
  }
}
