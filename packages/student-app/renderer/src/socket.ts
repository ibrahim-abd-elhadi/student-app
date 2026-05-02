import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function initSocket(baseUrl: string) {
if (socket) return socket;

socket = io(baseUrl, {
transports: ["websocket"],
});

socket.on("connect", () => {
console.log("✅ Connected:", socket?.id);
});

socket.on("disconnect", () => {
console.log("❌ Disconnected");
});

return socket;
}

export function getSocket() {
return socket;
}
