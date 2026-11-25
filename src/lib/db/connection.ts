import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initSchema } from './schema';

declare global {
  var __mindora_db__: Database.Database | undefined;
}

export function getDbPath(): string {
  const customPath = process.env.MINDORA_DB_PATH;
  if (customPath) {
    return customPath;
  }
  return path.resolve(process.cwd(), 'data', 'mindora.db');
}

export function getDb(customPath?: string): Database.Database {
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

  if (process.env.NODE_ENV !== 'production') {
    global.__mindora_db__ = db;
  }

  return db;
}

export function closeDb(): void {
  if (global.__mindora_db__ && global.__mindora_db__.open) {
    global.__mindora_db__.close();
    global.__mindora_db__ = undefined;
  }
}
