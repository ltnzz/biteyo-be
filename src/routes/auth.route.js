import express from 'express';

import {
    signUp,
    signIn,
    logout,
    forgotPassword,
    resetPassword,
    getMe,
} from '../controllers/auth.controller.js';

import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/signup', signUp);
router.post('/signin', signIn);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.post('/logout', logout);

router.get('/me', protect, getMe);

export default router;