import { io, Socket } from 'socket.io-client';
import { refreshToken, decodeJwt } from './api';

let socket: Socket | null = null;
let readyHeartbeat: number | null = null;

export async function startHost() {
  if (socket?.connected) {
    socket.emit('student:ready');
    return;
  }

  const studentApi = (window as any).studentApi;
  let session = await studentApi.getSession();
  if (!session) {
    console.error('[host] No session found');
    return;
  }

  // Try refreshing token if nearly expired
  const payload = decodeJwt(session.access_token);
  const now = Math.floor(Date.now() / 1000);
  if (payload?.exp && payload.exp < now + 30) {
    console.log('[host] Refreshing token...');
    try {
      const newData = await refreshToken(session.base_url, session.refresh_token);
      const updatedSession = {
        base_url: session.base_url,
        access_token: newData.access_token,
        refresh_token: newData.refresh_token,
        user: newData.user,
      };
      await studentApi.loginComplete(updatedSession);
      session = updatedSession;
      console.log('[host] Token refreshed');
    } catch (err) {
      console.warn('[host] Token refresh failed – trying with existing token');
    }
  }

  const token = session.access_token;
  console.log('[host] Connecting to WebSocket...');

  // Fix: Use same path pattern as tutor app - no /ws in URL, use path option
  socket = io(session.base_url, {
    path: '/ws',
    transports: ['websocket'],
    auth: { token },
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5_000,
  });

  socket.on('connect', async () => {
    console.log('[host] ✅ Socket connected');
    if (studentApi?.hostReady) await studentApi.hostReady();
    socket?.emit('student:ready');
    if (readyHeartbeat) window.clearInterval(readyHeartbeat);
    readyHeartbeat = window.setInterval(() => {
      socket?.emit('student:ready');
    }, 15_000);
  });

  socket.on('connect_error', (err: Error) => {
    console.error('[host] ❌ Socket error:', err.message);
  });

  socket.on('disconnect', (reason: string) => {
    console.warn('[host] Disconnected:', reason);
    if (readyHeartbeat) {
      window.clearInterval(readyHeartbeat);
      readyHeartbeat = null;
    }
  });

  socket.on('lock:apply', async (p: { message?: string }) => {
    await studentApi.applyLock(p?.message ?? '');
  });
  socket.on('lock:release', async () => {
    await studentApi.releaseLock();
  });
  socket.on('exam:assigned', async (payload: any) => {
    await studentApi.openExam(payload);
  });
  socket.on('exam:closed', async () => {
    await studentApi.closeExam();
  });
  socket.on('exam:cancelled', async () => {
    await studentApi.closeExam();
  });

  (window as any).__studentSocket = socket;
}

export function getSocket(): Socket | null {
  return socket;
}
