import { inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { fcmTokens } from '../db/schema.js';
import { getMessaging } from '../config/firebase.admin.js';

const INVALID_TOKEN_CODES = new Set([
    'messaging/invalid-registration-token',
    'messaging/registration-token-not-registered',
]);

const chunk = (items, size) => {
    const chunks = [];

    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }

    return chunks;
};

export const sendPushToUser = async ({ userId, title, body, data = {} }) => {
    const messaging = getMessaging();

    if (!messaging) {
        return { sent: 0, skipped: true };
    }

    const rows = await db
        .select({ token: fcmTokens.token })
        .from(fcmTokens)
        .where(inArray(fcmTokens.userId, [userId]));

    const tokens = [...new Set(rows.map((row) => row.token))];

    if (tokens.length === 0) {
        return { sent: 0 };
    }

    let sent = 0;
    const invalidTokens = [];
    const stringData = Object.fromEntries(
        Object.entries(data)
            .filter(([, value]) => value !== undefined && value !== null)
            .map(([key, value]) => [key, String(value)])
    );

    for (const tokenChunk of chunk(tokens, 500)) {
        const response = await messaging.sendEachForMulticast({
            tokens: tokenChunk,
            notification: { title, body },
            data: stringData,
            webpush: {
                fcmOptions: {
                    link: process.env.CLIENT_URL || 'http://localhost:5173',
                },
            },
        });

        sent += response.successCount;

        response.responses.forEach((result, index) => {
            if (
                !result.success &&
                INVALID_TOKEN_CODES.has(result.error?.code)
            ) {
                invalidTokens.push(tokenChunk[index]);
            }
        });
    }

    if (invalidTokens.length > 0) {
        await db
            .delete(fcmTokens)
            .where(inArray(fcmTokens.token, invalidTokens));
    }

    return { sent };
};
