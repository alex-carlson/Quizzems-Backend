
import { v4 as uuidv4 } from 'uuid';
import { rooms } from '../models/rooms.js';

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function createParty(req, res) {
    const { collectionId, userId } = req.body;
    let code;
    do {
        code = generateRoomCode();
    } while (rooms[code]); // Ensure the code is unique

    rooms[code] = {
        userId,
        collectionId,
        players: [userId]
    };

    res.json(rooms[code]);
}

export function joinParty(req, res) {
    const { code, userId } = req.body;

    if (!rooms[code]) {
        return res.status(404).json({ message: "Party not found" });
    }

    if (rooms[code].players.includes(userId)) {
        return res.status(400).json({ message: "Player already joined the party" });
    }

    rooms[code].players.push(userId);

    // Notify all clients in the party about the update
    if (req.app && req.app.get('io')) {
        const io = req.app.get('io');
        io.to(code).emit('partyUpdated', {
            code,
            players: rooms[code].players
        });
    }

    res.json({
        code,
        playerId,
        message: "Joined party successfully"
    });
}