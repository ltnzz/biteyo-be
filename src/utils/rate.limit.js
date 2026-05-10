import rateLimit from 'express-rate-limit';

export const locationLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: {
        message: 'Too many requests',
    },
});
