import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { eq, ne, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, bites, likes, comments } from '../db/schema.js';
import { botBites, botComments } from '../utils/botData.js';

// Helper to pick N random elements from an array
function pickN(arr, n) {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
}

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
    console.log('[Bot] Running daily upload task...');

    // 1. Get or create the bot user
    let [botUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, 'biteyo_bot'))
        .limit(1);

    if (!botUser) {
        console.log('[Bot] Bot user @biteyo_bot not found. Creating new bot user...');
        // Hash a randomized password to secure the account
        const randomPassword = crypto.randomBytes(16).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        const [createdUser] = await db
            .insert(users)
            .values({
                username: 'biteyo_bot',
                email: 'bot@biteyo.com',
                password: hashedPassword,
                bio: '🤖 Official Biteyo Reviewer Bot | Nyobain makanan enak tiap hari secara otomatis!',
                avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
            })
            .returning();
        botUser = createdUser;
        console.log(`[Bot] Successfully created bot user @${botUser.username}`);
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
    console.log(`[Bot] Selected review for upload: "${chosen.foodName}"`);

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

    // 4. Simulate engagement using other existing users in the system
    const otherUsers = await db
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(ne(users.username, 'biteyo_bot'));

    let simulatedLikes = 0;
    let simulatedComments = 0;

    if (otherUsers.length > 0) {
        console.log(`[Bot] Simulating engagement using ${otherUsers.length} available users...`);

        // A. Simulate Likes (1 to 3 random users)
        const numLikes = Math.min(otherUsers.length, Math.floor(Math.random() * 3) + 1);
        const likers = pickN(otherUsers, numLikes);

        if (likers.length > 0) {
            await db
                .insert(likes)
                .values(
                    likers.map((u) => ({
                        userId: u.id,
                        biteId: newBite.id,
                    }))
                );
            simulatedLikes = likers.length;
            console.log(`[Bot] Simulated ${simulatedLikes} likes on the new post.`);
        }

        // B. Simulate Comments (1 to 2 random users)
        const numComments = Math.min(otherUsers.length, Math.floor(Math.random() * 2) + 1);
        const commenters = pickN(otherUsers, numComments);
        const commentRecords = [];

        for (const commenter of commenters) {
            const content = botComments[Math.floor(Math.random() * botComments.length)];
            commentRecords.push({
                userId: commenter.id,
                biteId: newBite.id,
                content,
            });
        }

        if (commentRecords.length > 0) {
            await db.insert(comments).values(commentRecords);
            simulatedComments = commentRecords.length;
            console.log(`[Bot] Simulated ${simulatedComments} comments on the new post.`);
        }
        // likes_count / comments_count di-update otomatis oleh DB trigger
        // (sync_bite_like_count / sync_bite_comment_count, drizzle/0008)
    } else {
        console.log('[Bot] No other users found in database to simulate engagement.');
    }

    console.log('[Bot] Daily upload complete.');
    return {
        bite: newBite,
        simulatedLikes,
        simulatedComments,
    };
};

/**
 * Express Route controller to trigger the daily upload webhook.
 * Validates the CRON_SECRET request header/query.
 */
export const triggerDailyUpload = async (req, res) => {
    try {
        const authHeader = req.headers['x-cron-secret'];
        const querySecret = req.query.secret;
        const bearerHeader = req.headers['authorization'];

        let secret = authHeader || querySecret;
        if (!secret && bearerHeader && bearerHeader.startsWith('Bearer ')) {
            secret = bearerHeader.slice(7);
        }

        if (!process.env.CRON_SECRET) {
            console.warn('[Bot] Warning: CRON_SECRET is not set in environment variables.');
            return res.status(500).json({
                message: 'Cron configuration error on server.',
            });
        }

        if (secret !== process.env.CRON_SECRET) {
            console.warn(`[Bot] Unauthorized trigger attempt. Provided secret: "${secret}"`);
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
        console.error('[Bot] HTTP Trigger Error:', error);
        return res.status(500).json({
            message: 'Server error during daily bot upload.',
            error: error.message,
        });
    }
};
