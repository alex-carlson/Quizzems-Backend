// server.js
import http from 'http';
import { Server as SocketIO } from 'socket.io';
import app from './app.js';
import { setupSocketIO } from './socket.js'; // ✅ Import your socket logic

const PORT = process.env.PORT || 3000;
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'https://quizzems.com',
  'https://www.quizzems.com',
  'http://localhost:3000',
  'http://localhost:5174'
];

const server = http.createServer(app);

const io = new SocketIO(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

setupSocketIO(io); // ✅ Initialize socket handlers

server.listen(PORT, () => {
  console.log(`Server is running with Socket.IO on port ${PORT}`);
});

export default server;
