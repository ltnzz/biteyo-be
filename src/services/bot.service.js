import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, bites, likes, comments, botDailyJobs } from '../db/schema.js';
import { botBites, botComments } from '../utils/botData.js';
import { logger } from '../utils/logger.js';

export const getTodayJobDate = () => {
    // WIB (Asia/Jakarta UTC+7) — cron jam 8 WIB harus pakai tanggal WIB, bukan UTC
    const now = new Date();
    const wib = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const y = wib.getFullYear();
    const m = String(wib.getMonth() + 1).padStart(2, '0');
    const d = String(wib.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

export const ensureBotUser = async () => {
    let [botUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, 'biteyo_bot'))
        .limit(1);

    if (botUser) return botUser;

    const randomPassword = crypto.randomBytes(16).toString('hex');
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    try {
        const [created] = await db
            .insert(users)
            .values({
                name: 'Biteyo Bot',
                username: 'biteyo_bot',
                email: 'bot@biteyo.com',
                password: hashedPassword,
                bio: '🤖 Official Biteyo Reviewer Bot | Nyobain makanan enak tiap hari secara otomatis!',
                avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
            })
            .onConflictDoNothing({ target: users.username })
            .returning();
        if (created) {
            logger.info(`[Bot] Successfully created bot user @${created.username}`);
            return created;
        }
    } catch (err) {
        // handle race on email unique as well
        const isUnique = err?.code === '23505' || /duplicate key|unique/i.test(err?.message || '');
        if (!isUnique) throw err;
    }

    // Race: another instance created, fetch again
    [botUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, 'biteyo_bot'))
        .limit(1);
    return botUser;
};

export const selectAvailableBotReview = async (botUserId) => {
    const recentBites = await db
        .select({ foodName: bites.foodName })
        .from(bites)
        .where(eq(bites.userId, botUserId))
        .orderBy(desc(bites.createdAt))
        .limit(3);

    const recentFoodNames = new Set(recentBites.map((b) => b.foodName));
    let availableBites = botBites.filter((b) => !recentFoodNames.has(b.foodName));

    if (availableBites.length === 0) {
        availableBites = botBites;
    }

    const chosen = availableBites[Math.floor(Math.random() * availableBites.length)];
    logger.info(`[Bot] Selected review for upload: "${chosen.foodName}"`);
    return chosen;
};

export const createBotBite = async (botUserId, chosen) => {
    const [newBite] = await db
        .insert(bites)
        .values({
            userId: botUserId,
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
            viewsCount: Math.floor(Math.random() * 41) + 15,
            likesCount: 0,
            commentsCount: 0,
        })
        .returning();
    return newBite;
};

export const simulateBotEngagement = async (biteId, botUserId) => {
    const BOT_ENGAGEMENT_USERNAME = 'latanzaakbarfadilah';

    const [engagementUser] = await db
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(eq(users.username, BOT_ENGAGEMENT_USERNAME))
        .limit(1);

    if (!engagementUser || engagementUser.id === botUserId) {
        logger.info(`[Bot] Engagement user @${BOT_ENGAGEMENT_USERNAME} not found. Skipping engagement simulation.`);
        return { simulatedLikes: 0, simulatedComments: 0 };
    }

    logger.info(`[Bot] Simulating engagement as @${engagementUser.username}...`);

    await db
        .insert(likes)
        .values({ userId: engagementUser.id, biteId })
        .onConflictDoNothing();

    const content = botComments[Math.floor(Math.random() * botComments.length)];
    await db.insert(comments).values({
        userId: engagementUser.id,
        biteId,
        content,
    });

    logger.info('[Bot] Simulated 1 like and 1 comment on the new post.');
    return { simulatedLikes: 1, simulatedComments: 1 };
};

export const executeDailyUpload = async () => {
    logger.info('[Bot] Running daily upload task...');

    const today = getTodayJobDate();

    // Idempotency claim: one row per UTC date
    try {
        const [claimed] = await db
            .insert(botDailyJobs)
            .values({ jobDate: today })
            .onConflictDoNothing()
            .returning({ jobDate: botDailyJobs.jobDate });

        if (!claimed) {
            const [existingJob] = await db
                .select()
                .from(botDailyJobs)
                .where(eq(botDailyJobs.jobDate, today))
                .limit(1);
            if (existingJob?.biteId) {
                const [existingBite] = await db
                    .select()
                    .from(bites)
                    .where(eq(bites.id, existingJob.biteId))
                    .limit(1);
                logger.info(`[Bot] Daily job for ${today} already executed, returning existing bite.`);
                return { bite: existingBite, simulatedLikes: 0, simulatedComments: 0, alreadyExecuted: true };
            }
            logger.warn(`[Bot] Daily job for ${today} already in progress (concurrent).`);
            const err = new Error('Daily job already in progress');
            err.statusCode = 409;
            throw err;
        }
    } catch (err) {
        if (err.statusCode === 409) throw err;
        // If table does not exist yet (migration not applied), log and continue without idempotency
        const msg = err?.message || '';
        const causeMsg = err?.cause?.message || '';
        if (/relation.*bot_daily_jobs.*does not exist/i.test(msg) || /relation.*bot_daily_jobs.*does not exist/i.test(causeMsg)) {
            logger.warn('[Bot] bot_daily_jobs table missing, running without idempotency');
        } else if (err?.code !== '23505' && err?.cause?.code !== '23505') {
            throw err;
        }
    }

    const botUser = await ensureBotUser();
    const chosen = await selectAvailableBotReview(botUser.id);
    const newBite = await createBotBite(botUser.id, chosen);
    const engagement = await simulateBotEngagement(newBite.id, botUser.id);

    // Update job with bite_id
    try {
        await db
            .update(botDailyJobs)
            .set({ biteId: newBite.id })
            .where(eq(botDailyJobs.jobDate, today));
    } catch (err) {
        logger.warn('[Bot] Failed to link bite to daily job', { today, biteId: newBite.id, error: err?.message });
    }

    logger.info('[Bot] Daily upload complete.');
    return {
        bite: newBite,
        ...engagement,
    };
};
