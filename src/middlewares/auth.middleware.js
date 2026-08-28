import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';

import { db } from '../db/index.js';
import { users } from '../db/schema.js';

export const protect = async (req, res, next) => {
    try {
        // Auth cookie-only: token httpOnly diset saat login/signup,
        // frontend tidak lagi menyimpan atau mengirim bearer header.
        const token = req.cookies?.token;

        if (!token) {
            return res.status(401).json({
                message: 'Unauthorized',
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Reset-password token tidak boleh dipakai sebagai session token.
        // Tahap 1: tolak eksplisit reset_password. Tahap 2 (setelah migrasi): enforce type === 'session'.
        if (decoded.type === 'reset_password') {
            return res.status(401).json({
                message: 'Invalid session token',
            });
        }

        const [user] = await db
            .select({ tokenValidAfter: users.tokenValidAfter })
            .from(users)
            .where(eq(users.id, decoded.id));

        if (
            user?.tokenValidAfter &&
            decoded.iat * 1000 < new Date(user.tokenValidAfter).getTime()
        ) {
            return res.status(401).json({
                message: 'Session expired, please sign in again',
            });
        }

        req.user = decoded;

        next();
    } catch (error) {
        return res.status(401).json({
            message: 'Invalid token',
        });
    }
};
