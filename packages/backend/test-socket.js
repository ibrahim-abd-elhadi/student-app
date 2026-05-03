const { io } = require('socket.io-client');

const socket = io('http://127.0.0.1:8080', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
  debug: true,
});

socket.on('connect', () => {
  console.log('✅ Connected to server, socket ID:', socket.id);
  socket.disconnect();
  process.exit(0);
});

socket.on('connect_error', (error) => {
  console.log('❌ Connection error:', error);
  console.log('Error message:', error.message);
});

socket.on('error', (error) => {
  console.log('❌ Error event:', error);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  if (reason === 'io server disconnect') {
    console.log('Server disconnected client');
  }
});

socket.io.engine.on('open', () => {
  console.log('✅ Transport connected');
});

socket.io.engine.on('error', (error) => {
  console.log('❌ Engine error:', error);
});

setTimeout(() => {
  console.log('❌ Connection timeout after 8 seconds');
  console.log('Socket connected?', socket.connected);
  console.log('Socket id:', socket.id);
  process.exit(1);
}, 8000);
