import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exe = process.env.CULTIVATION_SMOKE_EXE ?? path.join(root, 'release', 'CultivationSystem 0.0.0.exe');
const userDataDir = mkdtempSync(path.join(tmpdir(), 'cultivation-portable-userdata-'));
const outputPath = path.join(userDataDir, 'portable-smoke.json');

try {
  runSmokeLaunch();
  const created = JSON.parse(readFileSync(outputPath, 'utf8'));
  if (!created.projectId || !created.resourceId || !created.logId) {
    throw new Error(`first launch did not write ids: ${JSON.stringify(created)}`);
  }

  runSmokeLaunch();
  const verified = JSON.parse(readFileSync(outputPath, 'utf8'));
  if (!verified.verified || !verified.recentLogRestored) {
    throw new Error(`second launch did not verify persisted data: ${JSON.stringify(verified)}`);
  }

  console.log(JSON.stringify({ ok: true, ...verified }, null, 2));
} finally {
  rmSync(userDataDir, { recursive: true, force: true });
}

function runSmokeLaunch() {
  const result = spawnSync(exe, [`--user-data-dir=${userDataDir}`, `--cultivation-smoke=${outputPath}`], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    windowsHide: true,
    timeout: 60_000,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`portable smoke launch failed with ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
}
