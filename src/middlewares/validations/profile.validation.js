import { z } from 'zod';

export const updateProfileSchema = z.object({
    name: z
        .string({ invalid_type_error: 'Nama lengkap harus berupa teks' })
        .min(1, 'Nama lengkap wajib diisi')
        .max(64, 'Nama terlalu panjang (maksimal 64 karakter)')
        .trim()
        .optional(),
    username: z
        .string()
        .min(3, 'Username must be at least 3 characters')
        .max(30, 'Username is too long')
        .trim()
        .optional(),
    bio: z
        .string()
        .max(255, 'Bio is too long')
        .nullable()
        .optional(),
});
