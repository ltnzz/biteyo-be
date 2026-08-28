import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, bites, likes, comments } from '../db/schema.js';
import { botBites, botComments } from '../utils/botData.js';
import { logger } from '../utils/logger.js';

/**
 * Executes the core daily upload logic:
 * 1. Checks or creates the @biteyo_bot user.
 * 2. Selects a random review from the bot data pool (avoiding recent duplicates).
 * 3. Creates the post.
 * 4. Simulates engagement (likes and comments) from other active users.
 * 
 * @returns {Promise<Object>} Created bite data with simulated engagement statistics.
 */
export const executeDailyUpload = async () => {
    logger.info('[Bot] Running daily upload task...');

    // 1. Get or create the bot user
    let [botUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, 'biteyo_bot'))
        .limit(1);

    if (!botUser) {
        logger.info('[Bot] Bot user @biteyo_bot not found. Creating new bot user...');
        // Hash a randomized password to secure the account
        const randomPassword = crypto.randomBytes(16).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        const [createdUser] = await db
            .insert(users)
            .values({
                name: 'Biteyo Bot',
                username: 'biteyo_bot',
                email: 'bot@biteyo.com',
                password: hashedPassword,
                bio: '🤖 Official Biteyo Reviewer Bot | Nyobain makanan enak tiap hari secara otomatis!',
                avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
            })
            .returning();
        botUser = createdUser;
        logger.info(`[Bot] Successfully created bot user @${botUser.username}`);
    }

    // 2. Select a food review to post, avoiding the 3 most recently posted by the bot
    const recentBites = await db
        .select({ foodName: bites.foodName })
        .from(bites)
        .where(eq(bites.userId, botUser.id))
        .orderBy(desc(bites.createdAt))
        .limit(3);

    const recentFoodNames = new Set(recentBites.map((b) => b.foodName));
    let availableBites = botBites.filter((b) => !recentFoodNames.has(b.foodName));

    if (availableBites.length === 0) {
        availableBites = botBites;
    }

    const chosen = availableBites[Math.floor(Math.random() * availableBites.length)];
    logger.info(`[Bot] Selected review for upload: "${chosen.foodName}"`);

    // 3. Insert the bite into the database
    const [newBite] = await db
        .insert(bites)
        .values({
            userId: botUser.id,
            foodName: chosen.foodName,
            locationName: chosen.locationName,
            locationAddress: chosen.locationAddress,
            latitude: chosen.latitude,
            longitude: chosen.longitude,
            placeId: chosen.placeId,
            review: chosen.review,
            rating: chosen.rating,
            photoUrl: chosen.photoUrl,
            category: chosen.category,
            viewsCount: Math.floor(Math.random() * 41) + 15, // 15 to 55 initial views
            likesCount: 0,
            commentsCount: 0,
        })
        .returning();

    // 4. Simulate engagement using a single designated user
    // (hanya akun ini yang like & komen postingan bot)
    const BOT_ENGAGEMENT_USERNAME = 'latanzaakbarfadilah';

    const [engagementUser] = await db
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(eq(users.username, BOT_ENGAGEMENT_USERNAME))
        .limit(1);

    let simulatedLikes = 0;
    let simulatedComments = 0;

    if (!engagementUser || engagementUser.id === botUser.id) {
        logger.info(
            `[Bot] Engagement user @${BOT_ENGAGEMENT_USERNAME} not found. Skipping engagement simulation.`
        );
    } else {
        logger.info(
            `[Bot] Simulating engagement as @${engagementUser.username}...`
        );

        // A. Like dari akun designated
        await db
            .insert(likes)
            .values({ userId: engagementUser.id, biteId: newBite.id })
            .onConflictDoNothing();
        simulatedLikes = 1;
        logger.info('[Bot] Simulated 1 like on the new post.');

        // B. Komentar acak dari pool botComments (emote sengaja dipertahankan biar variatif)
        const content =
            botComments[Math.floor(Math.random() * botComments.length)];
        await db.insert(comments).values({
            userId: engagementUser.id,
            biteId: newBite.id,
            content,
        });
        simulatedComments = 1;
        logger.info('[Bot] Simulated 1 comment on the new post.');

        // likes_count / comments_count di-update otomatis oleh DB trigger
        // (sync_bite_like_count / sync_bite_comment_count, drizzle/0008)
    }

    logger.info('[Bot] Daily upload complete.');
    return {
        bite: newBite,
        simulatedLikes,
        simulatedComments,
    };
};

/**
 * Express Route controller to trigger the daily upload webhook.
 * Mendukung header standar Vercel Cron (`Authorization: Bearer <CRON_SECRET>`)
 * serta custom header `x-cron-secret`.
 */
export const triggerDailyUpload = async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const bearerToken =
            typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
                ? authHeader.slice(7).trim()
                : null;
        const customHeader =
            typeof req.headers['x-cron-secret'] === 'string'
                ? req.headers['x-cron-secret'].trim()
                : null;
        const secret = customHeader || bearerToken;

        if (!process.env.CRON_SECRET) {
            logger.warn('[Bot] Warning: CRON_SECRET is not set in environment variables.');
            return res.status(500).json({
                message: 'Cron configuration error on server.',
            });
        }

        if (!secret || secret !== process.env.CRON_SECRET) {
            logger.warn('[Bot] Unauthorized trigger attempt (invalid or missing cron secret).');
            return res.status(401).json({
                message: 'Unauthorized: Invalid cron secret key.',
            });
        }

        const result = await executeDailyUpload();

        return res.status(201).json({
            message: 'Daily upload bot executed successfully.',
            data: result,
        });
    } catch (error) {
        logger.error('[Bot] HTTP Trigger Error:', error);
        return res.status(500).json({
            message: 'Server error during daily bot upload.',
            error: error.message,
        });
    }
};
