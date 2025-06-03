// server.js
import http from 'http';
import { Server as SocketIO } from 'socket.io';
import cors from 'cors';
import app from './app.js';
import { setupSocketIO } from './socket.js'; // ✅ Import your socket logic

const PORT = process.env.PORT || 3000;
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
  })
);

const server = http.createServer(app);

const io = new SocketIO(server, {
  cors: {
    origin: allowedOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

setupSocketIO(io); // ✅ Initialize socket handlers

server.listen(PORT, () => {
  console.log(`Server is running with Socket.IO on port ${PORT}`);
});
