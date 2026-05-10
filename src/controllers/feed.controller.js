import { db } from '../db/index.js';
import { bites } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

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

        console.log(req.file);

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
