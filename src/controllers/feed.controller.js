import { db } from '../db/index.js';
import {
    BITE_CATEGORIES,
    bites,
    users,
    likes,
    comments,
    saved,
} from '../db/schema.js';
import { alias } from 'drizzle-orm/pg-core';
import { desc, eq, sql, and, ilike, or } from 'drizzle-orm';
import {
    calculateViralScore,
    isTrendingScore,
    getViralScoreSqlExpr,
    getTrendingStatusSqlExpr,
} from '../utils/viral.js';
import { createNotificationAndPush } from '../utils/notification.js';
import { deleteStorageObject } from '../utils/storage.js';
import { createMentionsFromText } from '../utils/mention.js';

const viewerLikes = alias(likes, 'viewer_likes');
const viewerSaved = alias(saved, 'viewer_saved');

const safeCreateMentionsFromText = async (options) => {
    try {
        return await createMentionsFromText(options);
    } catch (error) {
        console.error('Create mentions error:', error);
        return [];
    }
};

const getBiteEngagement = async (biteId) => {
    // Atomically recompute isTrending based on current counters and return latest counts
    // This avoids read-modify-write races by performing the update on the DB side.
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

    if (!updated) {
        return null;
    }

    const { viewsCount, likesCount, commentsCount } = updated;
    const viralScore = calculateViralScore({ viewsCount, likesCount, commentsCount });
    const isTrending = isTrendingScore(viralScore);

    return { viewsCount, likesCount, commentsCount, viralScore, isTrending };
};

const getViewerFlags = () => ({
    isLiked: viewerLikes.id,
    isSaved: viewerSaved.id,
});

const getBiteSelect = (userId, extraFields = {}) => ({
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

const categoryLabels = {
    street_food: 'Street Food',
    cafe: 'Cafe',
    fine_dining: 'Fine Dining',
    dessert: 'Dessert',
    viral: 'Viral',
    hidden_gems: 'Hidden Gems',
};

const getBiteList = async (req, res, options = {}) => {
    const userId = req.user?.id;

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const offset = (page - 1) * limit;
    const sort = options.sort || req.query.sort;
    const category = options.category || req.query.category;
    const search = options.search ?? req.query.search ?? req.query.q;
    const trendingOnly =
        options.trendingOnly || req.query.trending === 'true';

    if (category && !BITE_CATEGORIES.includes(category)) {
        return res.status(400).json({
            message: 'Invalid category',
            categories: BITE_CATEGORIES,
        });
    }

    const filters = [];

    if (category) {
        filters.push(eq(bites.category, category));
    }

    if (trendingOnly) {
        filters.push(getTrendingStatusSql());
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

    let query = db
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

    if (filters.length > 0) {
        query = query.where(and(...filters));
    }

    const feeds = await (
        sort === 'viral' || sort === 'trending' || trendingOnly
            ? query.orderBy(desc(getBiteViralScoreSql()), desc(bites.createdAt))
            : query.orderBy(desc(bites.createdAt))
    )
        .limit(limit)
        .offset(offset);

    return res.status(200).json({
        message: 'success',
        data: feeds.map(normalizeBiteViewerFlags),
        pagination: {
            page,
            limit,
            hasMore: feeds.length === limit,
        },
    });
};

export const getBiteCategories = async (req, res) => {
    return res.status(200).json({
        message: 'success',
        data: BITE_CATEGORIES.map((value) => ({
            value,
            label: categoryLabels[value],
        })),
    });
};

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
            })
            .returning();

        const [actor] = await db
            .select({
                username: users.username,
            })
            .from(users)
            .where(eq(users.id, userId));

        const mentionedUsers = await safeCreateMentionsFromText({
            text: review,
            sourceType: 'bite',
            sourceId: newBite.id,
            biteId: newBite.id,
            mentionedByUserId: userId,
            actorUsername: actor?.username,
        });

        return res.status(201).json({
            message: 'Bite created successfully',
            bite: {
                ...newBite,
                mentions: mentionedUsers,
            },
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
        return getBiteList(req, res);
    } catch (err) {
        console.error(err);
        res.status(500).json({
            message: 'internal server error',
        });
    }
};

export const getTrendingBites = async (req, res) => {
    try {
        return getBiteList(req, res, {
            sort: 'trending',
            trendingOnly: true,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            message: 'internal server error',
        });
    }
};

export const getBitesByCategory = async (req, res) => {
    try {
        return getBiteList(req, res, {
            category: req.params.category,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            message: 'internal server error',
        });
    }
};

export const searchBites = async (req, res) => {
    try {
        const search = req.query.q || req.query.search;

        if (!search?.trim()) {
            return res.status(400).json({
                message: 'Search query is required',
            });
        }

        return getBiteList(req, res, {
            search,
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
        const [bite] = await db
            .select(getBiteSelect(userId))
            .from(bites)
            .leftJoin(users, eq(bites.userId, users.id))
            .leftJoin(
                viewerLikes,
                and(
                    eq(viewerLikes.biteId, bites.id),
                    eq(viewerLikes.userId, userId)
                )
            )
            .leftJoin(
                viewerSaved,
                and(
                    eq(viewerSaved.biteId, bites.id),
                    eq(viewerSaved.userId, userId)
                )
            )
            .where(eq(bites.id, id));

        if (!bite) {
            return res.status(404).json({ message: 'Bite not found' });
        }

        return res.status(200).json({
            message: 'success',
            bite: normalizeBiteViewerFlags(bite),
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
            .where(eq(bites.id, id));

        if (!bite) {
            return res.status(404).json({ message: 'Bite not found' });
        }

        const [deletedLike] = await db
            .delete(likes)
            .where(and(eq(likes.userId, userId), eq(likes.biteId, id)))
            .returning({ id: likes.id });

        if (deletedLike) {
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
            .onConflictDoNothing({
                target: [likes.userId, likes.biteId],
            })
            .returning();

        if (!like) {
            const engagement = await getBiteEngagement(id);

            return res.status(200).json({
                message: 'Bite already liked',
                liked: true,
                ...engagement,
            });
        }

        // push FCM dan fetch engagement berjalan paralel
        // agar respons tidak menunggu network call Firebase
        const [, engagement] = await Promise.all([
            createNotificationAndPush({
                toUserId: bite.userId,
                fromUserId: userId,
                type: 'like',
                biteId: id,
                message: `${bite.actorUsername || 'Someone'} liked your ${bite.foodName} post`,
            }),
            getBiteEngagement(id),
        ]);

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

        const [deletedSavedBite] = await db
            .delete(saved)
            .where(and(eq(saved.userId, userId), eq(saved.biteId, id)))
            .returning({ id: saved.id });

        if (deletedSavedBite) {
            return res.status(200).json({
                message: 'Bite unsaved',
                saved: false,
            });
        }

        const [savedBite] = await db
            .insert(saved)
            .values({ userId, biteId: id })
            .onConflictDoNothing({
                target: [saved.userId, saved.biteId],
            })
            .returning();

        if (!savedBite) {
            return res.status(200).json({
                message: 'Bite already saved',
                saved: true,
            });
        }

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

        // push FCM, engagement, dan mentions berjalan paralel
        const [, engagement, mentionedUsers] = await Promise.all([
            createNotificationAndPush({
                toUserId: bite.userId,
                fromUserId: userId,
                type: 'comment',
                biteId: id,
                message: `${actor?.username || 'Someone'} commented on your ${bite.foodName} post`,
            }),
            getBiteEngagement(id),
            safeCreateMentionsFromText({
                text: content,
                sourceType: 'comment',
                sourceId: comment.id,
                biteId: id,
                mentionedByUserId: userId,
                actorUsername: actor?.username,
                biteFoodName: bite.foodName,
                excludedUserIds: [bite.userId],
            }),
        ]);

        return res.status(201).json({
            message: 'Comment created',
            comment: {
                ...comment,
                user: actor,
                mentions: mentionedUsers,
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

        let mentionedUsers = [];

        if (review !== undefined) {
            const [actor] = await db
                .select({
                    username: users.username,
                })
                .from(users)
                .where(eq(users.id, userId));

            mentionedUsers = await safeCreateMentionsFromText({
                text: review,
                sourceType: 'bite',
                sourceId: updatedBite.id,
                biteId: updatedBite.id,
                mentionedByUserId: userId,
                actorUsername: actor?.username,
            });
        }

        return res.status(200).json({
            message: 'Bite updated successfully',
            bite: {
                ...updatedBite,
                mentions: mentionedUsers,
            },
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
