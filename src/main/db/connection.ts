import { mkdirSync } from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import { AppError } from '../../shared/errors';

export const databaseFileName = 'cultivation_system.sqlite3';

export type SqliteDatabase = Database.Database;

export function openDatabase(userDataPath: string): SqliteDatabase {
  mkdirSync(userDataPath, { recursive: true });
  const dbPath = path.join(userDataPath, databaseFileName);
  const db = new Database(dbPath);
  enableForeignKeys(db);
  return db;
}

export function enableForeignKeys(db: SqliteDatabase): void {
  db.pragma('foreign_keys = ON');
  const result = db.pragma('foreign_keys', { simple: true });

  if (result !== 1) {
    throw new AppError({ code: 'DB_CONSTRAINT_FAILED' });
  }
}

export function assertForeignKeyCheck(db: SqliteDatabase): void {
  const violations = db.pragma('foreign_key_check') as unknown[];

  if (violations.length > 0) {
    throw new AppError({ code: 'DB_CONSTRAINT_FAILED', details: { violation_count: violations.length } });
  }
}
