import express from 'express';
import {
    createBite,
    getBite,
    updateBite,
    deleteBite,
    toggleLikeBite,
    createComment,
} from '../controllers/feed.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
    createBiteSchema,
    updateBiteSchema,
} from '../middlewares/validations/feed.validation.js';

const router = express.Router();

router.get('/bites', protect, getBite);
router.post(
    '/bites',
    protect,
    upload.single('photo'),
    validate(createBiteSchema),
    createBite
);
router.patch('/bites/:id', protect, validate(updateBiteSchema), updateBite);
router.delete('/bites/:id', protect, deleteBite);
router.post('/bites/:id/like', protect, toggleLikeBite);
router.post('/bites/:id/comments', protect, createComment);

export default router;
