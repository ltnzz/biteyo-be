import { z } from 'zod';

export const createCommentSchema = z.object({
    content: z.string().trim().min(1, 'Comment is required').max(1000, 'Comment is too long'),
});
