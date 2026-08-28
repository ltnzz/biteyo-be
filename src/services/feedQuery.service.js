import { db } from '../db/index.js';
import {
    BITE_CATEGORIES,
    bites,
    users,
    likes,
    saved,
    follows,
} from '../db/schema.js';
import { alias } from 'drizzle-orm/pg-core';
import {
    desc,
    eq,
    sql,
    and,
    ilike,
    or,
} from 'drizzle-orm';
import {
    calculateViralScore,
    isTrendingScore,
    getViralScoreSqlExpr,
    getTrendingStatusSqlExpr,
} from '../utils/viral.js';
import { AppError } from '../utils/errors.js';

export const viewerLikes = alias(likes, 'viewer_likes');
export const viewerSaved = alias(saved, 'viewer_saved');

export const getTrendingStatusSql = () =>
    getTrendingStatusSqlExpr(
        bites.viewsCount,
        bites.likesCount,
        bites.commentsCount
    );

export const getBiteViralScoreSql = () =>
    getViralScoreSqlExpr(
        bites.viewsCount,
        bites.likesCount,
        bites.commentsCount
    );

export const getViewerFlags = () => ({
    isLiked: viewerLikes.id,
    isSaved: viewerSaved.id,
});

export const getBiteSelect = (userId, extraFields = {}) => ({
    id: bites.id,
    foodName: bites.foodName,
    locationName: bites.locationName,
    locationAddress: bites.locationAddress,
    latitude: bites.latitude,
    longitude: bites.longitude,
    placeId: bites.placeId,
    review: bites.review,
    rating: bites.rating,
    photoUrl: bites.photoUrl,
    category: bites.category,
    viewsCount: bites.viewsCount,
    isTrending: getTrendingStatusSql(),
    viralScore: getBiteViralScoreSql(),
    createdAt: bites.createdAt,
    ...extraFields,

    user: {
        id: users.id,
        name: users.name,
        username: users.username,
        avatarUrl: users.avatarUrl,
    },

    likesCount: bites.likesCount,
    commentsCount: bites.commentsCount,
    ...getViewerFlags(),
});

export const normalizeBiteViewerFlags = (bite) => ({
    ...bite,
    isLiked: Boolean(bite.isLiked),
    isSaved: Boolean(bite.isSaved),
});

/**
 * Read-only: kembalikan engagement terbaru tanpa melakukan write.
 * Dipakai untuk endpoint read murni agar tidak mengubah updatedAt.
 */
export const readBiteEngagement = async (biteId) => {
    const [row] = await db
        .select({
            viewsCount: bites.viewsCount,
            likesCount: bites.likesCount,
            commentsCount: bites.commentsCount,
        })
        .from(bites)
        .where(eq(bites.id, biteId))
        .limit(1);

    if (!row) return null;

    const viralScore = calculateViralScore(row);
    const isTrending = isTrendingScore(viralScore);
    return { ...row, viralScore, isTrending };
};

/**
 * Refresh isTrending secara atomik berdasarkan counter terkini.
 * Dipanggil hanya setelah counter berubah (like, unlike, comment, view).
 */
export const refreshBiteEngagement = async (biteId) => {
    const [updated] = await db
        .update(bites)
        .set({
            isTrending: getTrendingStatusSql(),
            updatedAt: new Date(),
        })
        .where(eq(bites.id, biteId))
        .returning({
            viewsCount: bites.viewsCount,
            likesCount: bites.likesCount,
            commentsCount: bites.commentsCount,
        });

    if (!updated) return null;

    const viralScore = calculateViralScore(updated);
    const isTrending = isTrendingScore(viralScore);
    return { ...updated, viralScore, isTrending };
};

// Backward compat: getBiteEngagement sekarang read-only (tanpa write)
// untuk mencegah write amplification pada pemanggilan yang hanya butuh read.
export const getBiteEngagement = readBiteEngagement;

export const ensureBiteExists = async (biteId, selectFields = { id: bites.id }) => {
    const [bite] = await db.select(selectFields).from(bites).where(eq(bites.id, biteId));

    if (!bite) {
        throw new AppError('Bite not found', 404);
    }

    return bite;
};

export const recordView = async (biteId) => {
    const [updated] = await db
        .update(bites)
        .set({
            viewsCount: sql`${bites.viewsCount} + 1`,
            isTrending: getTrendingStatusSql(),
            updatedAt: new Date(),
        })
        .where(eq(bites.id, biteId))
        .returning({
            viewsCount: bites.viewsCount,
            likesCount: bites.likesCount,
            commentsCount: bites.commentsCount,
        });

    if (!updated) {
        throw new AppError('Bite not found', 404);
    }

    const viralScore = calculateViralScore(updated);
    const isTrending = isTrendingScore(viralScore);
    return { ...updated, viralScore, isTrending };
};

const baseListQuery = (userId) =>
    db
        .select(getBiteSelect(userId))
        .from(bites)
        .leftJoin(users, eq(bites.userId, users.id))
        .leftJoin(
            viewerLikes,
            and(eq(viewerLikes.biteId, bites.id), eq(viewerLikes.userId, userId))
        )
        .leftJoin(
            viewerSaved,
            and(eq(viewerSaved.biteId, bites.id), eq(viewerSaved.userId, userId))
        );

export const listBites = async (
    reqUser,
    {
        page,
        limit,
        sort,
        category,
        search,
        trendingOnly,
        scope,
    } = {}
) => {
    const userId = reqUser?.id;

    const safePage = Math.max(page || 1, 1);
    const safeLimit = Math.min(limit || 10, 50);
    const offset = (safePage - 1) * safeLimit;

    if (category && !BITE_CATEGORIES.includes(category)) {
        throw new AppError('Invalid category', 400);
    }

    if (scope === 'following' && !userId) {
        throw new AppError('Login required for following feed', 401);
    }

    const filters = [];

    if (category) {
        filters.push(eq(bites.category, category));
    }

    if (trendingOnly) {
        filters.push(getTrendingStatusSql());
    }

    if (scope === 'following') {
        // hanya bite dari orang yang di-follow user ini.
        // catatan: alias drizzle tidak bisa di-embed di raw sql (hanya
        // nama aliasnya yang dirender), jadi pakai tabel asli + alias manual.
        filters.push(sql`exists (
            select 1 from ${follows} f
            where f.follower_id = ${userId}
              and f.following_id = ${bites.userId}
        )`);
    }

    if (search?.trim()) {
        const searchPattern = `%${search.trim()}%`;

        filters.push(
            or(
                ilike(bites.foodName, searchPattern),
                ilike(bites.locationName, searchPattern),
                ilike(bites.review, searchPattern)
            )
        );
    }

    let query = baseListQuery(userId);

    if (filters.length > 0) {
        query = query.where(and(...filters));
    }

    const feeds = await (
        sort === 'viral' || sort === 'trending' || trendingOnly
            ? query.orderBy(desc(getBiteViralScoreSql()), desc(bites.createdAt))
            : query.orderBy(desc(bites.createdAt))
    )
        .limit(safeLimit)
        .offset(offset);

    return {
        data: feeds.map(normalizeBiteViewerFlags),
        pagination: {
            page: safePage,
            limit: safeLimit,
            hasMore: feeds.length === safeLimit,
        },
    };
};

export const findBiteById = async (biteId, userId) => {
    const [bite] = await baseListQuery(userId).where(eq(bites.id, biteId)).limit(1);

    if (!bite) {
        throw new AppError('Bite not found', 404);
    }

    return normalizeBiteViewerFlags(bite);
};

/**
 * Keyword trending mingguan: food_name paling sering diposting,
 * dibobot engagement (rumus viral score yang sama dengan index DB).
 * Skor = COUNT(bite) × Σ(views×1 + likes×3 + comments×5)
 */
export const getTrendingKeywords = async (query, limit = 8) => {
    const rows = await db
        .select({
            keyword: sql`lower(${bites.foodName})`,
            count: sql`count(*)::int`,
            score: sql`sum(${bites.viewsCount} + ${bites.likesCount} * 3 + ${bites.commentsCount} * 5)::int`,
        })
        .from(bites)
        .where(
            and(
                sql`${bites.createdAt} >= now() - interval '7 days'`,
                query?.trim()
                    ? ilike(bites.foodName, `%${query.trim()}%`)
                    : undefined
            )
        )
        .groupBy(sql`lower(${bites.foodName})`)
        .orderBy(sql`sum(${bites.viewsCount} + ${bites.likesCount} * 3 + ${bites.commentsCount} * 5) desc`)
        .limit(limit);

    return rows.map(({ keyword, count, score }) => ({
        keyword,
        count: Number(count),
        score: Number(score),
    }));
};
