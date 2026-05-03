import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export async function initSocket(): Promise<Socket> {
  // Get session from Electron context
  const session = await window.studentApi.getSession();
  if (!session) throw new Error("No active session");

  // Disconnect existing socket if any
  if (socket?.connected) {
    socket.disconnect();
  }

  // Connect directly to Socket.io server
  socket = io(session.base_url, {
    transports: ["websocket"],
    auth: { token: session.access_token },
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5_000,
  });

  socket.on("connect", () => {
    console.log("[student] socket connected:", socket?.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("[student] socket disconnected:", reason);
  });

  socket.on("connect_error", (err) => {
    console.error("[student] socket connect_error:", err);
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}
