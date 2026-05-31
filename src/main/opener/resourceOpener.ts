import { existsSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';

import { BrowserWindow, shell } from 'electron';

import { AppError } from '../../shared/errors';

export function validateOpenTarget(openKind: string, target: string | null | undefined): void {
  const trimmed = target?.trim();
  if (openKind === 'record_only') {
    if (trimmed) {
      throw new AppError({ code: 'VALIDATION_FAILED', details: { field: 'path_or_url' } });
    }
    return;
  }

  if (!trimmed) {
    throw new AppError({ code: 'VALIDATION_FAILED', details: { field: 'path_or_url' } });
  }

  if (openKind === 'url') {
    validateHttpUrl(trimmed);
    return;
  }

  if (!path.isAbsolute(trimmed) || trimmed.includes('\0') || hasUnresolvedParentSegment(trimmed)) {
    throw new AppError({ code: 'PATH_BLOCKED', details: { reason: 'unsafe_path' } });
  }

  if (isBlockedLocalPath(trimmed)) {
    throw new AppError({ code: 'PATH_BLOCKED', details: { reason: 'blocked_path' } });
  }
}

export function normalizedPath(openKind: string, target: string | null | undefined): string | null {
  return openKind === 'record_only' ? null : target?.trim() ?? null;
}

export async function openExternalResource(openKind: string, target: string): Promise<string | null> {
  if (openKind === 'url') {
    try {
      validateHttpUrl(target);
      await shell.openExternal(target);
      return null;
    } catch (error) {
      if (error instanceof AppError) {
        return error.code;
      }
      return 'PERMISSION_DENIED';
    }
  }

  if (!existsSync(target)) {
    return 'PATH_NOT_FOUND';
  }

  let resolvedTarget: string;
  try {
    resolvedTarget = realpathSync(target);
  } catch {
    return 'PATH_NOT_FOUND';
  }

  if (!path.isAbsolute(resolvedTarget) || resolvedTarget.includes('\0') || hasUnresolvedParentSegment(resolvedTarget)) {
    return 'PATH_BLOCKED';
  }

  if (isBlockedLocalPath(resolvedTarget)) {
    return 'PATH_BLOCKED';
  }

  try {
    const stat = statSync(resolvedTarget);
    if ((openKind === 'file' && !stat.isFile()) || (openKind === 'folder' && !stat.isDirectory())) {
      return 'PATH_NOT_FOUND';
    }
    const result = await shell.openPath(resolvedTarget);
    return result ? 'PERMISSION_DENIED' : null;
  } catch {
    return 'PERMISSION_DENIED';
  }
}

export function canOpenInControlledWindow(openKind: string, target: string): boolean {
  return openKind === 'file' && path.extname(target).toLowerCase() === '.pdf';
}

export async function openControlledResource(openKind: string, target: string, onClosed: () => void): Promise<string | null> {
  if (!canOpenInControlledWindow(openKind, target)) {
    return 'UNSUPPORTED_CONTROLLED_VIEWER';
  }

  if (!existsSync(target)) {
    return 'PATH_NOT_FOUND';
  }

  let resolvedTarget: string;
  try {
    resolvedTarget = realpathSync(target);
  } catch {
    return 'PATH_NOT_FOUND';
  }

  if (!path.isAbsolute(resolvedTarget) || resolvedTarget.includes('\0') || hasUnresolvedParentSegment(resolvedTarget)) {
    return 'PATH_BLOCKED';
  }

  if (isBlockedLocalPath(resolvedTarget)) {
    return 'PATH_BLOCKED';
  }

  try {
    const stat = statSync(resolvedTarget);
    if (!stat.isFile()) {
      return 'PATH_NOT_FOUND';
    }

    const viewer = new BrowserWindow({
      width: 1100,
      height: 820,
      minWidth: 720,
      minHeight: 520,
      title: path.basename(resolvedTarget),
      backgroundColor: '#0b0e0f',
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });

    viewer.once('closed', onClosed);
    await viewer.loadFile(resolvedTarget);
    return null;
  } catch {
    return 'PERMISSION_DENIED';
  }
}

export function evaluateWarnRisk(openKind: string, target: string): string | null {
  if (openKind !== 'url') {
    return isMacroDocument(target) ? '该文件可能包含宏，打开前需要确认一次。' : null;
  }

  const parsed = new URL(target);
  if (parsed.protocol === 'http:') {
    return '该链接使用未加密的 http，需要确认后打开一次。';
  }

  if (isWarnOnlyHost(parsed.hostname)) {
    return '该链接指向本机或局域网地址，需要确认后打开一次。';
  }

  return null;
}

export function displayTarget(target: string | null): string | null {
  if (!target) {
    return null;
  }

  if (target.length <= 80) {
    return target;
  }

  return `${target.slice(0, 28)}...${target.slice(-40)}`;
}

function validateHttpUrl(value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new AppError({ code: 'INVALID_URL' });
  }

  if (!parsed.hostname) {
    throw new AppError({ code: 'INVALID_URL' });
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AppError({ code: 'UNSUPPORTED_URL_SCHEME' });
  }

  if (parsed.username || parsed.password || hasControlCharacter(value)) {
    throw new AppError({ code: 'INVALID_URL' });
  }
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

function isBlockedLocalPath(target: string): boolean {
  const normalized = path.normalize(target);
  const basename = path.basename(normalized);
  const extension = path.extname(basename).toLowerCase();
  const dangerousExtensions = new Set([
    '.bat',
    '.cmd',
    '.com',
    '.cpl',
    '.exe',
    '.hta',
    '.jar',
    '.js',
    '.jse',
    '.lnk',
    '.msi',
    '.ps1',
    '.reg',
    '.scf',
    '.scr',
    '.url',
    '.vbe',
    '.vbs',
    '.wsf',
  ]);

  if (normalized.startsWith('\\\\') || normalized.startsWith('\\\\?\\') || normalized.startsWith('\\\\.\\')) {
    return true;
  }

  if (dangerousExtensions.has(extension)) {
    return true;
  }

  return basename.includes(':');
}

function isMacroDocument(target: string): boolean {
  return new Set(['.docm', '.xlsm', '.pptm']).has(path.extname(target).toLowerCase());
}

function hasUnresolvedParentSegment(target: string): boolean {
  return target.split(/[\\/]+/).includes('..');
}

function isWarnOnlyHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower === '127.0.0.1' || lower === '::1' || lower.endsWith('.local')) {
    return true;
  }

  if (['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly'].includes(lower)) {
    return true;
  }

  return isPrivateIpv4(lower);
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}
