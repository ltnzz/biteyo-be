import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { fcmTokens, notifications, users } from '../db/schema.js';

export const registerFcmToken = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token || typeof token !== 'string') {
            return res.status(400).json({ message: 'FCM token is required' });
        }

        const [savedToken] = await db
            .insert(fcmTokens)
            .values({
                userId: req.user.id,
                token,
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: fcmTokens.token,
                set: {
                    userId: req.user.id,
                    updatedAt: new Date(),
                },
            })
            .returning();

        return res.status(200).json({
            message: 'FCM token registered',
            token: savedToken,
        });
    } catch (error) {
        console.error('Register FCM token error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const unregisterFcmToken = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token || typeof token !== 'string') {
            return res.status(400).json({ message: 'FCM token is required' });
        }

        await db
            .delete(fcmTokens)
            .where(
                and(
                    eq(fcmTokens.userId, req.user.id),
                    eq(fcmTokens.token, token)
                )
            );

        return res.status(200).json({ message: 'FCM token removed' });
    } catch (error) {
        console.error('Unregister FCM token error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const getNotifications = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = (page - 1) * limit;

        const data = await db
            .select({
                id: notifications.id,
                type: notifications.type,
                biteId: notifications.biteId,
                message: notifications.message,
                read: notifications.read,
                createdAt: notifications.createdAt,
                fromUser: {
                    id: users.id,
                    username: users.username,
                    avatarUrl: users.avatarUrl,
                },
            })
            .from(notifications)
            .leftJoin(users, eq(notifications.fromUserId, users.id))
            .where(eq(notifications.toUserId, req.user.id))
            .orderBy(desc(notifications.createdAt))
            .limit(limit)
            .offset(offset);

        return res.status(200).json({
            message: 'success',
            data,
            pagination: {
                page,
                limit,
                hasMore: data.length === limit,
            },
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const markNotificationAsRead = async (req, res) => {
    try {
        const [notification] = await db
            .update(notifications)
            .set({ read: true })
            .where(
                and(
                    eq(notifications.id, req.params.id),
                    eq(notifications.toUserId, req.user.id)
                )
            )
            .returning();

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        return res.status(200).json({
            message: 'Notification marked as read',
            notification,
        });
    } catch (error) {
        console.error('Mark notification as read error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
