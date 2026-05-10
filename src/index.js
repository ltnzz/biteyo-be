import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import authRoutes from './routes/auth.route.js';
import mapsRoutes from './routes/maps.route.js';
import feedRoutes from './routes/feed.route.js';

const app = express();

app.use(
    cors({
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        origin: process.env.CLIENT_URL,
        credentials: true,
    })
);

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.send('API running');
});

app.use('/api/auth', authRoutes);
app.use('/api/maps', mapsRoutes);
app.use('/api/feed', feedRoutes);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
