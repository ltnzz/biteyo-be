import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.route.js';
import mapsRoutes from './routes/maps.route.js';
import feedRoutes from './routes/feed.route.js';
import profileRoutes from './routes/profile.route.js';
import notificationRoutes from './routes/notification.route.js';
import botRoutes from './routes/bot.route.js';
import { openApiDocument } from './docs/openapi.js';
import { scheduleDailyJob } from './utils/scheduler.js';
import { executeDailyUpload } from './controllers/bot.controller.js';
import {
    notFoundHandler,
    errorHandler,
} from './middlewares/error.middleware.js';

const app = express();

const allowedOrigins = new Set(
    [
        'https://biteyo-fe.vercel.app',
        'http://localhost:5173',
        process.env.CLIENT_URL,
        ...(process.env.CLIENT_URLS?.split(',') || []),
    ].filter(Boolean)
);

app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    next();
});

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.has(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    })
);

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.get('/', (req, res) => {
    res.send('API running');
});

app.get('/api/docs.json', (req, res) => {
    res.json(openApiDocument);
});
app.get('/api/docs/:asset', (req, res, next) => {
    const cdnBase = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5';
    const assetMap = {
        'swagger-ui.css': `${cdnBase}/swagger-ui.css`,
        'swagger-ui-bundle.js': `${cdnBase}/swagger-ui-bundle.js`,
        'swagger-ui-standalone-preset.js': `${cdnBase}/swagger-ui-standalone-preset.js`,
        'favicon-16x16.png': `${cdnBase}/favicon-16x16.png`,
        'favicon-32x32.png': `${cdnBase}/favicon-32x32.png`,
    };

    if (req.params.asset === 'swagger-ui-init.js') {
        return res.type('application/javascript').send(`
window.onload = () => {
    window.ui = SwaggerUIBundle({
        url: '/api/docs.json',
        dom_id: '#swagger-ui',
        presets: [
            SwaggerUIBundle.presets.apis,
            SwaggerUIStandalonePreset,
        ],
        layout: 'StandaloneLayout',
    });
};
`);
    }

    if (assetMap[req.params.asset]) {
        return res.redirect(302, assetMap[req.params.asset]);
    }

    return next();
});
app.get(['/api/docs', '/api/docs/'], (req, res) => {
    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Biteyo API Docs</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = () => {
            window.ui = SwaggerUIBundle({
                url: '/api/docs.json',
                dom_id: '#swagger-ui',
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset,
                ],
                layout: 'StandaloneLayout',
            });
        };
    </script>
</body>
</html>`);
});

app.use('/api/auth', authRoutes);
app.use('/api/maps', mapsRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/bot', botRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Jangan buka port saat dijalankan oleh test runner (supertest)
if (!process.env.JEST_WORKER_ID) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);

        if (process.env.START_INTERNAL_CRON === 'true') {
            // Schedule to run daily at 08:00 AM
            scheduleDailyJob('Daily Upload Bot', executeDailyUpload, 8, 0);
        }
    });
}

export default app;

// Nodemon reload trigger

