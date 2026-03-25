import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { validateR2Config } from './utils/cloudflareR2.js';

const app = express();

validateR2Config();

const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'https://quizzems.com',
    'https://www.quizzems.com',
    'https://quizzems.vercel.app',
    'http://localhost:3000',
    'http://localhost:5174',
    'https://freebeer.nyc',
    'https://www.freebeer.nyc',
    'https://api.quizzems.com',
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);

        if (
            allowedOrigins.includes(origin) ||
            origin.endsWith('.vercel.app')
        ) {
            return callback(null, true);
        }

        console.warn('Blocked by CORS:', origin);
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

// Middleware for JSON parsing
app.use(express.json());

// API Routes
app.use('/', routes);

export default app;
