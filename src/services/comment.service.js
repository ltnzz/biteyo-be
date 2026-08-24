import { db } from '../db/index.js';
import { bites, comments, users } from '../db/schema.js';
import { desc, eq } from 'drizzle-orm';
import { sendNotificationPush } from '../utils/notification.js';
import { logger } from '../utils/logger.js';
import { createMentionsFromText } from '../utils/mention.js';
import {
    ensureBiteExists,
    getBiteEngagement,
} from './feedQuery.service.js';

const safeCreateMentionsFromText = async (options) => {
    try {
        return await createMentionsFromText(options);
    } catch (error) {
        logger.error('Create mentions error:', error);
        return [];
    }
};

export const addComment = async ({ userId, biteId, content }) => {
    const bite = await ensureBiteExists(biteId, {
        id: bites.id,
        userId: bites.userId,
        foodName: bites.foodName,
    });

    const [comment] = await db
        .insert(comments)
        .values({
            userId,
            biteId,
            content: content.trim(),
        })
        .returning();

    const [actor] = await db
        .select({
            id: users.id,
            username: users.username,
            avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(eq(users.id, userId));

    // Push FCM fire-and-forget (record notifikasi dibuat trigger DB);
    // engagement dan mentions tetap di-await karena dibutuhkan respons.
    sendNotificationPush({
        toUserId: bite.userId,
        fromUserId: userId,
        type: 'comment',
        biteId,
        message: `${actor?.username || 'Someone'} commented on your ${bite.foodName} post`,
    }).catch((error) => logger.error('Comment push failed:', error));

    const [engagement, mentionedUsers] = await Promise.all([
        getBiteEngagement(biteId),
        safeCreateMentionsFromText({
            text: content,
            sourceType: 'comment',
            sourceId: comment.id,
            biteId,
            mentionedByUserId: userId,
            actorUsername: actor?.username,
            biteFoodName: bite.foodName,
            excludedUserIds: [bite.userId],
        }),
    ]);

    return {
        comment: {
            ...comment,
            user: actor,
            mentions: mentionedUsers,
        },
        ...engagement,
    };
};

export const listComments = async (biteId) => {
    const bite = await ensureBiteExists(biteId, {
        id: bites.id,
        foodName: bites.foodName,
    });

    const biteComments = await db
        .select({
            id: comments.id,
            content: comments.content,
            createdAt: comments.createdAt,
            user: {
                id: users.id,
                username: users.username,
                avatarUrl: users.avatarUrl,
            },
        })
        .from(comments)
        .leftJoin(users, eq(comments.userId, users.id))
        .where(eq(comments.biteId, biteId))
        .orderBy(desc(comments.createdAt));

    return {
        bite,
        comments: biteComments,
        commentsCount: biteComments.length,
    };
};
