import { SQLiteDatabase } from './sqlite.js';
import { SupabaseDatabase } from './supabase.js';
import type { Database } from './types.js';
import { config } from '../config.js';

let database: Database | null = null;

export async function getDatabase(): Promise<Database> {
  if (database) return database;

  if (config.databaseProvider === 'supabase') {
    database = new SupabaseDatabase(
      config.supabaseUrl as string,
      config.supabaseKey as string,
    );
  } else {
    database = new SQLiteDatabase(config.sqlitePath);
  }

  await database.init();
  return database;
}
