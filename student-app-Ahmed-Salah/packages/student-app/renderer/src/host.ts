/**
 * Host runtime: holds the WebSocket connection in the hidden main window and
 * forwards lock/exam events to the Electron main process via the preload bridge.
 *
 * This file is loaded in the login renderer when `?mode=host` is set.
 */
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export async function startHost() {
  const session = await window.studentApi.getSession();
  if (!session) return;

  socket = io(`${session.base_url}/ws`, {
    transports: ['websocket'],
    auth: { token: session.access_token },
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5_000,
  });

  socket.on('connect', () => {
    // eslint-disable-next-line no-console
    console.log('[host] connected');
  });
  socket.on('disconnect', (r) => {
    // eslint-disable-next-line no-console
    console.warn('[host] disconnected', r);
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

  // Expose the socket to the exam window via window-shared singleton.
  (window as any).__studentSocket = socket;
}

export function getSocket(): Socket | null {
  return socket;
}
