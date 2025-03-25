import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';

const app = express();

// Enable CORS for all origins
app.use(cors());

// Middleware for JSON parsing
app.use(express.json());

// API Routes
app.use('/', routes);

export default app;
