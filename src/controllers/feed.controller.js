import { db } from '../db/index.js';
import { bites, users, likes, comments, saved } from '../db/schema.js';
import { desc, eq, sql, and } from 'drizzle-orm';
import { createNotificationAndPush } from '../utils/notification.js';
import { deleteStorageObject } from '../utils/storage.js';

const VIRAL_SCORE_THRESHOLD = 20;

const getViralScoreSql = (viewsCount, likesCount, commentsCount) =>
    sql`(${viewsCount} * 1 + ${likesCount} * 3 + ${commentsCount} * 5)::int`;

const getBiteEngagement = async (biteId) => {
    const [[{ viewsCount }], [{ likesCount }], [{ commentsCount }]] =
        await Promise.all([
            db
                .select({ viewsCount: bites.viewsCount })
                .from(bites)
                .where(eq(bites.id, biteId)),
            db
                .select({ likesCount: sql`count(*)::int` })
                .from(likes)
                .where(eq(likes.biteId, biteId)),
            db
                .select({ commentsCount: sql`count(*)::int` })
                .from(comments)
                .where(eq(comments.biteId, biteId)),
        ]);

    const viralScore =
        Number(viewsCount || 0) +
        Number(likesCount || 0) * 3 +
        Number(commentsCount || 0) * 5;
    const isTrending = viralScore >= VIRAL_SCORE_THRESHOLD;

    await db
        .update(bites)
        .set({
            isTrending,
            updatedAt: new Date(),
        })
        .where(eq(bites.id, biteId));

    return { viewsCount, likesCount, commentsCount, viralScore, isTrending };
};

export const recordBiteView = async (req, res) => {
    try {
        const { id } = req.params;

        const [viewedBite] = await db
            .update(bites)
            .set({
                viewsCount: sql`${bites.viewsCount} + 1`,
                updatedAt: new Date(),
            })
            .where(eq(bites.id, id))
            .returning({
                id: bites.id,
                viewsCount: bites.viewsCount,
            });

        if (!viewedBite) {
            return res.status(404).json({ message: 'Bite not found' });
        }

        const engagement = await getBiteEngagement(id);

        return res.status(200).json({
            message: 'Bite view recorded',
            ...engagement,
        });
    } catch (error) {
        console.error('Record bite view error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

const getBiteCountsSql = () => ({
    likesCount: sql`count(distinct ${likes.id})::int`,
    commentsCount: sql`count(distinct ${comments.id})::int`,
});

const getBiteViralScoreSql = () =>
    getViralScoreSql(
        bites.viewsCount,
        sql`count(distinct ${likes.id})`,
        sql`count(distinct ${comments.id})`
    );

const getTrendingStatusSql = () =>
    sql`${getBiteViralScoreSql()} >= ${VIRAL_SCORE_THRESHOLD}`;

export const createBite = async (req, res) => {
    try {
        const uploadedPhoto = req.files?.photo?.[0] || req.files?.image?.[0];

        if (!uploadedPhoto) {
            return res.status(400).json({
                message: 'Photo is required',
            });
        }

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
            isTrending,
        } = req.body;

        const userId = req.user.id;

        const photoUrl = uploadedPhoto.path;

        const [newBite] = await db
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
                photoUrl,
                category,
                isTrending: false,
            })
            .returning();

        return res.status(201).json({
            message: 'Bite created successfully',
            bite: newBite,
        });
    } catch (error) {
        console.error('Create bite error:', error);
        return res.status(500).json({
            message: 'Server error',
        });
    }
};

export const getBite = async (req, res) => {
    try {
        const userId = req.user?.id;

        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const offset = (page - 1) * limit;
        const sort = req.query.sort;
        const counts = getBiteCountsSql();

        const query = db
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
                isTrending: getTrendingStatusSql(),
                viralScore: getBiteViralScoreSql(),
                createdAt: bites.createdAt,

                user: {
                    id: users.id,
                    username: users.username,
                    avatarUrl: users.avatarUrl,
                },

                // total likes & comments sebagai number (bukan string)
                likesCount: counts.likesCount,
                commentsCount: counts.commentsCount,

                // apakah current user sudah like bite ini
                isLiked: sql`coalesce(bool_or(${likes.userId} = ${userId}), false)`,

                // apakah current user sudah save bite ini
                isSaved: sql`coalesce(bool_or(${saved.userId} = ${userId}), false)`,
            })
            .from(bites)
            .leftJoin(users, eq(bites.userId, users.id))
            .leftJoin(likes, eq(likes.biteId, bites.id))
            .leftJoin(comments, eq(comments.biteId, bites.id))
            .leftJoin(saved, eq(saved.biteId, bites.id))
            .groupBy(bites.id, users.id);

        const feeds = await (
            sort === 'viral' || sort === 'trending'
                ? query.orderBy(
                      desc(getBiteViralScoreSql()),
                      desc(bites.createdAt)
                  )
                : query.orderBy(desc(bites.createdAt))
        )
            .limit(limit)
            .offset(offset);

        res.status(200).json({
            message: 'success',
            data: feeds,
            pagination: {
                page,
                limit,
                hasMore: feeds.length === limit,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            message: 'internal server error',
        });
    }
};

export const getBiteById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const counts = getBiteCountsSql();

        const [bite] = await db
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
                isTrending: getTrendingStatusSql(),
                viralScore: getBiteViralScoreSql(),
                createdAt: bites.createdAt,

                user: {
                    id: users.id,
                    username: users.username,
                    avatarUrl: users.avatarUrl,
                },

                likesCount: counts.likesCount,
                commentsCount: counts.commentsCount,
                isLiked: sql`coalesce(bool_or(${likes.userId} = ${userId}), false)`,
                isSaved: sql`coalesce(bool_or(${saved.userId} = ${userId}), false)`,
            })
            .from(bites)
            .leftJoin(users, eq(bites.userId, users.id))
            .leftJoin(likes, eq(likes.biteId, bites.id))
            .leftJoin(comments, eq(comments.biteId, bites.id))
            .leftJoin(saved, eq(saved.biteId, bites.id))
            .where(eq(bites.id, id))
            .groupBy(bites.id, users.id);

        if (!bite) {
            return res.status(404).json({ message: 'Bite not found' });
        }

        return res.status(200).json({
            message: 'success',
            bite,
        });
    } catch (error) {
        console.error('Get bite by id error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

export const toggleLikeBite = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const [bite] = await db
            .select({
                id: bites.id,
                userId: bites.userId,
                foodName: bites.foodName,
            })
            .from(bites)
            .where(eq(bites.id, id));

        if (!bite) {
            return res.status(404).json({ message: 'Bite not found' });
        }

        const [existingLike] = await db
            .select({ id: likes.id })
            .from(likes)
            .where(and(eq(likes.userId, userId), eq(likes.biteId, id)));

        if (existingLike) {
            await db.delete(likes).where(eq(likes.id, existingLike.id));
            const engagement = await getBiteEngagement(id);

            return res.status(200).json({
                message: 'Bite unliked',
                liked: false,
                ...engagement,
            });
        }

        const [like] = await db
            .insert(likes)
            .values({ userId, biteId: id })
            .returning();

        const [actor] = await db
            .select({ username: users.username })
            .from(users)
            .where(eq(users.id, userId));

        await createNotificationAndPush({
            toUserId: bite.userId,
            fromUserId: userId,
            type: 'like',
            biteId: id,
            message: `${actor?.username || 'Someone'} liked your ${bite.foodName} post`,
        });

        const engagement = await getBiteEngagement(id);

        return res.status(201).json({
            message: 'Bite liked',
            liked: true,
            like,
            ...engagement,
        });
    } catch (error) {
        console.error('Toggle like error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

export const toggleSaveBite = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const [bite] = await db
            .select({ id: bites.id })
            .from(bites)
            .where(eq(bites.id, id));

        if (!bite) {
            return res.status(404).json({ message: 'Bite not found' });
        }

        const [existingSavedBite] = await db
            .select({ id: saved.id })
            .from(saved)
            .where(and(eq(saved.userId, userId), eq(saved.biteId, id)));

        if (existingSavedBite) {
            await db.delete(saved).where(eq(saved.id, existingSavedBite.id));

            return res.status(200).json({
                message: 'Bite unsaved',
                saved: false,
            });
        }

        const [savedBite] = await db
            .insert(saved)
            .values({ userId, biteId: id })
            .returning();

        return res.status(201).json({
            message: 'Bite saved',
            saved: true,
            savedBite,
        });
    } catch (error) {
        console.error('Toggle save error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

export const createComment = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { content } = req.body;

        if (!content || typeof content !== 'string' || !content.trim()) {
            return res.status(400).json({ message: 'Comment is required' });
        }

        const [bite] = await db
            .select({
                id: bites.id,
                userId: bites.userId,
                foodName: bites.foodName,
            })
            .from(bites)
            .where(eq(bites.id, id));

        if (!bite) {
            return res.status(404).json({ message: 'Bite not found' });
        }

        const [comment] = await db
            .insert(comments)
            .values({
                userId,
                biteId: id,
                content: content.trim(),
            })
            .returning();

        const [actor] = await db
            .select({
                id: users.id,
                username: users.username,
                avatarUrl: users.avatarUrl,
            })
            .from(users)
            .where(eq(users.id, userId));

        await createNotificationAndPush({
            toUserId: bite.userId,
            fromUserId: userId,
            type: 'comment',
            biteId: id,
            message: `${actor?.username || 'Someone'} commented on your ${bite.foodName} post`,
        });

        const engagement = await getBiteEngagement(id);

        return res.status(201).json({
            message: 'Comment created',
            comment: {
                ...comment,
                user: actor,
            },
            ...engagement,
        });
    } catch (error) {
        console.error('Create comment error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

export const getBiteComments = async (req, res) => {
    try {
        const { id } = req.params;

        const [bite] = await db
            .select({
                id: bites.id,
                foodName: bites.foodName,
            })
            .from(bites)
            .where(eq(bites.id, id));

        if (!bite) {
            return res.status(404).json({ message: 'Bite not found' });
        }

        const biteComments = await db
            .select({
                id: comments.id,
                content: comments.content,
                createdAt: comments.createdAt,
                user: {
                    id: users.id,
                    username: users.username,
                    avatarUrl: users.avatarUrl,
                },
            })
            .from(comments)
            .leftJoin(users, eq(comments.userId, users.id))
            .where(eq(comments.biteId, id))
            .orderBy(desc(comments.createdAt));

        return res.status(200).json({
            message: 'success',
            bite,
            comments: biteComments,
            commentsCount: biteComments.length,
        });
    } catch (error) {
        console.error('Get comments error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

// export const getBiteById = async (req, res) => {
//     try {
//         const feeds = await db
//             .select({
//                 id: bites.id,
//                 content: bites.content,
//                 image: bites.image,
//                 createdAt: bites.createdAt,

//                 user: {
//                     id: users.id,
//                     name: users.name,
//                     email: users.email,
//                 },
//             })
//             .from(bites)
//             .leftJoin(users, eq(bites.userId, users.id))
//             .orderBy(desc(bites.createdAt));

//         res.status(200).json({
//             message: 'success',
//             data: feeds,
//         });
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({
//             message: 'internal server error',
//         });
//     }
// };

export const updateBite = async (req, res) => {
    try {
        const { id } = req.params;

        const userId = req.user.id;

        const { foodName, review, rating, category } = req.body;

        const existingBite = await db
            .select()
            .from(bites)
            .where(and(eq(bites.id, id), eq(bites.userId, userId)));

        if (existingBite.length === 0) {
            return res.status(404).json({
                message: 'Bite not found',
            });
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
            .where(eq(bites.id, id))
            .returning();

        return res.status(200).json({
            message: 'Bite updated successfully',
            bite: updatedBite,
        });
    } catch (error) {
        console.error('Update bite error:', error);

        return res.status(500).json({
            message: 'Server error',
        });
    }
};

export const deleteBite = async (req, res) => {
    try {
        const { id } = req.params;

        const userId = req.user.id;

        const existingBite = await db
            .select()
            .from(bites)
            .where(and(eq(bites.id, id), eq(bites.userId, userId)));

        if (existingBite.length === 0) {
            return res.status(404).json({
                message: 'Bite not found',
            });
        }

        const [bite] = existingBite;
        await deleteStorageObject(bite.photoUrl);

        await db.delete(bites).where(eq(bites.id, id));

        return res.status(200).json({
            message: 'Bite deleted successfully',
        });
    } catch (error) {
        console.error('Delete bite error:', error);

        return res.status(500).json({
            message: 'Server error',
        });
    }
};
