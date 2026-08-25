import express from 'express';
import {
    createBite,
    getBite,
    getBiteById,
    updateBite,
    deleteBite,
    getBiteCategories,
    getBitesByCategory,
    getTrendingBites,
    searchBites,
    toggleLikeBite,
    toggleSaveBite,
    createComment,
    getBiteComments,
    recordBiteView,
} from '../controllers/feed.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
    createBiteSchema,
    updateBiteSchema,
} from '../middlewares/validations/feed.validation.js';
import { sharePreview } from '../controllers/share.controller.js';
import { getTrendingKeywords } from '../controllers/feed.controller.js';

const router = express.Router();

// Publik: dipakai crawler (WA/X) untuk membaca meta OG saat link dibagikan
router.get('/share/:id', sharePreview);
// Publik: widget trending & saran keyword di search
router.get('/trending-keywords', getTrendingKeywords);

router.get('/categories', protect, getBiteCategories);
router.get('/bites', protect, getBite);
router.get('/bites/search', protect, searchBites);
router.get('/bites/trending', protect, getTrendingBites);
router.get('/bites/category/:category', protect, getBitesByCategory);
router.post(
    '/bites',
    protect,
    upload.fields([
        { name: 'photo', maxCount: 1 },
        { name: 'image', maxCount: 1 },
    ]),
    validate(createBiteSchema),
    createBite
);
router.get('/bites/:id', protect, getBiteById);
router.patch('/bites/:id', protect, validate(updateBiteSchema), updateBite);
router.delete('/bites/:id', protect, deleteBite);
router.post('/bites/:id/view', protect, recordBiteView);
router.post('/bites/:id/like', protect, toggleLikeBite);
router.post('/bites/:id/save', protect, toggleSaveBite);
router.get('/bites/:id/comments', protect, getBiteComments);
router.post('/bites/:id/comments', protect, createComment);

export default router;
