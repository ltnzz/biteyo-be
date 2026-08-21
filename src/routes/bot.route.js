import express from 'express';
import { triggerDailyUpload } from '../controllers/bot.controller.js';

const router = express.Router();

// Webhook endpoint to trigger the daily upload bot manually or via external cron services
router.post('/daily-upload', triggerDailyUpload);

export default router;
