import express from 'express';

import {
    signUp,
    signIn,
    logout,
    forgotPassword,
    resetPassword,
    getMe,
    googleSignIn,
} from '../controllers/auth.controller.js';

import { protect } from '../middlewares/auth.middleware.js';
import {
    registerSchema,
    loginSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    googleSignInSchema,
} from '../middlewares/validations/auth.validation.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authLimiter } from '../utils/rate.limit.js';

const router = express.Router();

router.post('/signup', authLimiter, validate(registerSchema), signUp);
router.post('/signin', authLimiter, validate(loginSchema), signIn);
router.post(
    '/forgot-password',
    authLimiter,
    validate(forgotPasswordSchema),
    forgotPassword
);
router.post(
    '/reset-password/:token',
    authLimiter,
    validate(resetPasswordSchema),
    resetPassword
);
router.post('/logout', logout);
router.get('/me', protect, getMe);

router.post('/google', authLimiter, validate(googleSignInSchema), googleSignIn);

export default router;
