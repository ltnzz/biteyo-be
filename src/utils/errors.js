export class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.isOperational = true;
    }
}

export const badRequest = (message) => new AppError(message, 400);
export const unauthorized = (message = 'Unauthorized') =>
    new AppError(message, 401);
export const forbidden = (message = 'Forbidden') => new AppError(message, 403);
export const notFound = (message = 'Not found') => new AppError(message, 404);
