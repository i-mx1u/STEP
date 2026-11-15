import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import { config, validateConfig } from './config.js';
import { getDatabase } from './db/index.js';
import { getBankMeta } from './bank.js';
import { authRouter } from './routes/auth.js';
import { contentRouter } from './routes/content.js';
import { historyRouter, statsRouter } from './routes/history.js';
import { bookmarksRouter } from './routes/bookmarks.js';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy ? 1 : false);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use(compression());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (config.clientOrigins.includes(origin)) return callback(null, true);
      if (!config.isProduction && /^http:\/\/localhost:\d+$/.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    credentials: false,
  }),
);
app.use(express.json({ limit: '6mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
  message: { error: 'Too many requests. Please wait a moment and try again.' },
});
app.use('/api', apiLimiter);

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'stepwise-api',
    provider: config.databaseProvider,
    bank: getBankMeta(),
    time: new Date().toISOString(),
  });
});

app.use('/api/auth', authRouter);
app.use('/api', contentRouter);
app.use('/api/history', historyRouter);
app.use('/api/stats', statsRouter);
app.use('/api/bookmarks', bookmarksRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API route not found.' });
});

const clientDist = path.resolve(config.serverDir, '..', 'client', 'dist');
const hasClient = fs.existsSync(path.join(clientDist, 'index.html'));

if (config.serveStatic && hasClient) {
  app.use(express.static(clientDist, { maxAge: '1h', index: false }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(
  (
    error: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (error.message?.includes('not allowed by CORS')) {
      res.status(403).json({ error: 'This origin is not allowed to use the API.' });
      return;
    }
    console.error('[stepwise] Unhandled error:', error);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  },
);

async function start() {
  const warnings = validateConfig();
  for (const warning of warnings) console.warn(`[stepwise] WARNING: ${warning}`);

  const db = await getDatabase();
  console.log(`[stepwise] Database: ${db.provider}`);
  const meta = getBankMeta();
  console.log(
    `[stepwise] Question bank: ${meta.totals.playable} playable questions across ${meta.totals.models} models.`,
  );

  const server = app.listen(config.port, () => {
    console.log(`[stepwise] API listening on http://localhost:${config.port}`);
    if (config.serveStatic && hasClient) {
      console.log(`[stepwise] Serving web app from ${clientDist}`);
    }
  });

  const shutdown = (signal: string) => {
    console.log(`[stepwise] ${signal} received, shutting down.`);
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((error) => {
  console.error('[stepwise] Failed to start:', error);
  process.exit(1);
});
