import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';

import { app } from 'electron';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { AppError } from '../../shared/errors';
import { assertForeignKeyCheck, databaseFileName, type SqliteDatabase } from './connection';

const migrationBackupRetention = 3;
const regularBackupRetention = 4;
const regularBackupIntervalMs = 7 * 24 * 60 * 60 * 1000;

export function resolveMigrationsDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'drizzle');
  }

  return path.resolve(process.cwd(), 'drizzle');
}

export function migrateDatabase(db: SqliteDatabase, userDataPath: string): void {
  try {
    backupBeforeMigrate(userDataPath);
    migrate(drizzle(db), { migrationsFolder: resolveMigrationsDir() });
    assertForeignKeyCheck(db);
    backupAfterIntegrityCheck(userDataPath);
  } catch (cause) {
    throw new AppError({ code: 'MIGRATION_FAILED', cause });
  }
}

export function backupBeforeMigrate(userDataPath: string): void {
  const dbPath = path.join(userDataPath, databaseFileName);

  if (!existsSync(dbPath) || statSync(dbPath).size === 0) {
    return;
  }

  const backupDir = path.join(userDataPath, 'backups');
  mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  copyFileSync(dbPath, path.join(backupDir, `migration-${timestamp}-${databaseFileName}`));
  pruneBackups(backupDir, 'migration-', migrationBackupRetention);
}

export function backupAfterIntegrityCheck(userDataPath: string): void {
  const dbPath = path.join(userDataPath, databaseFileName);

  if (!existsSync(dbPath) || statSync(dbPath).size === 0) {
    return;
  }

  const backupDir = path.join(userDataPath, 'backups');
  mkdirSync(backupDir, { recursive: true });

  const latestRegularBackup = readdirSync(backupDir)
    .filter((name) => name.startsWith('regular-') && name.endsWith(databaseFileName))
    .map((name) => statSync(path.join(backupDir, name)).mtimeMs)
    .sort((a, b) => b - a)[0];

  if (latestRegularBackup !== undefined && Date.now() - latestRegularBackup < regularBackupIntervalMs) {
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  copyFileSync(dbPath, path.join(backupDir, `regular-${timestamp}-${databaseFileName}`));
  pruneBackups(backupDir, 'regular-', regularBackupRetention);
}

function pruneBackups(backupDir: string, prefix: string, retention: number): void {
  const backups = readdirSync(backupDir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(databaseFileName))
    .map((name) => ({ name, path: path.join(backupDir, name), mtimeMs: statSync(path.join(backupDir, name)).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  for (const backup of backups.slice(retention)) {
    unlinkSync(backup.path);
  }
}
