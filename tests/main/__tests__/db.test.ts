import { mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { enableForeignKeys } from '../../../src/main/db/connection';
import { backupAfterIntegrityCheck } from '../../../src/main/db/migrate';
import { calcProjectProgress } from '../../../src/shared/calc';
import { cultivationRoleValues, openKindValues, projectStatusValues, resourceTypeValues, studyEvidenceTypeValues } from '../../../src/shared/enums';

function migrateMemoryDb() {
  const db = new Database(':memory:');
  enableForeignKeys(db);
  const migrationsDir = path.resolve(process.cwd(), 'drizzle');
  for (const fileName of readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()) {
    const migration = readFileSync(path.join(migrationsDir, fileName), 'utf8').replaceAll('--> statement-breakpoint', '');
    db.exec(migration);
  }
  return db;
}

describe('database migration', () => {
  it('matches SQLite round(avg()) for stored integer progress', () => {
    const db = new Database(':memory:');
    db.exec('CREATE TABLE progress_values (value INTEGER NOT NULL)');
    const insert = db.prepare('INSERT INTO progress_values (value) VALUES (?)');

    for (const value of [20, 40, 100]) {
      insert.run(value);
    }

    const row = db.prepare('SELECT round(avg(value)) AS progress FROM progress_values').get() as { progress: number };
    expect(row.progress).toBe(calcProjectProgress([20, 40, 100]));
    db.close();
  });

  it('creates the core tables, indexes and drizzle migration metadata shape', () => {
    const db = migrateMemoryDb();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[];
    expect(tables.map((table) => table.name)).toEqual(['breakthrough_attempts', 'pending_study_sessions', 'projects', 'resources', 'study_logs']);

    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name").all() as { name: string }[];
    expect(indexes.map((index) => index.name)).toEqual([
      'idx_breakthrough_attempts_project_created_at',
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

    expect(() => {
      db.prepare(
        'INSERT INTO resources (id, project_id, title, type, open_kind, cultivation_role, status, progress_percent, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run('r-role', 'p1', 'r', 'document', 'record_only', 'invalid', 'learning', 20, now, now);
    }).toThrow();

    expect(() => {
      db.prepare(
        'INSERT INTO study_logs (id, project_id, resource_title_snapshot, studied_at, progress_before_percent, progress_after_percent, status_before, status_after, evidence_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run('log-evidence', 'p1', 'r', now, 0, 20, 'not_started', 'learning', 'invalid', now);
    }).toThrow();
    db.close();
  });

  it('keeps migrated database enum checks aligned with shared enum values', () => {
    const db = migrateMemoryDb();
    const now = new Date().toISOString();

    for (const status of projectStatusValues) {
      db.prepare('INSERT INTO projects (id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(`p-${status}`, status, status, now, now);
    }

    for (const type of resourceTypeValues) {
      db.prepare(
        'INSERT INTO resources (id, project_id, title, type, open_kind, status, progress_percent, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(`r-type-${type}`, 'p-learning', type, type, 'record_only', 'learning', 0, now, now);
    }

    for (const openKind of openKindValues) {
      db.prepare(
        'INSERT INTO resources (id, project_id, title, type, open_kind, path_or_url, status, progress_percent, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(`r-open-${openKind}`, 'p-learning', openKind, 'document', openKind, openKind === 'record_only' ? null : 'https://example.com', 'learning', 0, now, now);
    }

    for (const role of cultivationRoleValues) {
      db.prepare(
        'INSERT INTO resources (id, project_id, title, type, open_kind, cultivation_role, status, progress_percent, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(`r-role-${role}`, 'p-learning', role, 'document', 'record_only', role, 'learning', 0, now, now);
    }

    for (const evidenceType of studyEvidenceTypeValues) {
      db.prepare(
        'INSERT INTO study_logs (id, project_id, resource_title_snapshot, studied_at, progress_before_percent, progress_after_percent, status_before, status_after, evidence_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(`log-${evidenceType}`, 'p-learning', 'r', now, 0, 1, 'not_started', 'learning', evidenceType, now);
    }

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
