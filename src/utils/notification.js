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

    try {
        await sendPushToUser({
            userId: toUserId,
            title: 'BiteYo',
            body: message,
            data: {
                type,
                biteId,
                fromUserId,
            },
        });
    } catch (error) {
        console.error('Push notification failed:', error);
    }

    return null;
};
