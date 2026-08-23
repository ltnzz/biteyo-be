import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';

import { db } from '../db/index.js';
import { users } from '../db/schema.js';

export const protect = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const bearerToken = authHeader?.startsWith('Bearer ')
            ? authHeader.split(' ')[1]
            : null;
        const token = req.cookies.token || bearerToken;

        if (!token) {
            return res.status(401).json({
                message: 'Unauthorized',
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Tolak token yang diterbitkan sebelum password terakhir direset
        if (decoded.type !== 'reset_password') {
            const [user] = await db
                .select({ tokenValidAfter: users.tokenValidAfter })
                .from(users)
                .where(eq(users.id, decoded.id));

            if (
                user?.tokenValidAfter &&
                decoded.iat * 1000 <
                    new Date(user.tokenValidAfter).getTime()
            ) {
                return res.status(401).json({
                    message: 'Session expired, please sign in again',
                });
            }
        }

        req.user = decoded;

        next();
    } catch (error) {
        return res.status(401).json({
            message: 'Invalid token',
        });
    }
};
