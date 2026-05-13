import { eq, ne, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, bites, follows, likes, comments, saved } from '../db/schema.js';
import { createNotificationAndPush } from '../utils/notification.js';

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
        const avatarUrl = req.file?.path;

        // cek jika tidak ada field yang diupdate sama sekali
        if (!username && bio === undefined && !avatarUrl) {
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

export const toggleFollowUser = async (req, res) => {
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
            await db.delete(follows).where(eq(follows.id, existingFollow.id));

            return res.status(200).json({
                message: 'User unfollowed',
                following: false,
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

        return res.status(201).json({
            message: 'User followed',
            following: true,
            follow,
        });
    } catch (error) {
        console.error('Toggle follow error:', error);
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
                isTrending: bites.isTrending,
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
                isTrending: bites.isTrending,
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
