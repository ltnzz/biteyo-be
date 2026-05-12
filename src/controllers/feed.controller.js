import { db } from '../db/index.js';
import { bites, users, likes, comments, saved } from '../db/schema.js';
import { desc, eq, sql, and } from 'drizzle-orm';
import { getIO } from '../config/socket.js';

export const createBite = async (req, res) => {
    try {
        if (!req.file) {
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

        const photoUrl = req.file.path;

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

        // ambil info user untuk di-emit ke semua client
        const [userInfo] = await db
            .select({
                id: users.id,
                username: users.username,
                avatarUrl: users.avatarUrl,
            })
            .from(users)
            .where(eq(users.id, userId));

        // broadcast bite baru ke semua client yang terkoneksi
        getIO().emit('new_bite', {
            ...newBite,
            user: userInfo,
            likesCount: 0,
            commentsCount: 0,
            isLiked: false,
            isSaved: false,
        });

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

        const feeds = await db
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

                // total likes & comments sebagai number (bukan string)
                likesCount: sql`count(distinct ${likes.id})::int`,
                commentsCount: sql`count(distinct ${comments.id})::int`,

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
            .groupBy(bites.id, users.id)
            .orderBy(desc(bites.createdAt))
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

        // broadcast perubahan bite ke semua client
        getIO().emit('update_bite', {
            id: updatedBite.id,
            foodName: updatedBite.foodName,
            review: updatedBite.review,
            rating: updatedBite.rating,
            category: updatedBite.category,
            updatedAt: updatedBite.updatedAt,
        });

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

        await db.delete(bites).where(eq(bites.id, id));

        // broadcast penghapusan bite ke semua client
        getIO().emit('delete_bite', { id });

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
