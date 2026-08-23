import express from 'express';
import { triggerDailyUpload } from '../controllers/bot.controller.js';

const router = express.Router();

// Vercel Cron sends GET requests; POST is kept for manual/external triggers
router.get('/daily-upload', triggerDailyUpload);
router.post('/daily-upload', triggerDailyUpload);

export default router;
