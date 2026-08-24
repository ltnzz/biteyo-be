import { sendPushToUser } from './push.notification.js';
import { logger } from '../utils/logger.js';

/**
 * KIRIM PUSH FCM untuk sebuah notifikasi.
 *
 * PENTING — ownership notifikasi:
 * - Record di tabel `notifications` dibuat oleh TRIGGER DATABASE
 *   (lihat drizzle/0006_supabase_phase1.sql untuk like/comment/follow
 *   dan drizzle/0013_mention_notification_triggers.sql untuk mention).
 * - Fungsi ini TIDAK membuat record; ia hanya mengirim push FCM
 *   setelah trigger menulis row. Gagal push tidak mempengaruhi data.
 */
export const sendNotificationPush = async ({
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
        logger.error('Push notification failed:', error);
    }

    return null;
};
