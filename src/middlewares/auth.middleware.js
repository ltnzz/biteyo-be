import jwt from 'jsonwebtoken';

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

        req.user = decoded;

        next();
    } catch (error) {
        return res.status(401).json({
            message: 'Invalid token',
        });
    }
};
