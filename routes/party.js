import { Router } from 'express';
import { createParty, joinParty } from '../controllers/partyController.js';
import { rooms } from '../models/rooms.js';

const router = Router();

function generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

router.post('/host', createParty);
router.post('/join', joinParty);
router.get('/:code/players', (req, res) => {
    console.log('Fetching players for room code:', req.params.code);
    const code = req.params.code;
    const room = rooms[code];
    if (!room) {
        return res.status(404).json({ message: 'Room not found' });
    }
    res.json(room.players);
});
router.get('/:code', (req, res) => {
    const code = req.params.code;
    if (!rooms[code]) {
        return res.status(404).json({ message: 'Party not found' });
    }
    res.json(rooms[code]);
});


router.get('/', (req, res) => {
    res.send('Hello from party route');
});

export default router;
