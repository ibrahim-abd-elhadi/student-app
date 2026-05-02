import { io, Socket } from "socket.io-client";

let socket: Socket;

export function initSocket() {
socket = io("http://localhost:3000/", {
transports: ["websocket"],
});

socket.on("connect", () => {
console.log("Connected to server:", socket.id);

// 🔹 Send device info
socket.emit("student:join", {
  deviceName: navigator.userAgent,
  status: "online",
});


});

socket.on("disconnect", () => {
console.log("Disconnected from server");
});

return socket;
}

export function getSocket() {
return socket;
}
