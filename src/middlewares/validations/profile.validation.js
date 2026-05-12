import { z } from 'zod';

export const updateProfileSchema = z.object({
    username: z
        .string()
        .min(3, 'Username must be at least 3 characters')
        .max(30, 'Username is too long')
        .trim()
        .optional(),
    bio: z
        .string()
        .max(255, 'Bio is too long')
        .optional(),
});
