// socket.js
import { rooms } from './models/rooms.js';
import { supabase } from './config/supabaseClient.js';
import crypto from 'crypto';

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function setupSocketIO(io) {
    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id}`);

        socket.on('create-room', async ({ collectionId }) => {
            const token = socket.handshake.auth.token;

            if (!token) {
                socket.emit('error', 'Authentication required to create room');
                return;
            }

            const { data: user, error } = await supabase.auth.getUser(token);

            if (error || !user || !user.user) {
                socket.emit('error', 'Invalid or expired token');
                return;
            }

            let code;
            do {
                code = generateRoomCode();
            } while (rooms[code]);

            const hostId = user.user.id;
            const players = [hostId];
            rooms[code] = { hostId, roomCode: code, players, collectionId, createdAt: Date.now() };

            // Create a mapping of userId to socketId
            if (!rooms[code].userSockets) {
                rooms[code].userSockets = {};
            }
            rooms[code].userSockets[hostId] = socket.id;

            socket.join(code);

            socket.emit('room-created', { code, room: rooms[code] });
            io.to(code).emit('room-update', rooms[code]);
        });

        // Inside your setupSocketIO(io) function:
        socket.on('join-room', async ({ code }) => {
            if (!rooms[code]) {
                socket.emit('error', 'Room not found');
                return;
            }

            let playerId;
            const token = socket.handshake.auth.token;

            if (token) {
                const { data: user, error } = await supabase.auth.getUser(token);
                if (!error && user && user.user) {
                    playerId = user.user.id;
                }
            }

            if (!playerId) {
                // Generate a random UUID for unauthenticated user
                playerId = crypto.randomUUID();
            }

            socket.join(code);

            if (!rooms[code].players.includes(playerId)) {
                rooms[code].players.push(playerId);
            }

            if (!rooms[code].userSockets) {
                rooms[code].userSockets = {};
            }
            rooms[code].userSockets[playerId] = socket.id;

            console.log(`Player ${playerId} joined room: ${code}`);
            io.to(code).emit('room-update', rooms[code]);
            socket.emit('joined-room', { code, room: rooms[code] });
        });

        // on start game event, set isStarted to true
        socket.on('start-game', (code) => {
            console.log(`Start game requested for room: ${code}`);
            console.log(rooms[code]);
            if (!rooms[code]) {
                socket.emit('error', 'Room not found');
                return;
            }

            rooms[code].isStarted = true;
            io.to(code).emit('game-started', rooms[code]);
        });

        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
            for (const code in rooms) {
                const room = rooms[code];
                if (room.userSockets) {
                    // Find all userIds with this socket.id
                    const userIdsToRemove = Object.entries(room.userSockets)
                        .filter(([userId, sockId]) => sockId === socket.id)
                        .map(([userId]) => userId);

                    // Remove users from players and userSockets
                    userIdsToRemove.forEach(userId => {
                        room.players = room.players.filter(pid => pid !== userId);
                        delete room.userSockets[userId];
                    });

                    if (userIdsToRemove.length > 0) {
                        io.to(code).emit('room-update', room);
                    }
                }
            }
        });
    });
}
