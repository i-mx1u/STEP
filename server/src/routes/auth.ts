import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getDatabase } from '../db/index.js';
import { signToken, requireAuth, type AuthedRequest } from '../auth.js';
import type { PublicUser, UserRecord } from '../types.js';

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again shortly.' },
});

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name.').max(80),
  email: z.string().trim().email('Enter a valid email address.').max(200),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(200),
});

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.').max(200),
  password: z.string().min(1, 'Enter your password.').max(200),
});

function publicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt,
  };
}

authRouter.post('/register', authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Check your details.' });
    return;
  }

  const db = await getDatabase();
  const email = parsed.data.email.toLowerCase();
  const existing = await db.findUserByEmail(email);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const now = new Date().toISOString();
  const user: UserRecord = {
    id: crypto.randomUUID(),
    email,
    passwordHash: await bcrypt.hash(parsed.data.password, 12),
    displayName: parsed.data.name,
    createdAt: now,
  };

  try {
    await db.createUser(user);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.toLowerCase().includes('duplicate') || message.includes('23505')) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }
    throw error;
  }

  res.status(201).json({
    token: signToken(user.id, user.email),
    user: publicUser(user),
  });
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Check your details.' });
    return;
  }

  const db = await getDatabase();
  const user = await db.findUserByEmail(parsed.data.email.toLowerCase());
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ error: 'Incorrect email or password.' });
    return;
  }

  res.json({
    token: signToken(user.id, user.email),
    user: publicUser(user),
  });
});

authRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const db = await getDatabase();
  const user = await db.findUserById(req.userId as string);
  if (!user) {
    res.status(401).json({ error: 'Account not found.' });
    return;
  }
  res.json({ user: publicUser(user) });
});
