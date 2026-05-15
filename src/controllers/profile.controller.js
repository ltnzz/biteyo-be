import { eq, ne, and, desc, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../db/index.js';
import { users, bites, follows, likes, comments, saved } from '../db/schema.js';
import { createNotificationAndPush } from '../utils/notification.js';

const VIRAL_SCORE_THRESHOLD = 20;

const getBiteViralScoreSql = () =>
    sql`(${bites.viewsCount} * 1 + count(distinct ${likes.id}) * 3 + count(distinct ${comments.id}) * 5)::int`;

const getFollowStats = async ({ targetUserId, actorUserId }) => {
    const [[{ targetFollowersCount }], [{ actorFollowingCount }]] =
        await Promise.all([
            db
                .select({ targetFollowersCount: sql`count(*)::int` })
                .from(follows)
                .where(eq(follows.followingId, targetUserId)),
            db
                .select({ actorFollowingCount: sql`count(*)::int` })
                .from(follows)
                .where(eq(follows.followerId, actorUserId)),
        ]);

    return { targetFollowersCount, actorFollowingCount };
};

export const getProfile = async (req, res) => {
    try {
        const { username } = req.params;
        const currentUserId = req.user.id;

        const [user] = await db
            .select({
                id: users.id,
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
        console.error('Error in getProfile controller', error);
        return res.status(500).json({
            message: 'Internal server error',
        });
    }
};

export const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { username, bio } = req.body;
        const avatarUrl =
            req.files?.avatar?.[0]?.path || req.files?.profileImage?.[0]?.path;
        const bannerUrl =
            req.files?.banner?.[0]?.path ||
            req.files?.bannerImage?.[0]?.path ||
            req.files?.cover?.[0]?.path;

        // cek jika tidak ada field yang diupdate sama sekali
        if (!username && bio === undefined && !avatarUrl && !bannerUrl) {
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
        if (username) updateData.username = username;
        if (bio !== undefined) updateData.bio = bio;
        if (avatarUrl) updateData.avatarUrl = avatarUrl;
        if (bannerUrl) updateData.bannerUrl = bannerUrl;

        const [updatedUser] = await db
            .update(users)
            .set(updateData)
            .where(eq(users.id, userId))
            .returning();

        const { password, ...safeUser } = updatedUser;

        return res.status(200).json({
            message: 'Profile updated successfully',
            user: safeUser,
        });
    } catch (error) {
        console.error('Error in updateProfile controller', error);
        return res.status(500).json({
            message: 'Internal server error',
        });
    }
};

export const followUser = async (req, res) => {
    try {
        const { username } = req.params;
        const currentUserId = req.user.id;

        const [targetUser] = await db
            .select({
                id: users.id,
                username: users.username,
                avatarUrl: users.avatarUrl,
            })
            .from(users)
            .where(eq(users.username, username));

        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (targetUser.id === currentUserId) {
            return res.status(400).json({
                message: 'You cannot follow yourself',
            });
        }

        const [existingFollow] = await db
            .select({ id: follows.id })
            .from(follows)
            .where(
                and(
                    eq(follows.followerId, currentUserId),
                    eq(follows.followingId, targetUser.id)
                )
            );

        if (existingFollow) {
            const followStats = await getFollowStats({
                targetUserId: targetUser.id,
                actorUserId: currentUserId,
            });

            return res.status(200).json({
                message: 'Already following user',
                following: true,
                ...followStats,
            });
        }

        const [follow] = await db
            .insert(follows)
            .values({
                followerId: currentUserId,
                followingId: targetUser.id,
            })
            .returning();

        const [actor] = await db
            .select({ username: users.username })
            .from(users)
            .where(eq(users.id, currentUserId));

        await createNotificationAndPush({
            toUserId: targetUser.id,
            fromUserId: currentUserId,
            type: 'follow',
            message: `${actor?.username || 'Someone'} started following you`,
        });

        const followStats = await getFollowStats({
            targetUserId: targetUser.id,
            actorUserId: currentUserId,
        });

        return res.status(201).json({
            message: 'User followed',
            following: true,
            follow,
            ...followStats,
        });
    } catch (error) {
        console.error('Follow user error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const unfollowUser = async (req, res) => {
    try {
        const { username } = req.params;
        const currentUserId = req.user.id;

        const [targetUser] = await db
            .select({
                id: users.id,
                username: users.username,
            })
            .from(users)
            .where(eq(users.username, username));

        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (targetUser.id === currentUserId) {
            return res.status(400).json({
                message: 'You cannot unfollow yourself',
            });
        }

        const [existingFollow] = await db
            .select({ id: follows.id })
            .from(follows)
            .where(
                and(
                    eq(follows.followerId, currentUserId),
                    eq(follows.followingId, targetUser.id)
                )
            );

        if (existingFollow) {
            await db.delete(follows).where(eq(follows.id, existingFollow.id));
        }

        const [actor] = await db
            .select({ username: users.username })
            .from(users)
            .where(eq(users.id, currentUserId));

        const followStats = await getFollowStats({
            targetUserId: targetUser.id,
            actorUserId: currentUserId,
        });

        return res.status(200).json({
            message: existingFollow
                ? 'User unfollowed'
                : 'User is not followed',
            following: false,
            ...followStats,
        });
    } catch (error) {
        console.error('Unfollow user error:', error);
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

        res.clearCookie('token');

        return res.status(200).json({
            message: 'Account deleted successfully',
        });
    } catch (error) {
        console.error('Error in deleteAccount controller', error);
        return res.status(500).json({
            message: 'Internal server error',
        });
    }
};

export const getUserBites = async (req, res) => {
    try {
        const { username } = req.params;
        const currentUserId = req.user.id;

        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 12, 50);
        const offset = (page - 1) * limit;

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
            .select({
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
                isTrending: sql`${getBiteViralScoreSql()} >= ${VIRAL_SCORE_THRESHOLD}`,
                viralScore: getBiteViralScoreSql(),
                createdAt: bites.createdAt,

                user: {
                    id: users.id,
                    username: users.username,
                    avatarUrl: users.avatarUrl,
                },

                likesCount: sql`count(distinct ${likes.id})::int`,
                commentsCount: sql`count(distinct ${comments.id})::int`,
                isLiked: sql`coalesce(bool_or(${likes.userId} = ${currentUserId}), false)`,
                isSaved: sql`coalesce(bool_or(${saved.userId} = ${currentUserId}), false)`,
            })
            .from(bites)
            .leftJoin(users, eq(bites.userId, users.id))
            .leftJoin(likes, eq(likes.biteId, bites.id))
            .leftJoin(comments, eq(comments.biteId, bites.id))
            .leftJoin(saved, eq(saved.biteId, bites.id))
            .where(eq(bites.userId, user.id))
            .groupBy(bites.id, users.id)
            .orderBy(desc(bites.createdAt))
            .limit(limit)
            .offset(offset);

        return res.status(200).json({
            message: 'success',
            data: userBites,
            pagination: {
                page,
                limit,
                hasMore: userBites.length === limit,
            },
        });
    } catch (error) {
        console.error('Error in getUserBites controller', error);
        return res.status(500).json({
            message: 'Internal server error',
        });
    }
};

export const getSavedBites = async (req, res) => {
    try {
        const currentUserId = req.user.id;

        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 12, 50);
        const offset = (page - 1) * limit;

        const savedBites = await db
            .select({
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
                isTrending: sql`${getBiteViralScoreSql()} >= ${VIRAL_SCORE_THRESHOLD}`,
                viralScore: getBiteViralScoreSql(),
                createdAt: bites.createdAt,
                savedAt: saved.createdAt,

                user: {
                    id: users.id,
                    username: users.username,
                    avatarUrl: users.avatarUrl,
                },

                likesCount: sql`count(distinct ${likes.id})::int`,
                commentsCount: sql`count(distinct ${comments.id})::int`,
                isLiked: sql`coalesce(bool_or(${likes.userId} = ${currentUserId}), false)`,
                isSaved: sql`true`,
            })
            .from(saved)
            .innerJoin(bites, eq(saved.biteId, bites.id))
            .leftJoin(users, eq(bites.userId, users.id))
            .leftJoin(likes, eq(likes.biteId, bites.id))
            .leftJoin(comments, eq(comments.biteId, bites.id))
            .where(eq(saved.userId, currentUserId))
            .groupBy(bites.id, users.id, saved.id)
            .orderBy(desc(saved.createdAt))
            .limit(limit)
            .offset(offset);

        return res.status(200).json({
            message: 'success',
            data: savedBites,
            pagination: {
                page,
                limit,
                hasMore: savedBites.length === limit,
            },
        });
    } catch (error) {
        console.error('Error in getSavedBites controller', error);
        return res.status(500).json({
            message: 'Internal server error',
        });
    }
};

export const getLikedBites = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const userLikes = alias(likes, 'user_likes');

        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 12, 50);
        const offset = (page - 1) * limit;

        const likedBites = await db
            .select({
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
                isTrending: sql`${getBiteViralScoreSql()} >= ${VIRAL_SCORE_THRESHOLD}`,
                viralScore: getBiteViralScoreSql(),
                createdAt: bites.createdAt,
                likedAt: userLikes.createdAt,

                user: {
                    id: users.id,
                    username: users.username,
                    avatarUrl: users.avatarUrl,
                },

                likesCount: sql`count(distinct ${likes.id})::int`,
                commentsCount: sql`count(distinct ${comments.id})::int`,
                isLiked: sql`true`,
                isSaved: sql`coalesce(bool_or(${saved.userId} = ${currentUserId}), false)`,
            })
            .from(userLikes)
            .innerJoin(bites, eq(userLikes.biteId, bites.id))
            .leftJoin(users, eq(bites.userId, users.id))
            .leftJoin(likes, eq(likes.biteId, bites.id))
            .leftJoin(comments, eq(comments.biteId, bites.id))
            .leftJoin(saved, eq(saved.biteId, bites.id))
            .where(eq(userLikes.userId, currentUserId))
            .groupBy(bites.id, users.id, userLikes.id)
            .orderBy(desc(userLikes.createdAt))
            .limit(limit)
            .offset(offset);

        return res.status(200).json({
            message: 'success',
            data: likedBites,
            pagination: {
                page,
                limit,
                hasMore: likedBites.length === limit,
            },
        });
    } catch (error) {
        console.error('Error in getLikedBites controller', error);
        return res.status(500).json({
            message: 'Internal server error',
        });
    }
};
