import { logger } from '../utils/logger.js';

export const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body || {});

    if (!result.success) {
        logger.warn('Request validation failed', {
            path: req.originalUrl,
            issues: result.error.issues.map(
                ({ path, message }) => `${path.join('.')}: ${message}`,
            ),
        });

        return res.status(400).json({
            message: 'Validation failed',
            errors: result.error.issues,
        });
    }

    req.body = result.data;

    next();
};
