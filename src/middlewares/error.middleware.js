import multer from 'multer';

import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export const notFoundHandler = (req, _res, next) => {
    next(new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404));
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
    let statusCode = err instanceof AppError ? err.statusCode : 500;
    let message =
        err instanceof AppError
            ? err.message
            : statusCode === 500
              ? 'Internal server error'
              : err.message;

    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            statusCode = 413;
            message = 'File too large (max 10 MB per file)';
        } else if (err.code === 'LIMIT_FILE_COUNT') {
            statusCode = 400;
            message = 'Too many files uploaded';
        } else {
            statusCode = 400;
            message = `Upload error: ${err.code}`;
        }
    } else if (
        typeof err.message === 'string' &&
        err.message.startsWith('Only images are allowed')
    ) {
        statusCode = 400;
        message = 'Only images are allowed';
    }

    if (statusCode >= 500) {
        logger.child(req.id).error(err.message, err);
    }

    return res.status(statusCode).json({
        message,
        ...(process.env.NODE_ENV !== 'production' && statusCode >= 500
            ? { error: err.message }
            : {}),
    });
};
