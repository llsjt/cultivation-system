import { mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { enableForeignKeys } from '../db/connection';
import { backupAfterIntegrityCheck } from '../db/migrate';

function migrateMemoryDb() {
  const db = new Database(':memory:');
  enableForeignKeys(db);
  const migration = readFileSync(path.resolve(process.cwd(), 'drizzle/0000_mute_spirit.sql'), 'utf8').replaceAll('--> statement-breakpoint', '');
  db.exec(migration);
  return db;
}

describe('database migration', () => {
  it('creates the core tables, indexes and drizzle migration metadata shape', () => {
    const db = migrateMemoryDb();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[];
    expect(tables.map((table) => table.name)).toEqual(['pending_study_sessions', 'projects', 'resources', 'study_logs']);

    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name").all() as { name: string }[];
    expect(indexes.map((index) => index.name)).toEqual([
      'idx_pending_study_sessions_project_id',
      'idx_pending_study_sessions_resource_id',
      'idx_resources_project_id',
      'idx_resources_status_last_studied_at',
      'idx_resources_updated_at',
      'idx_study_logs_project_studied_at',
      'idx_study_logs_resource_id',
    ]);
    db.close();
  });

  it('rejects empty names, invalid enum values, invalid progress and orphan resources', () => {
    const db = migrateMemoryDb();
    const now = new Date().toISOString();

    expect(() => {
      db.prepare('INSERT INTO projects (id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run('p-empty', ' ', 'not_started', now, now);
    }).toThrow();

    expect(() => {
      db.prepare('INSERT INTO projects (id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run('p-status', 'x', 'bad', now, now);
    }).toThrow();

    db.prepare('INSERT INTO projects (id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run('p1', 'x', 'not_started', now, now);

    expect(() => {
      db.prepare(
        'INSERT INTO resources (id, project_id, title, type, open_kind, status, progress_percent, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run('r-progress', 'p1', 'r', 'document', 'record_only', 'learning', 120, now, now);
    }).toThrow();

    expect(() => {
      db.prepare(
        'INSERT INTO resources (id, project_id, title, type, open_kind, status, progress_percent, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run('r-orphan', 'missing', 'r', 'document', 'record_only', 'learning', 20, now, now);
    }).toThrow();
    db.close();
  });

  it('creates weekly regular backups after integrity checks and keeps four', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'cultivation-backup-'));
    try {
      const dbPath = path.join(dir, 'cultivation_system.sqlite3');
      writeFileSync(dbPath, 'db');

      for (let index = 0; index < 5; index += 1) {
        backupAfterIntegrityCheck(dir);
        const backups = readdirSync(path.join(dir, 'backups'))
          .filter((name) => name.startsWith('regular-'))
          .map((name) => path.join(dir, 'backups', name));
        const staleTime = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000 - index * 1000);
        for (const backup of backups) {
          utimesSync(backup, staleTime, staleTime);
        }
      }

      const regularBackups = readdirSync(path.join(dir, 'backups')).filter((name) => name.startsWith('regular-'));
      expect(regularBackups).toHaveLength(4);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
