// socket.js
import { rooms } from './models/rooms.js';
import { supabase } from './config/supabaseClient.js';

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function setupSocketIO(io) {
    io.on('connection', (socket) => {

        socket.on('create-room', async () => {
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
            rooms[code] = { hostId, roomCode: code, players, createdAt: Date.now() };

            // Create a mapping of userId to socketId
            if (!rooms[code].userSockets) {
                rooms[code].userSockets = {};
            }
            rooms[code].userSockets[hostId] = socket.id;
            rooms[code].isStarted = false;
            rooms[code].isFinished = false;
            rooms[code].scores = {};
            rooms[code].cards = {};
            rooms[code].finishedPlayers = [];
            rooms[code].players = rooms[code].players || [];
            socket.join(code);

            // Emit room-created to confirm room creation
            socket.emit('room-created', { code, room: rooms[code] });
            // Also emit room-update to all in the room
            io.to(code).emit('room-update', rooms[code]);
        });

        socket.on('join-room', async ({ code }) => {
            if (!rooms[code]) {
                socket.emit('error', 'Room not found');
                return;
            }

            let playerId;
            const token = socket.handshake.auth.token;
            const anonId = socket.handshake.auth.anonId;

            if (token) {
                const { data: user, error } = await supabase.auth.getUser(token);
                if (!error && user && user.user) {
                    playerId = user.user.id;
                }
            }

            if (!playerId) {
                // Generate a random UUID for unauthenticated user
                playerId = anonId;
            }

            socket.join(code);

            if (!rooms[code].players.includes(playerId)) {
                rooms[code].players.push(playerId);
            }

            if (!rooms[code].userSockets) {
                rooms[code].userSockets = {};
            }
            rooms[code].userSockets[playerId] = socket.id;

            io.to(code).emit('room-update', rooms[code]);
            socket.emit('joined-room', { code, room: rooms[code] });
        });

        // on start game event, set isStarted to true
        socket.on('start-game', (code) => {
            if (!rooms[code]) {
                socket.emit('error', 'Room not found');
                return;
            }

            rooms[code].isStarted = true;
            rooms[code].shuffleSeed = Math.random(); // Add shuffle seed for consistent card order
            io.to(code).emit('game-started', { room: rooms[code], shuffleSeed: rooms[code].shuffleSeed });
        });

        socket.on('get-game-state', ({ code }) => {
            if (!rooms[code]) {
                socket.emit('error', 'Room not found');
                return;
            }

            // Send current game state to the requesting socket
            socket.emit('game-state-response', {
                room: rooms[code],
                scores: rooms[code].scores || {},
                cards: rooms[code].cards || {},
                finishedPlayers: rooms[code].finishedPlayers || [],
                shuffleSeed: rooms[code].shuffleSeed
            });
        });

        socket.on('score-point', ({ code, playerId, cardIndex }) => {
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
            // add to rooms[code].cards[cardIndex], and set the value to playerId
            if (!rooms[code].cards) {
                rooms[code].cards = {};
            }
            rooms[code].cards[cardIndex] = playerId;

            io.to(code).emit('score-updated', { scores: rooms[code].scores, cardIndex, playerId, cards: rooms[code].cards });
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

            io.to(code).emit('player-gave-up', { playerId, finishedPlayers: rooms[code].finishedPlayers });



            // if all players have given up, end the game

            if (rooms[code].finishedPlayers.length === rooms[code].players.length) {
                rooms[code].isFinished = true;
                io.to(code).emit('game-finished', { finishedPlayers: rooms[code].finishedPlayers });
            }
        });

        socket.on('set-collection', ({ code, collectionId }) => {
            if (!rooms[code]) {
                socket.emit('error', 'Room not found');
                return;
            }

            rooms[code].collectionId = collectionId;
            io.to(code).emit('collection-changed', rooms[code]);
        });

        socket.on('close-room', ({ code }) => {
            if (!rooms[code]) {
                socket.emit('error', 'Room not found');
                return;
            }

            delete rooms[code];
            io.to(code).emit('room-closed', { code });
        });

        socket.on('reset-room', ({ code }) => {
            if (!rooms[code]) {
                socket.emit('error', 'Room not found');
                return;
            }

            const room = rooms[code];
            room.isStarted = false;
            room.isFinished = false;
            room.scores = {};
            room.cards = {};
            room.finishedPlayers = [];
            room.shuffleSeed = null;
            room.players = [room.hostId]; // Reset players to just the host
            room.userSockets = { [room.hostId]: room.userSockets[room.hostId] }; // Keep host socket

            io.to(code).emit('room-reset', room);
            io.to(code).emit('room-update', room);
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
                }
            }
        });

    });
}
