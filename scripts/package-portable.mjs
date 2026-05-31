import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
const localPath = [path.join(root, '.tooling'), path.join(root, 'node_modules', '.bin'), process.env[pathKey] ?? ''].join(path.delimiter);
const env = { ...process.env, [pathKey]: localPath };

run('corepack', ['pnpm', 'run', 'build']);
run('corepack', ['pnpm', 'run', 'rebuild:electron']);
run(resolveBin('electron-builder'), ['--win', 'portable', '--config', 'config/electron-builder.yml']);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function resolveBin(name) {
  return process.platform === 'win32' ? path.join(root, 'node_modules', '.bin', `${name}.cmd`) : path.join(root, 'node_modules', '.bin', name);
}
