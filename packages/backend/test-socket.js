const { io } = require('socket.io-client');

const socket = io('http://127.0.0.1:8080', {
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
});

socket.on('connect', () => {
  console.log('✅ Connected to server, socket ID:', socket.id);
  socket.disconnect();
  process.exit(0);
});

socket.on('connect_error', (error) => {
  console.log('❌ Connection error:', error.message);
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

setTimeout(() => {
  console.log('❌ Connection timeout');
  process.exit(1);
}, 5000);
