import express from 'express';
import {
    deleteNotification,
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
router.delete('/:id', deleteNotification);

export default router;
