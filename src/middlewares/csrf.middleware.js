import { isAllowedOrigin } from '../config/cors.js';

export const csrfProtection = (req, res, next) => {
    const method = req.method?.toUpperCase();

    // Safe methods: allow without Origin (browsers, curl, preflight)
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        return next();
    }

    const origin = req.headers.origin;
    const referer = req.headers.referer || req.headers.referrer;

    if (origin) {
        if (!isAllowedOrigin(origin)) {
            return res.status(403).json({ message: 'Forbidden: invalid origin' });
        }
        return next();
    }

    if (referer) {
        try {
            const refererOrigin = new URL(referer).origin;
            if (!isAllowedOrigin(refererOrigin)) {
                return res.status(403).json({ message: 'Forbidden: invalid origin' });
            }
        } catch {
            // malformed referer — ignore, treat as no origin
        }
        return next();
    }

    // Compatibility exception: mutating request without Origin/Referer (curl, mobile, Postman, server-to-server).
    // Allowed intentionally; document that browser-based CSRF is blocked above via Origin check.
    return next();
};
