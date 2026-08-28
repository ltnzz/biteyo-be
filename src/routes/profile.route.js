import express from 'express';
import {
getProfile,
getProfileActivity,
    updateProfile,
    deleteAccount,
    getUserBites,
    getSavedBites,
    getLikedBites,
    getUserLikedBites,
    followUser,
    unfollowUser,
    getMentionSuggestions,
} from '../controllers/profile.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { parseMultipart, uploadSupabaseFiles } from '../middlewares/upload.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { updateProfileSchema } from '../middlewares/validations/profile.validation.js';

const router = express.Router();

// ⚠️ route statis harus di atas route dinamis /:username
router.get('/saved', protect, getSavedBites);
router.get('/liked', protect, getLikedBites);
router.get('/mentions', protect, getMentionSuggestions);

router.post('/:username/follow', protect, followUser);
router.delete('/:username/follow', protect, unfollowUser);
router.get('/:username', protect, getProfile);
router.get('/:username/bites', protect, getUserBites);
router.get('/:username/activity', protect, getProfileActivity);
router.get('/:username/liked', protect, getUserLikedBites);
router.get('/:username/likes', protect, getUserLikedBites);

router.patch(
    '/',
    protect,
    parseMultipart([
        { name: 'avatar', maxCount: 1 },
        { name: 'profileImage', maxCount: 1 },
        { name: 'banner', maxCount: 1 },
        { name: 'bannerImage', maxCount: 1 },
        { name: 'cover', maxCount: 1 },
    ]),
    validate(updateProfileSchema),
    uploadSupabaseFiles,
    updateProfile
);
router.delete('/', protect, deleteAccount);

export default router;
