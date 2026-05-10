import { z } from 'zod';

export const createBiteSchema = z.object({
    foodName: z
        .string()
        .min(2, 'Food name is too short')
        .max(64, 'Food name is too long'),
    locationName: z.string().min(2, 'Location is required').max(255),
    locationAddress: z.string().max(500).optional(),
    latitude: z.coerce.number().optional(),
    longitude: z.coerce.number().optional(),
    placeId: z.string().optional(),
    review: z.string().max(1000).optional(),
    rating: z.coerce
        .number()
        .min(1, 'Minimum rating is 1')
        .max(5, 'Maximum rating is 5'),
    category: z.enum([
        'street_food',
        'cafe',
        'fine_dining',
        'dessert',
        'viral',
        'hidden_gems',
    ]),
});

export const updateBiteSchema = z.object({
    foodName: z
        .string()
        .min(2)
        .max(64)
        .optional(),
    review: z
        .string()
        .max(1000)
        .optional(),
    rating: z.coerce
        .number()
        .min(1)
        .max(5)
        .optional(),
    category: z.enum([
        'street_food',
        'cafe',
        'fine_dining',
        'dessert',
        'viral',
        'hidden_gems',
    ]).optional(),
});
