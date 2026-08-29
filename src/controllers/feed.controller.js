import { db } from '../db/index.js';
import { BITE_CATEGORIES, bites } from '../db/schema.js';
import { sql } from 'drizzle-orm';
import {
    findBiteById,
    getTrendingKeywords as fetchTrendingKeywords,
    listBites,
    recordView,
} from '../services/feedQuery.service.js';
import {
    createBite as createBiteService,
    deleteBite as deleteBiteService,
    updateBite as updateBiteService,
} from '../services/biteMutation.service.js';
import {
    toggleLike,
    toggleSave,
} from '../services/engagement.service.js';
import {
    addComment,
    listComments,
    editComment,
    deleteComment,
} from '../services/comment.service.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const categoryLabels = {
    street_food: 'Street Food',
    cafe: 'Cafe',
    fine_dining: 'Fine Dining',
    dessert: 'Dessert',
    viral: 'Viral',
    hidden_gems: 'Hidden Gems',
};

/**
 * Handler generik: delegasi ke service, terjemahkan AppError ke response HTTP.
 */
const handle = async (res, serviceFn) => {
    try {
        const result = await serviceFn();

        return res.status(result.status || 200).json(result.body);
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({ message: error.message });
        }

        logger.error(error.message, error);
        return res.status(500).json({ message: 'Server error' });
    }
};

export const getBite = async (req, res) =>
    handle(res, async () => {
        const result = await listBites(req.user, {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 10,
            sort: req.query.sort,
            category: req.query.category,
            search: req.query.search ?? req.query.q,
            scope: req.query.scope,
        });

        return {
            body: { message: 'success', ...result },
        };
    });

export const getTrendingBites = async (req, res) =>
    handle(res, async () => {
        const result = await listBites(req.user, {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 10,
            sort: 'trending',
            trendingOnly: true,
        });

        return {
            body: { message: 'success', ...result },
        };
    });

export const getBitesByCategory = async (req, res) =>
    handle(res, async () => {
        const result = await listBites(req.user, {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 10,
            category: req.params.category,
        });

        return {
            body: { message: 'success', ...result },
        };
    });

export const searchBites = async (req, res) =>
    handle(res, async () => {
        const search = req.query.q || req.query.search;

        if (!search?.trim()) {
            throw new AppError('Search query is required', 400);
        }

        const result = await listBites(req.user, {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 10,
            search,
        });

        return {
            body: { message: 'success', ...result },
        };
    });

export const getBiteCategories = async (req, res) =>
    handle(res, async () => {
        const counts = await db
            .select({
                category: bites.category,
                count: sql`count(*)`,
            })
            .from(bites)
            .groupBy(bites.category);

        const countMap = Object.fromEntries(
            counts.map((c) => [c.category, Number(c.count)])
        );

        return {
            status: 200,
            body: {
                message: 'success',
                data: BITE_CATEGORIES.map((value) => ({
                    value,
                    label: categoryLabels[value],
                    count: countMap[value] || 0,
                })),
            },
        };
    });

// Publik: dipakai widget trending & dropdown search
export const getTrendingKeywords = async (req, res) =>
    handle(res, async () => {
        const keywords = await fetchTrendingKeywords(req.query.q);

        return {
            status: 200,
            body: { message: 'success', data: keywords },
        };
    });

export const getBiteById = async (req, res) =>
    handle(res, async () => ({
        status: 200,
        body: {
            message: 'success',
            bite: await findBiteById(req.params.id, req.user.id),
        },
    }));

export const recordBiteView = async (req, res) =>
    handle(res, async () => {
        const engagement = await recordView(req.params.id);

        return {
            status: 200,
            body: { message: 'Bite view recorded', ...engagement },
        };
    });

export const createBite = async (req, res) =>
    handle(res, async () => {
        const uploadedPhoto = req.files?.photo?.[0] || req.files?.image?.[0];

        if (!uploadedPhoto) {
            throw new AppError('Photo is required', 400);
        }

        const { bite, mentions } = await createBiteService({
            userId: req.user.id,
            body: req.body,
            photoPath: uploadedPhoto.path,
        });

        return {
            status: 201,
            body: {
                message: 'Bite created successfully',
                bite: { ...bite, mentions },
            },
        };
    });

export const updateBite = async (req, res) =>
    handle(res, async () => {
        const { bite, mentions } = await updateBiteService({
            userId: req.user.id,
            biteId: req.params.id,
            body: req.body,
        });

        return {
            status: 200,
            body: {
                message: 'Bite updated successfully',
                bite: { ...bite, mentions },
            },
        };
    });

export const deleteBite = async (req, res) =>
    handle(res, async () => {
        await deleteBiteService({ userId: req.user.id, biteId: req.params.id });

        return {
            status: 200,
            body: { message: 'Bite deleted successfully' },
        };
    });

export const toggleLikeBite = async (req, res) =>
    handle(res, async () => {
        const result = await toggleLike({
            userId: req.user.id,
            biteId: req.params.id,
        });

        if (!result) {
            throw new AppError('Bite not found', 404);
        }

        const { status, liked, ...rest } = result;

        return {
            status,
            body: {
                message: liked ? 'Bite liked' : 'Bite unliked',
                liked,
                ...rest,
            },
        };
    });

export const toggleSaveBite = async (req, res) =>
    handle(res, async () => {
        const result = await toggleSave({
            userId: req.user.id,
            biteId: req.params.id,
        });

        const { status, saved, savedBite } = result;

        return {
            status,
            body: {
                message: saved ? 'Bite saved' : 'Bite unsaved',
                saved,
                ...(savedBite ? { savedBite } : {}),
            },
        };
    });

export const createComment = async (req, res) =>
    handle(res, async () => {
        const result = await addComment({
            userId: req.user.id,
            biteId: req.params.id,
            content: req.body.content,
        });

        return {
            status: 201,
            body: { message: 'Comment created', ...result },
        };
    });

export const getBiteComments = async (req, res) =>
    handle(res, async () => {
        const result = await listComments(req.params.id, {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 20,
            sort: req.query.sort || 'desc',
        });

        return {
            status: 200,
            body: { message: 'success', ...result },
        };
    });

export const updateComment = async (req, res) =>
    handle(res, async () => {
        const result = await editComment({
            userId: req.user.id,
            biteId: req.params.id,
            commentId: req.params.commentId,
            content: req.body.content,
        });

        return {
            status: 200,
            body: { message: 'Comment updated', ...result },
        };
    });

export const removeComment = async (req, res) =>
    handle(res, async () => {
        const result = await deleteComment({
            userId: req.user.id,
            biteId: req.params.id,
            commentId: req.params.commentId,
        });

        return {
            status: 200,
            body: { message: 'Comment deleted', ...result },
        };
    });
