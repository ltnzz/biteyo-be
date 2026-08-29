import { db } from '../db/index.js';
import { bites, comments, commentMentions, users } from '../db/schema.js';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { sendNotificationPush } from '../utils/notification.js';
import { logger } from '../utils/logger.js';
import { safeCreateMentionsFromText } from '../utils/mentionSafe.js';
import {
    ensureBiteExists,
    refreshBiteEngagement,
} from './feedQuery.service.js';
import { AppError } from '../utils/errors.js';

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
            name: users.name,
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

    const [engagement, mentionResult] = await Promise.all([
        refreshBiteEngagement(biteId),
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

    if (mentionResult.mentionsFailed) {
        logger.warn('Comment mentions partially failed', { biteId, commentId: comment.id });
    }

    return {
        comment: {
            ...comment,
            user: actor,
            mentions: mentionResult.mentions,
            mentionsFailed: mentionResult.mentionsFailed,
        },
        ...engagement,
        mentionsFailed: mentionResult.mentionsFailed,
    };
};

export const listComments = async (biteId, { page = 1, limit = 20, sort = 'desc' } = {}) => {
    const bite = await ensureBiteExists(biteId, {
        id: bites.id,
        foodName: bites.foodName,
    });

    const safePage = Math.max(parseInt(page) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 50);
    const offset = (safePage - 1) * safeLimit;
    const order = sort === 'asc' ? asc(comments.createdAt) : desc(comments.createdAt);

    const [biteComments, [{ count: totalCount }]] = await Promise.all([
        db
            .select({
                id: comments.id,
                content: comments.content,
                createdAt: comments.createdAt,
                updatedAt: comments.updatedAt,
                user: {
                    id: users.id,
                    name: users.name,
                    username: users.username,
                    avatarUrl: users.avatarUrl,
                },
            })
            .from(comments)
            .leftJoin(users, eq(comments.userId, users.id))
            .where(eq(comments.biteId, biteId))
            .orderBy(order)
            .limit(safeLimit)
            .offset(offset),
        db
            .select({ count: sql`count(*)::int` })
            .from(comments)
            .where(eq(comments.biteId, biteId)),
    ]);

    return {
        bite,
        comments: biteComments,
        commentsCount: Number(totalCount),
        pagination: {
            page: safePage,
            limit: safeLimit,
            hasMore: biteComments.length === safeLimit && offset + biteComments.length < Number(totalCount),
            total: Number(totalCount),
        },
    };
};

export const editComment = async ({ userId, biteId, commentId, content }) => {
    const [comment] = await db
        .select({ id: comments.id, userId: comments.userId, biteId: comments.biteId })
        .from(comments)
        .where(and(eq(comments.id, commentId), eq(comments.biteId, biteId)))
        .limit(1);

    if (!comment) throw new AppError('Comment not found', 404);
    if (comment.userId !== userId) throw new AppError('Forbidden: not comment owner', 403);

    const [bite] = await db
        .select({ userId: bites.userId, foodName: bites.foodName })
        .from(bites)
        .where(eq(bites.id, biteId))
        .limit(1);

    const [actor] = await db
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(eq(users.id, userId));

    // update content + updatedAt
    const [updated] = await db
        .update(comments)
        .set({ content: content.trim(), updatedAt: new Date() })
        .where(eq(comments.id, commentId))
        .returning();

    // refresh mentions: delete old then recreate
    await db.delete(commentMentions).where(eq(commentMentions.commentId, commentId));

    const mentionResult = await safeCreateMentionsFromText({
        text: content,
        sourceType: 'comment',
        sourceId: commentId,
        biteId,
        mentionedByUserId: userId,
        actorUsername: actor?.username,
        biteFoodName: bite?.foodName,
        excludedUserIds: [bite?.userId].filter(Boolean),
    });

    if (mentionResult.mentionsFailed) {
        logger.warn('Edit comment mentions partially failed', { biteId, commentId });
    }

    const [full] = await db
        .select({
            id: comments.id,
            content: comments.content,
            createdAt: comments.createdAt,
            updatedAt: comments.updatedAt,
            user: {
                id: users.id,
                name: users.name,
                username: users.username,
                avatarUrl: users.avatarUrl,
            },
        })
        .from(comments)
        .leftJoin(users, eq(comments.userId, users.id))
        .where(eq(comments.id, commentId))
        .limit(1);

    return {
        comment: { ...full, mentions: mentionResult.mentions, mentionsFailed: mentionResult.mentionsFailed },
        mentionsFailed: mentionResult.mentionsFailed,
    };
};

export const deleteComment = async ({ userId, biteId, commentId }) => {
    const [comment] = await db
        .select({ id: comments.id, userId: comments.userId })
        .from(comments)
        .where(and(eq(comments.id, commentId), eq(comments.biteId, biteId)))
        .limit(1);

    if (!comment) throw new AppError('Comment not found', 404);
    if (comment.userId !== userId) throw new AppError('Forbidden: not comment owner', 403);

    await db.delete(comments).where(eq(comments.id, commentId));

    // engagement counter will be decremented by trigger, then refresh isTrending
    const engagement = await refreshBiteEngagement(biteId);

    return { deleted: true, ...engagement };
};
