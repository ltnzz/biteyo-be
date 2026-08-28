import { db } from '../db/index.js';
import { bites, users } from '../db/schema.js';
import { and, eq } from 'drizzle-orm';
import { deleteStorageObject } from '../utils/storage.js';
import { safeCreateMentionsFromText } from '../utils/mentionSafe.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

export const createBite = async ({ userId, body, photoPath }) => {
    const {
        foodName,
        locationName,
        locationAddress,
        latitude,
        longitude,
        placeId,
        review,
        rating,
        category,
    } = body;

    let newBite;
    try {
        [newBite] = await db
            .insert(bites)
            .values({
                userId,
                foodName,
                locationName,
                locationAddress,
                latitude: latitude?.toString(),
                longitude: longitude?.toString(),
                placeId,
                review,
                rating,
                photoUrl: photoPath,
                category,
            })
            .returning();
    } catch (error) {
        // Inline compensation: upload already happened in middleware before DB. Clean up orphan.
        if (photoPath) {
            try {
                await deleteStorageObject(photoPath);
            } catch (cleanupError) {
                logger.error('Cleanup orphan bite photo failed:', {
                    photoPath,
                    error: cleanupError?.message,
                });
            }
        }
        throw error;
    }

    const [actor] = await db
        .select({ username: users.username })
        .from(users)
        .where(eq(users.id, userId));

    const { mentions: mentionedUsers, mentionsFailed } = await safeCreateMentionsFromText({
        text: review,
        sourceType: 'bite',
        sourceId: newBite.id,
        biteId: newBite.id,
        mentionedByUserId: userId,
        actorUsername: actor?.username,
    });

    if (mentionsFailed) {
        logger.warn('Bite mentions partially failed', { biteId: newBite.id });
    }

    return { bite: newBite, mentions: mentionedUsers, mentionsFailed };
};

export const updateBite = async ({ userId, biteId, body }) => {
    const { foodName, review, rating, category } = body;

    const existingBite = await db
        .select()
        .from(bites)
        .where(and(eq(bites.id, biteId), eq(bites.userId, userId)));

    if (existingBite.length === 0) {
        throw new AppError('Bite not found', 404);
    }

    const [updatedBite] = await db
        .update(bites)
        .set({
            foodName,
            review,
            rating,
            category,
            updatedAt: new Date(),
        })
        .where(eq(bites.id, biteId))
        .returning();

    let mentionedUsers = [];
    let mentionsFailed = false;

    if (review !== undefined) {
        const [actor] = await db
            .select({ username: users.username })
            .from(users)
            .where(eq(users.id, userId));

        const result = await safeCreateMentionsFromText({
            text: review,
            sourceType: 'bite',
            sourceId: updatedBite.id,
            biteId: updatedBite.id,
            mentionedByUserId: userId,
            actorUsername: actor?.username,
        });
        mentionedUsers = result.mentions;
        mentionsFailed = result.mentionsFailed;
        if (mentionsFailed) {
            logger.warn('Bite update mentions partially failed', { biteId: updatedBite.id });
        }
    }

    return { bite: updatedBite, mentions: mentionedUsers, mentionsFailed };
};

export const deleteBite = async ({ userId, biteId }) => {
    const existingBite = await db
        .select()
        .from(bites)
        .where(and(eq(bites.id, biteId), eq(bites.userId, userId)));

    if (existingBite.length === 0) {
        throw new AppError('Bite not found', 404);
    }

    const [bite] = existingBite;
    await db.delete(bites).where(eq(bites.id, biteId));

    // Storage cleanup after DB success; fire-and-forget with orphan logging.
    try {
        await deleteStorageObject(bite.photoUrl);
    } catch (error) {
        logger.error('Storage cleanup after deleteBite failed (orphan, needs reconciliation):', {
            biteId,
            photoUrl: bite.photoUrl,
            error: error?.message,
        });
    }
};
