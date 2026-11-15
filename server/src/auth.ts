import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from './config.js';

export interface AuthedRequest extends Request {
  userId?: string;
}

interface TokenPayload {
  sub: string;
  email: string;
}

export function signToken(userId: string, email: string) {
  return jwt.sign({ sub: userId, email }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as TokenPayload;
    if (!payload?.sub) return null;
    return payload;
  } catch {
    return null;
  }
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sign in to access this feature.' });
    return;
  }

  const payload = verifyToken(header.slice(7));
  if (!payload) {
    res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    return;
  }

  req.userId = payload.sub;
  next();
}
