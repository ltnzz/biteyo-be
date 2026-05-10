import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';

import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { sendEmail } from '../utils/email.js';

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '7d',
    });
};

export const signUp = async (req, res) => {
    try {
        const { username, email, password, confirm_password } = req.body;

        if (password !== confirm_password) {
            return res.status(400).json({
                message: 'Passwords do not match',
            });
        }

        const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.email, email));

        if (existingUser.length > 0) {
            return res.status(400).json({
                message: 'Email already exists',
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await db
            .insert(users)
            .values({
                username,
                email,
                password: hashedPassword,
            })
            .returning();

        const token = generateToken(newUser[0].id);

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        const { password: _, ...safeUser } = newUser[0];

        return res.status(201).json({
            message: 'Signup success',
            user: safeUser,
        });
    } catch (error) {
        console.log('Error in signUp controller', error);

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

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        const { password: _, ...safeUser } = user;

        return res.status(200).json({
            message: 'Login success',
            user: safeUser,
        });
    } catch (error) {
        console.log('Error in signIn controller', error);

        return res.status(500).json({
            message: 'Internal server error',
        });
    }
};

export const logout = async (_req, res) => {
    try {
        res.clearCookie('token');

        return res.status(200).json({
            message: 'Logout success',
        });
    } catch (error) {
        console.log('Error in logout controller', error);

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
            return res.status(404).json({
                message: 'User not found',
            });
        }

        const user = existingUser[0];

        const resetToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
            expiresIn: '15m',
        });

        const resetLink = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

        await sendEmail(
            email,
            'Reset Password',
            `
            <h2>Reset Password</h2>
            <p>Click the link below to reset your password:</p>
            <a href="${resetLink}">${resetLink}</a>
            `
        );

        return res.status(200).json({
            message: 'Reset link sent',
        });
    } catch (error) {
        console.log('Error in forgotPassword controller', error);

        return res.status(500).json({
            message: 'Internal server error',
        });
    }
};

export const resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const hashedPassword = await bcrypt.hash(password, 10);

        await db
            .update(users)
            .set({
                password: hashedPassword,
            })
            .where(eq(users.id, decoded.id));

        return res.status(200).json({
            message: 'Password reset success',
        });
    } catch (error) {
        console.log('Error in resetPassword controller', error);

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

        const { password, ...safeUser } = user;

        return res.status(200).json({
            user: safeUser,
        });
    } catch (error) {
        console.log('Error in getMe controller', error);

        return res.status(500).json({
            message: 'Internal server error',
        });
    }
};
