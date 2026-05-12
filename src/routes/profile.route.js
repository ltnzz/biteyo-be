import express from 'express';
import {
    getProfile,
    updateProfile,
    deleteAccount,
    getUserBites,
    getSavedBites,
} from '../controllers/profile.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { updateProfileSchema } from '../middlewares/validations/profile.validation.js';

const router = express.Router();

// ⚠️ route statis harus di atas route dinamis /:username
router.get('/saved', protect, getSavedBites);

router.get('/:username', protect, getProfile);
router.get('/:username/bites', protect, getUserBites);

router.patch(
    '/',
    protect,
    upload.single('avatar'),
    validate(updateProfileSchema),
    updateProfile
);
router.delete('/', protect, deleteAccount);

export default router;
