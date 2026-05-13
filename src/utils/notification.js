import { db } from '../db/index.js';
import { notifications } from '../db/schema.js';
import { sendPushToUser } from './push.notification.js';

export const createNotificationAndPush = async ({
    toUserId,
    fromUserId,
    type,
    biteId = null,
    message,
}) => {
    if (!toUserId || toUserId === fromUserId) {
        return null;
    }

    const [notification] = await db
        .insert(notifications)
        .values({
            toUserId,
            fromUserId,
            type,
            biteId,
            message,
        })
        .returning();

    try {
        await sendPushToUser({
            userId: toUserId,
            title: 'BiteYo',
            body: message,
            data: {
                notificationId: notification.id,
                type,
                biteId,
                fromUserId,
            },
        });
    } catch (error) {
        console.error('Push notification failed:', error);
    }

    return notification;
};
