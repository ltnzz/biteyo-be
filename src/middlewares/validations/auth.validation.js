import { z } from 'zod';

export const registerSchema = z.object({
    username: z
        .string()
        .min(3, 'Username must be at least 3 characters')
        .max(30, 'Username is too long')
        .trim(),
    email: z.email('Invalid email').max(64),
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(64)
        .regex(
            /^(?=.*[A-Za-z])(?=.*\d).+$/,
            'Password must contain letters and numbers'
        ),
    confirm_password: z.string().min(1, 'Please confirm your password'),
});

export const loginSchema = z.object({
    email: z.email('Invalid email'),
    password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
    email: z.email('Invalid email'),
});

export const resetPasswordSchema = z.object({
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(64),
    confirm_password: z.string().min(1, 'Please confirm your password'),
});
