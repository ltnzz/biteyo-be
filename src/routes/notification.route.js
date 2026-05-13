import express from 'express';
import {
    getNotifications,
    markNotificationAsRead,
    registerFcmToken,
    unregisterFcmToken,
} from '../controllers/notification.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getNotifications);
router.post('/fcm-token', registerFcmToken);
router.delete('/fcm-token', unregisterFcmToken);
router.patch('/:id/read', markNotificationAsRead);

export default router;
