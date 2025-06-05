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

        socket.on('connect-request', async () => {
            const token = socket.handshake.auth.token;
            const anonId = socket.handshake.auth.anonId;

            let userId;

            if (token) {
                const { data: userData, error } = await supabase.auth.getUser(token);
                if (error || !userData?.user) return;
                userId = userData.user.id;
            } else if (anonId) {
                userId = anonId;
            } else {
                return;
            }

            for (const code in rooms) {
                const room = rooms[code];
                const existingSocketId = room.userSockets?.[userId];

                if (existingSocketId && existingSocketId !== socket.id) {
                    const existingSocket = io.sockets.sockets.get(existingSocketId);
                    if (existingSocket) {
                        existingSocket.disconnect(true);
                        console.log(`Disconnected duplicate socket for user ${userId}`);
                    }

                    room.userSockets[userId] = socket.id;
                }
            }
        });

        socket.on('create-room', async ({ collectionId }) => {
            const token = socket.handshake.auth.token;

            if (!token) {
                socket.emit('error', 'Authentication required to create room');
                return;
            }

            const { data: user, error } = await supabase.auth.getUser(token);

            if (error || !user || !user.user) {
                console.error('Error fetching user:', error);
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

        socket.on('score-point', ({ code, playerId, cardIndex }) => {
            console.log(`Scoring point for player ${playerId} in room: ${code}`);
            // if playerId is undefined, use socket.id
            if (!playerId) {
                playerId = Object.keys(rooms[code].userSockets || {}).find(id => rooms[code].userSockets[id] === socket.id);
            }
            if (!rooms[code]) {
                socket.emit('error', 'Room not found');
                return;
            }

            rooms[code].scores ??= {};
            rooms[code].scores[playerId] = (rooms[code].scores[playerId] || 0) + 1;

            console.log(`Updated scores for room ${code}:`, rooms[code].scores);

            io.to(code).emit('score-updated', { scores: rooms[code].scores, cardIndex });
        });


        socket.on('give-up', ({ code, playerId }) => {
            if (!rooms[code]) {
                socket.emit('error', 'Room not found');
                return;
            }

            if (!rooms[code].finishedPlayers) {
                rooms[code].finishedPlayers = [];
            }

            if (!rooms[code].finishedPlayers.includes(playerId)) {
                rooms[code].finishedPlayers.push(playerId);
            }

            console.log(`Player ${playerId} has given up in room: ${code}`);
            io.to(code).emit('player-gave-up', { playerId, finishedPlayers: rooms[code].finishedPlayers });



            // if all players have given up, end the game

            if (rooms[code].finishedPlayers.length === rooms[code].players.length) {
                rooms[code].isFinished = true;
                io.to(code).emit('game-finished', { finishedPlayers: rooms[code].finishedPlayers });
                console.log(`Game finished in room: ${code}`);
            }
        });

        socket.on('disconnect', () => {

            for (const code in rooms) {
                const room = rooms[code];

                if (!room.userSockets) continue;

                const disconnectedUserIds = Object.entries(room.userSockets)
                    .filter(([_, sockId]) => sockId === socket.id)
                    .map(([userId]) => userId);

                if (disconnectedUserIds.length === 0) continue;

                let changed = false;

                disconnectedUserIds.forEach(userId => {
                    // Remove from userSockets
                    delete room.userSockets[userId];

                    // Remove from players
                    const index = room.players.indexOf(userId);
                    if (index !== -1) {
                        room.players.splice(index, 1);
                        changed = true;
                    }

                    // If the disconnected user is host, assign a new host
                    if (room.hostId === userId) {
                        room.hostId = room.players[0] || null;
                        changed = true;
                    }
                });

                if (changed) {
                    io.to(code).emit('room-update', room);
                }

                // Optional cleanup: delete room if empty
                if (room.players.length === 0) {
                    delete rooms[code];
                    console.log(`Room ${code} deleted due to no players remaining.`);
                }
            }
        });

    });
}
