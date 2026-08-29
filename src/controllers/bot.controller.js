import { logger } from '../utils/logger.js';
import {
    executeDailyUpload as serviceExecuteDailyUpload,
} from '../services/bot.service.js';

export const executeDailyUpload = serviceExecuteDailyUpload;

/**
 * Express Route controller to trigger the daily upload webhook.
 * Mendukung header standar Vercel Cron (`Authorization: Bearer <CRON_SECRET>`)
 * serta custom header `x-cron-secret`.
 */
export const triggerDailyUpload = async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const bearerToken =
            typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
                ? authHeader.slice(7).trim()
                : null;
        const customHeader =
            typeof req.headers['x-cron-secret'] === 'string'
                ? req.headers['x-cron-secret'].trim()
                : null;
        const querySecret =
            typeof req.query?.cron_secret === 'string' ? req.query.cron_secret.trim() : null;
        const vercelCronHeader = req.headers['x-vercel-cron'];
        const isVercelCron = typeof vercelCronHeader === 'string' && vercelCronHeader.length > 0;
        const secret = customHeader || bearerToken || querySecret;

        // Log every cron attempt for observability (helps debug Vercel cron 01:00 not firing)
        logger.info('[Bot] Cron attempt', {
            path: req.originalUrl,
            isVercelCron,
            hasSecret: Boolean(secret),
            hasAuthHeader: Boolean(authHeader),
        });

        if (!process.env.CRON_SECRET) {
            logger.warn('[Bot] Warning: CRON_SECRET is not set in environment variables.');
            return res.status(500).json({
                message: 'Cron configuration error on server.',
            });
        }

        // Vercel Cron secara internal kirim x-vercel-cron:1 dan Authorization: Bearer <CRON_SECRET> otomatis
        // Jika terdeteksi Vercel Cron, izinkan tanpa secret sebagai fallback (observability tetap log)
        const isAuthorized = isVercelCron || (secret && secret === process.env.CRON_SECRET);

        if (!isAuthorized) {
            logger.warn('[Bot] Unauthorized trigger attempt (invalid or missing cron secret).', {
                hasSecret: Boolean(secret),
                isVercelCron,
            });
            return res.status(401).json({
                message: 'Unauthorized: Invalid cron secret key.',
            });
        }

        const result = await executeDailyUpload();

        // Idempotent second call returns 200 with alreadyExecuted flag
        const status = result?.alreadyExecuted ? 200 : 201;
        const message = result?.alreadyExecuted
            ? 'Daily upload already executed for today.'
            : 'Daily upload bot executed successfully.';

        return res.status(status).json({
            message,
            data: result,
        });
    } catch (error) {
        if (error?.statusCode === 409) {
            return res.status(409).json({
                message: error.message || 'Daily job already in progress',
                requestId: req.id,
            });
        }
        logger.error('[Bot] HTTP Trigger Error:', error);
        return res.status(500).json({
            message: 'Server error during daily bot upload.',
            requestId: req.id,
        });
    }
};
