import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import http from 'http';
import { initSocket } from './config/socket.js';
import authRoutes from './routes/auth.route.js';
import mapsRoutes from './routes/maps.route.js';
import feedRoutes from './routes/feed.route.js';
import profileRoutes from './routes/profile.route.js';

const app = express();
const server = http.createServer(app);

app.use(
    cors({
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    })
);

initSocket(server);

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.send('API running');
});

app.use('/api/auth', authRoutes);
app.use('/api/maps', mapsRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/profile', profileRoutes);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
