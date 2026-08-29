import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { eq, or } from 'drizzle-orm';

import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { sendEmail } from '../utils/email.js';
import { resetPasswordTemplate } from '../templates/auth.email.template.js';
import { OAuth2Client } from 'google-auth-library';
import { logger } from '../utils/logger.js';
import { getTokenCookieOptions } from '../utils/cookie.js';

const googleClient = new OAuth2Client();
const loginTokenMaxAgeDays = Number.parseInt(
    process.env.LOGIN_TOKEN_MAX_AGE_DAYS,
    10
);
const LOGIN_TOKEN_MAX_AGE_DAYS =
    Number.isNaN(loginTokenMaxAgeDays) || loginTokenMaxAgeDays <= 0
        ? 30
        : loginTokenMaxAgeDays;

const generateToken = (id) => {
    return jwt.sign({ id, type: 'session' }, process.env.JWT_SECRET, {
        expiresIn: `${LOGIN_TOKEN_MAX_AGE_DAYS}d`,
    });
};

const setTokenCookie = (req, res, token) => {
    res.cookie('token', token, {
        ...getTokenCookieOptions(req),
        maxAge: LOGIN_TOKEN_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
    });
};

const generateUniqueUsername = async (name, email) => {
    let base = (name || email.split('@')[0])
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 20);

    if (base.length < 3) base = 'user' + base;

    const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, base));

    if (!existing) return base;

    // Coba beberapa suffix kriptografis untuk hindari collision (TOCTOU)
    for (let i = 0; i < 5; i++) {
        const suffix = crypto.randomInt(1000, 10000);
        const candidate = base.slice(0, 16) + '_' + suffix;
        const [hit] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.username, candidate));
        if (!hit) return candidate;
    }

    return base.slice(0, 12) + '_' + crypto.randomBytes(2).toString('hex');
};

export const signUp = async (req, res) => {
    try {
        const { name, username, email, password, confirm_password } = req.body;

        if (password !== confirm_password) {
            return res.status(400).json({
                message: 'Passwords do not match',
            });
        }

        const existingUser = await db
            .select()
            .from(users)
            .where(or(eq(users.email, email), eq(users.username, username)));

        if (existingUser.length > 0) {
            return res.status(400).json({
                message: 'User already exists',
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await db
            .insert(users)
            .values({
                name: name ? name.trim() : username,
                username,
                email,
                password: hashedPassword,
            })
            .returning();

        const token = generateToken(newUser[0].id);

        setTokenCookie(req, res, token);

        const { password: _, ...safeUser } = newUser[0];

        return res.status(201).json({
            message: 'Signup success',
            user: safeUser,
        });
    } catch (error) {
        logger.info('Error in signUp controller', error);

        return res.status(500).json({
            message: 'Internal server error',
        });
    }
};

export const signIn = async (req, res) => {
    try {
        const { email, password } = req.body;

        const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.email, email));

        if (existingUser.length === 0) {
            return res.status(400).json({
                message: 'Invalid credentials',
            });
        }

        const user = existingUser[0];

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({
                message: 'Invalid credentials',
            });
        }

        const token = generateToken(user.id);

        setTokenCookie(req, res, token);

        const { password: _, ...safeUser } = user;

        return res.status(200).json({
            message: 'Login success',
            user: safeUser,
        });
    } catch (error) {
        logger.info('Error in signIn controller', error);

        return res.status(500).json({
            message: 'Internal server error',
        });
    }
};

export const logout = async (req, res) => {
    try {
        res.clearCookie('token', getTokenCookieOptions(req));

        return res.status(200).json({
            message: 'Logout success',
        });
    } catch (error) {
        logger.info('Error in logout controller', error);

        return res.status(500).json({
            message: 'Internal server error',
        });
    }
};

export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.email, email));

        if (existingUser.length === 0) {
            return res.status(200).json({
                message: 'If the email exists, a reset link has been sent.',
            });
        }

        const user = existingUser[0];

        const resetToken = jwt.sign(
            { id: user.id, type: 'reset_password' },
            process.env.JWT_SECRET,
            {
                expiresIn: '15m',
            }
        );

        const resetLink = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

        await sendEmail(
            user.email,
            'Reset Password Biteyo',
            resetPasswordTemplate(resetLink)
        );

        const [name, domain] = user.email.split('@');
        const maskedEmail = name.slice(0, 2) + '***@' + domain;

        return res.status(200).json({
            message: `Reset link sent to ${maskedEmail}. Please check your inbox.`,
        });
    } catch (error) {
        logger.info('Error in forgotPassword controller', error);

        return res.status(500).json({
            message: 'Internal server error',
        });
    }
};

export const resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password, confirm_password } = req.body;

        if (password !== confirm_password) {
            return res.status(400).json({
                message: 'Passwords do not match',
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.type !== 'reset_password') {
            return res.status(400).json({
                message: 'Invalid token',
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await db
            .select()
            .from(users)
            .where(eq(users.id, decoded.id));

        if (!user.length) {
            return res.status(404).json({
                message: 'User not found',
            });
        }

        await db
            .update(users)
            .set({
                password: hashedPassword,
                // cabut semua sesi (JWT) yang diterbitkan sebelum saat ini
                tokenValidAfter: new Date(),
            })
            .where(eq(users.id, decoded.id));

        return res.status(200).json({
            message: 'Password reset success',
        });
    } catch (error) {
        logger.info('Error in resetPassword controller', error);

        return res.status(400).json({
            message: 'Invalid or expired token',
        });
    }
};

export const getMe = async (req, res) => {
    try {
        const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.id, req.user.id));

        if (existingUser.length === 0) {
            return res.status(404).json({
                message: 'User not found',
            });
        }

        const user = existingUser[0];
        if (!user) {
            return res.status(404).json({
                message: 'User not found',
            });
        }

        const { password, ...safeUser } = user;

        return res.status(200).json({
            user: safeUser,
        });
    } catch (error) {
        logger.info('Error in getMe controller', error);

        return res.status(500).json({
            message: 'Internal server error',
        });
    }
};

export const googleSignIn = async (req, res) => {
    try {
        const { id_token } = req.body;

        if (!process.env.GOOGLE_CLIENT_ID) {
            return res.status(500).json({
                message: 'Google client ID is not configured',
            });
        }

        // verifikasi ID token langsung via google-auth-library
        const ticket = await googleClient.verifyIdToken({
            idToken: id_token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const { email, name, picture } = ticket.getPayload();

        if (!email) {
            return res.status(400).json({
                message: 'Invalid Google account',
            });
        }

        let [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email));

        if (!user) {
            // User baru — buat akun otomatis dengan retry untuk race unique constraint
            const randomPassword = await bcrypt.hash(
                crypto.randomBytes(32).toString('hex'),
                10
            );

            let lastError;
            for (let attempt = 0; attempt < 3; attempt++) {
                const username = await generateUniqueUsername(name, email);
                try {
                    [user] = await db
                        .insert(users)
                        .values({
                            name: name || null,
                            username,
                            email,
                            password: randomPassword,
                            avatarUrl: picture || null,
                        })
                        .returning();
                    lastError = null;
                    break;
                } catch (err) {
                    const isUniqueViolation =
                        err?.code === '23505' ||
                        /duplicate key|unique/i.test(err?.message || '');
                    if (isUniqueViolation && attempt < 2) {
                        lastError = err;
                        continue;
                    }
                    throw err;
                }
            }
            if (!user && lastError) throw lastError;
        } else if (!user.avatarUrl && picture) {
            // Update avatar jika belum punya
            [user] = await db
                .update(users)
                .set({ avatarUrl: picture })
                .where(eq(users.id, user.id))
                .returning();
        }

        const token = generateToken(user.id);
        setTokenCookie(req, res, token);

        const { password, ...safeUser } = user;

        return res.status(200).json({
            message: 'Google login success',
            user: safeUser,
        });
    } catch (error) {
        logger.error('Error in googleSignIn controller', error);
        return res.status(401).json({
            message: 'Invalid Google token',
        });
    }
};
