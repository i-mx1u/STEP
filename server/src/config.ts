import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT_DIR = path.resolve(SERVER_DIR, '..');

for (const file of [path.join(SERVER_DIR, '.env'), path.join(ROOT_DIR, '.env')]) {
  if (fs.existsSync(file)) dotenv.config({ path: file });
}

const bool = (value: string | undefined, fallback = false) => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const splitList = (value: string | undefined, fallback: string[]) =>
  (value ? value.split(',').map((v) => v.trim()).filter(Boolean) : fallback);

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const provider = supabaseUrl && supabaseKey
  ? 'supabase'
  : (process.env.DATABASE_PROVIDER || 'sqlite').toLowerCase();

export const config = {
  serverDir: SERVER_DIR,
  rootDir: ROOT_DIR,
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 4000),
  databaseProvider: provider === 'supabase' ? 'supabase' : 'sqlite',
  jwtSecret: process.env.JWT_SECRET || 'stepwise-development-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  supabaseUrl,
  supabaseKey,
  sqlitePath: path.resolve(
    ROOT_DIR,
    process.env.SQLITE_PATH || 'server/data/stepwise.db',
  ),
  bankFile: path.resolve(
    ROOT_DIR,
    process.env.STEP_BANK_FILE || 'server/data/step-bank.json',
  ),
  clientOrigins: splitList(process.env.CLIENT_ORIGIN || process.env.CLIENT_ORIGINS, [
    'http://localhost:5173',
    'http://localhost:4173',
    'http://localhost:3000',
  ]),
  serveStatic: bool(process.env.SERVE_STATIC, true),
  trustProxy: bool(process.env.TRUST_PROXY, true),
  corsAllowVercel: bool(process.env.CORS_ALLOW_VERCEL, false),
} as const;

export function validateConfig() {
  const warnings: string[] = [];

  if (config.isProduction && config.jwtSecret === 'stepwise-development-secret-change-me') {
    warnings.push('JWT_SECRET is using the development default. Set a long random secret.');
  }

  if (config.databaseProvider === 'supabase' && (!supabaseUrl || !supabaseKey)) {
    throw new Error(
      'Supabase was selected but SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are missing.',
    );
  }

  if (config.databaseProvider === 'sqlite' && !fs.existsSync(path.dirname(config.sqlitePath))) {
    fs.mkdirSync(path.dirname(config.sqlitePath), { recursive: true });
  }

  if (!fs.existsSync(config.bankFile)) {
    throw new Error(
      `Question bank not found at ${config.bankFile}. Run "npm run parse" first.`,
    );
  }

  return warnings;
}
