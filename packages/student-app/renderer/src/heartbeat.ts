import { getSocket } from "./socket";

export function startHeartbeat() {
setInterval(() => {
const socket = getSocket();
if (socket && socket.connected) {
socket.emit("student:heartbeat", {
time: Date.now(),
});
}
}, 5000); // every 5 seconds
}