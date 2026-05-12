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

const router = express.Router();

router.post('/signup', validate(registerSchema), signUp);
router.post('/signin', validate(loginSchema), signIn);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post(
    '/reset-password/:token',
    validate(resetPasswordSchema),
    resetPassword
);
router.post('/logout', logout);
router.get('/me', protect, getMe);

router.post('/google', validate(googleSignInSchema), googleSignIn);

export default router;
