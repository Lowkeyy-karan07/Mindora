import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initSchema } from './schema';
import { seedDatabase } from './seed';

declare global {
  var __mindora_db__: Database.Database | undefined;
  var __mindora_seed_checked__: boolean | undefined;
}

export function getDbPath(): string {
  const customPath =
    process.env.DATABASE_PATH?.trim() || process.env.MINDORA_DB_PATH?.trim();
  if (customPath) {
    return customPath;
  }
  return path.resolve(process.cwd(), 'data', 'mindora.db');
}

export function getDb(customPath?: string): Database.Database {
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    throw new Error('Database must not be opened during next build');
  }

  // If a custom or test path (such as ':memory:') is explicitly provided, create and return fresh instance
  if (customPath && customPath !== getDbPath()) {
    const db = new Database(customPath);
    initSchema(db);
    return db;
  }

  if (global.__mindora_db__ && global.__mindora_db__.open) {
    return global.__mindora_db__;
  }

  const dbFilePath = getDbPath();

  if (dbFilePath !== ':memory:') {
    const dbDir = path.dirname(dbFilePath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  const db = new Database(dbFilePath);
  initSchema(db);
  global.__mindora_db__ = db;

  // On startup, if SEED_ON_START=true and the database is empty, run the idempotent seed once
  if (
    process.env.SEED_ON_START === 'true' &&
    !global.__mindora_seed_checked__ &&
    dbFilePath !== ':memory:'
  ) {
    global.__mindora_seed_checked__ = true;
    const row = db
      .prepare(`SELECT COUNT(*) as count FROM checkins`)
      .get() as { count: number } | undefined;
    if (!row || row.count === 0) {
      seedDatabase(db);
    }
  }

  return db;
}

export function closeDb(): void {
  if (global.__mindora_db__ && global.__mindora_db__.open) {
    global.__mindora_db__.close();
    global.__mindora_db__ = undefined;
  }
  global.__mindora_seed_checked__ = undefined;
}
