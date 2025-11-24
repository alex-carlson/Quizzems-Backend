import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';

const app = express();

// Get allowed origins from environment
const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'https://quizzems.com',
    'https://www.quizzems.com',
    'http://localhost:3000',
    'http://localhost:5174'
];

// Enhanced CORS configuration for AWS deployment
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn('Blocked by CORS:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
    maxAge: 86400 // 24 hours
}));

// Middleware for JSON parsing
app.use(express.json());

// API Routes
app.use('/', routes);

export default app;
