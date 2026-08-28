import { eq, ne, and, desc, ilike, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../db/index.js';
import { users, bites, follows, likes, saved } from '../db/schema.js';
import {
    getViralScoreSqlExpr,
    getTrendingStatusSqlExpr,
} from '../utils/viral.js';
import { logger } from '../utils/logger.js';
import { getTokenCookieOptions } from '../utils/cookie.js';
import { deleteStorageObject } from '../utils/storage.js';
import { parsePagination } from '../utils/pagination.js';
import {
    followUserService,
    unfollowUserService,
    getFollowStats,
} from '../services/follow.service.js';

const viewerLikes = alias(likes, 'viewer_likes');
const viewerSaved = alias(saved, 'viewer_saved');

const getBiteViralScoreSql = () =>
    getViralScoreSqlExpr(
        bites.viewsCount,
        bites.likesCount,
        bites.commentsCount
    );

const getTrendingStatusSql = () =>
    getTrendingStatusSqlExpr(
        bites.viewsCount,
        bites.likesCount,
        bites.commentsCount
    );

const getViewerFlags = () => ({
    isLiked: viewerLikes.id,
    isSaved: viewerSaved.id,
});

const getBiteSelect = (currentUserId, extraFields = {}) => ({
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

const normalizeBiteViewerFlags = (bite) => ({
    ...bite,
    isLiked: Boolean(bite.isLiked),
    isSaved: Boolean(bite.isSaved),
});

/**
 * Aktivitas posting bulanan user untuk grafik profil.
 * Selalu mengembalikan 6 bulan terakhir (bulan tanpa aktivitas = 0).
 */
export const getProfileActivity = async (req, res) => {
    try {
        const { username } = req.params;

        const [user] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.username, username));

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const rows = await db
            .select({
                month: sql`to_char(date_trunc('month', ${bites.createdAt}), 'YYYY-MM')`,
                count: sql`count(*)::int`,
            })
            .from(bites)
            .where(
                and(
                    eq(bites.userId, user.id),
                    sql`${bites.createdAt} >= date_trunc('month', now()) - interval '5 months'`
                )
            )
            .groupBy(sql`date_trunc('month', ${bites.createdAt})`)
            .orderBy(sql`date_trunc('month', ${bites.createdAt})`);

        const countByMonth = new Map(rows.map((r) => [r.month, Number(r.count)]));
        const data = [];
        const cursor = new Date();
        cursor.setDate(1);

        for (let i = 5; i >= 0; i--) {
            const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            data.push({ month: key, count: countByMonth.get(key) ?? 0 });
        }

        return res.status(200).json({
            message: 'success',
            data,
        });
    } catch (error) {
        logger.error('Get profile activity error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const getProfile = async (req, res) => {
    try {
        const { username } = req.params;
        const currentUserId = req.user.id;

        const [user] = await db
            .select({
                id: users.id,
                name: users.name,
                username: users.username,
                bio: users.bio,
                avatarUrl: users.avatarUrl,
                bannerUrl: users.bannerUrl,
                createdAt: users.createdAt,
            })
            .from(users)
            .where(eq(users.username, username));

        if (!user) {
            return res.status(404).json({
                message: 'User not found',
            });
        }

        // jalankan semua count query secara paralel
        const [
            [{ bitesCount }],
            [{ followersCount }],
            [{ followingCount }],
            following,
        ] = await Promise.all([
            db
                .select({ bitesCount: sql`count(*)::int` })
                .from(bites)
                .where(eq(bites.userId, user.id)),

            db
                .select({ followersCount: sql`count(*)::int` })
                .from(follows)
                .where(eq(follows.followingId, user.id)),

            db
                .select({ followingCount: sql`count(*)::int` })
                .from(follows)
                .where(eq(follows.followerId, user.id)),

            db
                .select({ id: follows.id })
                .from(follows)
                .where(
                    and(
                        eq(follows.followerId, currentUserId),
                        eq(follows.followingId, user.id)
                    )
                ),
        ]);

        return res.status(200).json({
            user: {
                ...user,
                bitesCount,
                followersCount,
                followingCount,
                isFollowing: following.length > 0,
            },
        });
    } catch (error) {
        logger.error('Error in getProfile controller', error);
        return res.status(500).json({
            message: 'Internal server error',
        });
    }
};

const getMentionQuery = (rawQuery = '') => {
    const query = String(rawQuery).trim();
    const mentionStart = query.lastIndexOf('@');

    if (mentionStart >= 0) {
        return query.slice(mentionStart + 1).match(/^[a-zA-Z0-9_]*/)?.[0] || '';
    }

    return query.replace(/^@/, '').trim();
};

export const getMentionSuggestions = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const query = getMentionQuery(req.query.q || req.query.search || '');
        const { limit } = parsePagination(req.query, { defaultLimit: 8, maxLimit: 20 });

        const filters = [ne(users.id, currentUserId)];

        if (query) {
            filters.push(ilike(users.username, `${query}%`));
        }

        const mentionUsers = await db
            .select({
                id: users.id,
                name: users.name,
                username: users.username,
                avatarUrl: users.avatarUrl,
                bio: users.bio,
            })
            .from(users)
            .where(and(...filters))
            .orderBy(users.username)
            .limit(limit);

        return res.status(200).json({
            message: 'success',
            data: mentionUsers.map((user) => ({
                ...user,
                mention: `@${user.username}`,
            })),
        });
    } catch (error) {
        logger.error('Mention suggestions error:', error);
        return res.status(500).json({
            message: 'Internal server error',
        });
    }
};

export const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, username, bio } = req.body;
        const avatarUrl =
            req.files?.avatar?.[0]?.path || req.files?.profileImage?.[0]?.path;
        const bannerUrl =
            req.files?.banner?.[0]?.path ||
            req.files?.bannerImage?.[0]?.path ||
            req.files?.cover?.[0]?.path;

        const trimmedNameForCheck = typeof name === 'string' ? name.trim() : '';
        const hasNameUpdate = typeof name === 'string' ? trimmedNameForCheck.length > 0 : false;

        // cek jika tidak ada field yang diupdate sama sekali
        if (!hasNameUpdate && !username && bio === undefined && !avatarUrl && !bannerUrl) {
            return res.status(400).json({
                message: 'No fields to update',
            });
        }

        // cek username tidak bentrok dengan user lain
        if (username) {
            const [existing] = await db
                .select({ id: users.id })
                .from(users)
                .where(and(eq(users.username, username), ne(users.id, userId)));

            if (existing) {
                return res.status(400).json({
                    message: 'Username already taken',
                });
            }
        }

        const updateData = { updatedAt: new Date() };
        if (hasNameUpdate) {
            updateData.name = trimmedNameForCheck;
        }
        if (username) updateData.username = username;
        if (bio !== undefined) updateData.bio = bio;
        if (avatarUrl) updateData.avatarUrl = avatarUrl;
        if (bannerUrl) updateData.bannerUrl = bannerUrl;

        let updatedUser;
        try {
            [updatedUser] = await db
                .update(users)
                .set(updateData)
                .where(eq(users.id, userId))
                .returning();
        } catch (dbError) {
            // Inline compensation for orphan avatar/banner when DB fails after upload
            for (const url of [avatarUrl, bannerUrl].filter(Boolean)) {
                try {
                    await deleteStorageObject(url);
                } catch (cleanupError) {
                    logger.error('Cleanup orphan profile media failed:', {
                        url,
                        error: cleanupError?.message,
                    });
                }
            }
            throw dbError;
        }

        const { password, ...safeUser } = updatedUser;

        return res.status(200).json({
            message: 'Profile updated successfully',
            user: safeUser,
        });
    } catch (error) {
        logger.error('Error in updateProfile controller', error);
        return res.status(500).json({
            message: 'Internal server error',
        });
    }
};

export const followUser = async (req, res) => {
    try {
        const result = await followUserService({
            targetUsername: req.params.username,
            currentUserId: req.user.id,
        });

        if (result.alreadyFollowing) {
            return res.status(200).json({
                message: 'Already following user',
                following: true,
                ...result.followStats,
            });
        }

        return res.status(201).json({
            message: 'User followed',
            following: true,
            follow: result.follow,
            ...result.followStats,
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        logger.error('Follow user error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const unfollowUser = async (req, res) => {
    try {
        const result = await unfollowUserService({
            targetUsername: req.params.username,
            currentUserId: req.user.id,
        });

        return res.status(200).json({
            message: result.deletedFollow ? 'User unfollowed' : 'User is not followed',
            following: false,
            ...result.followStats,
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        logger.error('Unfollow user error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const deleteAccount = async (req, res) => {
    try {
        const userId = req.user.id;

        const [existing] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, userId));

        if (!existing) {
            return res.status(404).json({
                message: 'User not found',
            });
        }

        await db.delete(users).where(eq(users.id, userId));

        res.clearCookie('token', getTokenCookieOptions(req));

        return res.status(200).json({
            message: 'Account deleted successfully',
        });
    } catch (error) {
        logger.error('Error in deleteAccount controller', error);
        return res.status(500).json({
            message: 'Internal server error',
        });
    }
};

export const getUserBites = async (req, res) => {
    try {
        const { username } = req.params;
        const currentUserId = req.user.id;

        const { page, limit, offset } = parsePagination(req.query);

        const [user] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.username, username));

        if (!user) {
            return res.status(404).json({
                message: 'User not found',
            });
        }

        const userBites = await db
            .select(getBiteSelect(currentUserId))
            .from(bites)
            .leftJoin(users, eq(bites.userId, users.id))
            .leftJoin(
                viewerLikes,
                and(
                    eq(viewerLikes.biteId, bites.id),
                    eq(viewerLikes.userId, currentUserId)
                )
            )
            .leftJoin(
                viewerSaved,
                and(
                    eq(viewerSaved.biteId, bites.id),
                    eq(viewerSaved.userId, currentUserId)
                )
            )
            .where(eq(bites.userId, user.id))
            .orderBy(desc(bites.createdAt))
            .limit(limit)
            .offset(offset);

        return res.status(200).json({
            message: 'success',
            data: userBites.map(normalizeBiteViewerFlags),
            pagination: {
                page,
                limit,
                hasMore: userBites.length === limit,
            },
        });
    } catch (error) {
        logger.error('Error in getUserBites controller', error);
        return res.status(500).json({
            message: 'Internal server error',
        });
    }
};

export const getSavedBites = async (req, res) => {
    try {
        const currentUserId = req.user.id;

        const { page, limit, offset } = parsePagination(req.query);

        const savedBites = await db
            .select({
                ...getBiteSelect(currentUserId, { savedAt: saved.createdAt }),
                isSaved: sql`true`,
            })
            .from(saved)
            .innerJoin(bites, eq(saved.biteId, bites.id))
            .leftJoin(users, eq(bites.userId, users.id))
            .leftJoin(
                viewerLikes,
                and(
                    eq(viewerLikes.biteId, bites.id),
                    eq(viewerLikes.userId, currentUserId)
                )
            )
            .where(eq(saved.userId, currentUserId))
            .orderBy(desc(saved.createdAt))
            .limit(limit)
            .offset(offset);

        return res.status(200).json({
            message: 'success',
            data: savedBites.map(normalizeBiteViewerFlags),
            pagination: {
                page,
                limit,
                hasMore: savedBites.length === limit,
            },
        });
    } catch (error) {
        logger.error('Error in getSavedBites controller', error);
        return res.status(500).json({
            message: 'Internal server error',
        });
    }
};

const getLikedBitesByUserId = async ({
    targetUserId,
    currentUserId,
    page,
    limit,
}) => {
    const userLikes = alias(likes, 'user_likes');
    const offset = (page - 1) * limit;

    return db
        .select(getBiteSelect(currentUserId, { likedAt: userLikes.createdAt }))
        .from(userLikes)
        .innerJoin(bites, eq(userLikes.biteId, bites.id))
        .leftJoin(users, eq(bites.userId, users.id))
        .leftJoin(
            viewerLikes,
            and(
                eq(viewerLikes.biteId, bites.id),
                eq(viewerLikes.userId, currentUserId)
            )
        )
        .leftJoin(
            viewerSaved,
            and(
                eq(viewerSaved.biteId, bites.id),
                eq(viewerSaved.userId, currentUserId)
            )
        )
        .where(eq(userLikes.userId, targetUserId))
        .orderBy(desc(userLikes.createdAt))
        .limit(limit)
        .offset(offset);
};

const getLikedBitesResponse = async ({ req, res, targetUserId }) => {
    const currentUserId = req.user.id;
    const { page, limit } = parsePagination(req.query);
    const likedBites = await getLikedBitesByUserId({
        targetUserId,
        currentUserId,
        page,
        limit,
    });

    return res.status(200).json({
        message: 'success',
        data: likedBites.map(normalizeBiteViewerFlags),
        pagination: {
            page,
            limit,
            hasMore: likedBites.length === limit,
        },
    });
};

export const getLikedBites = async (req, res) => {
    try {
        return getLikedBitesResponse({
            req,
            res,
            targetUserId: req.user.id,
        });
    } catch (error) {
        logger.error('Error in getLikedBites controller', error);
        return res.status(500).json({
            message: 'Internal server error',
        });
    }
};

export const getUserLikedBites = async (req, res) => {
    try {
        const [user] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.username, req.params.username));

        if (!user) {
            return res.status(404).json({
                message: 'User not found',
            });
        }

        return getLikedBitesResponse({
            req,
            res,
            targetUserId: user.id,
        });
    } catch (error) {
        logger.error('Error in getUserLikedBites controller', error);
        return res.status(500).json({
            message: 'Internal server error',
        });
    }
};
