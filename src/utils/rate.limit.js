import rateLimit from 'express-rate-limit';

export const locationLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: {
        message: 'Too many requests',
    },
});

export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: 'Too many auth attempts. Please try again later.',
    },
});

export const commentLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: 'Terlalu banyak komentar. Coba lagi nanti.',
    },
});
