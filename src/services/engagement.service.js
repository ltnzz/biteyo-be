import { db } from '../db/index.js';
import { bites, users, likes, saved } from '../db/schema.js';
import { alias } from 'drizzle-orm/pg-core';
import { and, eq } from 'drizzle-orm';
import { sendNotificationPush } from '../utils/notification.js';
import {
    ensureBiteExists,
    getBiteEngagement,
} from './feedQuery.service.js';

export const toggleLike = async ({ userId, biteId }) => {
    const actorUsers = alias(users, 'actor_users');

    const [bite] = await db
        .select({
            id: bites.id,
            userId: bites.userId,
            foodName: bites.foodName,
            actorUsername: actorUsers.username,
        })
        .from(bites)
        .leftJoin(actorUsers, eq(actorUsers.id, userId))
        .where(eq(bites.id, biteId));

    if (!bite) {
        return null; // caller maps ke 404
    }

    const [deletedLike] = await db
        .delete(likes)
        .where(and(eq(likes.userId, userId), eq(likes.biteId, biteId)))
        .returning({ id: likes.id });

    if (deletedLike) {
        const engagement = await getBiteEngagement(biteId);

        return { status: 200, liked: false, ...engagement };
    }

    const [like] = await db
        .insert(likes)
        .values({ userId, biteId })
        .onConflictDoNothing({
            target: [likes.userId, likes.biteId],
        })
        .returning();

    if (!like) {
        const engagement = await getBiteEngagement(biteId);

        return { status: 200, liked: true, alreadyLiked: true, ...engagement };
    }

    // push FCM dan fetch engagement berjalan paralel
    // agar respons tidak menunggu network call Firebase
    const [, engagement] = await Promise.all([
        sendNotificationPush({
            toUserId: bite.userId,
            fromUserId: userId,
            type: 'like',
            biteId,
            message: `${bite.actorUsername || 'Someone'} liked your ${bite.foodName} post`,
        }),
        getBiteEngagement(biteId),
    ]);

    return { status: 201, liked: true, like, ...engagement };
};

export const toggleSave = async ({ userId, biteId }) => {
    await ensureBiteExists(biteId);

    const [deletedSavedBite] = await db
        .delete(saved)
        .where(and(eq(saved.userId, userId), eq(saved.biteId, biteId)))
        .returning({ id: saved.id });

    if (deletedSavedBite) {
        return { status: 200, saved: false };
    }

    const [savedBite] = await db
        .insert(saved)
        .values({ userId, biteId })
        .onConflictDoNothing({
            target: [saved.userId, saved.biteId],
        })
        .returning();

    if (!savedBite) {
        return { status: 200, saved: true, alreadySaved: true };
    }

    return { status: 201, saved: true, savedBite };
};
