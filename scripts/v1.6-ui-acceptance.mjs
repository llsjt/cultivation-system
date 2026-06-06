import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactsDir = path.join(root, 'docs', 'artifacts', 'v1.6');
const outMain = path.join(root, 'out', 'main', 'index.js');
const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
const localPath = [path.join(root, '.tooling'), path.join(root, 'node_modules', '.bin'), process.env[pathKey] ?? ''].join(path.delimiter);
const env = { ...process.env, [pathKey]: localPath };
mkdirSync(artifactsDir, { recursive: true });

if (!existsSync(outMain)) {
  throw new Error('Missing out/main/index.js. Run `corepack pnpm run build` before `acceptance:ui:v1.6`.');
}

const userDataDir = mkdtempSync(path.join(tmpdir(), 'cultivation-v16-ui-'));
const fixtureDir = mkdtempSync(path.join(tmpdir(), 'cultivation-v16-fixture-'));
const filePath = path.join(fixtureDir, 'lesson.txt');
writeFileSync(filePath, 'lesson');

const result = await withApp(9476, userDataDir, async (client) => {
  await sleep(900);
  const seed = await seedFixture(client);

  await reloadAndWait(client);
  await selectProject(client, seed.normalProjectName);
  await setViewport(client, 1280, 720, 1);
  await screenshot(client, 'ui-1280x720-normal.png');
  await setViewport(client, 1024, 640, 1);
  await screenshot(client, 'ui-1024x640-normal.png');
  await setViewport(client, 390, 844, 1);
  await screenshot(client, 'ui-390x844-normal.png');

  await createPending(client, seed.pendingResourceId);
  await reloadAndWait(client);
  await selectProject(client, seed.normalProjectName);
  await setViewport(client, 1280, 720, 1);
  await screenshot(client, 'ui-1280x720-pending.png');
  await setViewport(client, 390, 844, 1);
  await screenshot(client, 'ui-390x844-pending.png');
  await clearPending(client);

  await reloadAndWait(client);
  await selectProject(client, seed.readyProjectName);
  await setViewport(client, 1280, 720, 1);
  await screenshot(client, 'ui-1280x720-breakthrough-ready.png');

  await selectProject(client, seed.blockedProjectName);
  await sleep(500);
  await screenshot(client, 'ui-1280x720-breakthrough-blocked.png');

  await selectProject(client, seed.emptyProjectName);
  await setViewport(client, 390, 844, 1);
  await screenshot(client, 'ui-390x844-empty-resource.png');

  await setViewport(client, 390, 844, 1);
  await showLibraryError(client);
  await screenshot(client, 'ui-390x844-error-state.png');

  await client.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await selectProject(client, seed.normalProjectName);
  await openTab(client, 'meditation');
  await setViewport(client, 1280, 720, 1);
  await screenshot(client, 'ui-1280x720-reduced-motion.png');

  const evidence = await evaluate(
    client,
    `(() => ({
      hasCockpit: Boolean(document.querySelector('.current-study-cockpit')),
      hasDiagnostic: Boolean(document.querySelector('.breakthrough-diagnostic-card, .breakthrough-page-panel')),
      hasRoleChip: Boolean(document.querySelector('.resource-role-chip')),
      selectedTab: document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() ?? null,
      bodyText: document.body.innerText.slice(0, 500)
    }))()`,
  );

  return { seed, evidence };
});

const artifacts = [
  'ui-1280x720-normal.png',
  'ui-1024x640-normal.png',
  'ui-390x844-normal.png',
  'ui-1280x720-pending.png',
  'ui-390x844-pending.png',
  'ui-1280x720-breakthrough-ready.png',
  'ui-1280x720-breakthrough-blocked.png',
  'ui-390x844-empty-resource.png',
  'ui-390x844-error-state.png',
  'ui-1280x720-reduced-motion.png',
].map((name) => path.join('docs', 'artifacts', 'v1.6', name));

const record = {
  ok: result.evidence.hasCockpit && result.evidence.hasDiagnostic,
  artifacts,
  evidence: result.evidence,
};

writeFileSync(path.join(artifactsDir, 'ui-acceptance.json'), JSON.stringify(record, null, 2));
rmSync(userDataDir, { recursive: true, force: true });
rmSync(fixtureDir, { recursive: true, force: true });

if (!record.ok) {
  throw new Error(JSON.stringify(record, null, 2));
}

console.log(JSON.stringify(record, null, 2));

async function seedFixture(client) {
  return evaluate(
    client,
    `
      (async () => {
        const suffix = new Date().toISOString();
        const normalProject = (await window.api.create_project({ name: 'V16 Normal ' + suffix, description: '驾驶舱正常态' })).data;
        const normalCore = (await window.api.create_resource({
          project_id: normalProject.id,
          title: 'V16 Hooks 主线',
          type: 'document',
          open_kind: 'record_only',
          path_or_url: null,
          cultivation_role: 'core',
          mastery_weight: 4,
          initial_progress_percent: 45,
          initial_progress_text: '读到 effect 清理',
          initial_next_action: '完成 useEffect 清理练习'
        })).data;
        await window.api.save_study_log({
          resource_id: normalCore.id,
          source: 'record_only',
          progress_percent: 55,
          progress_text: '完成 effect 清理复盘',
          next_action: '完成 useMemo 对比',
          duration_minutes: 45,
          evidence_type: 'note',
          resource_updated_at_before: normalCore.updated_at
        });
        const pendingResource = (await window.api.create_resource({
          project_id: normalProject.id,
          title: 'V16 Pending 文件',
          type: 'document',
          open_kind: 'file',
          path_or_url: ${JSON.stringify(filePath)},
          cultivation_role: 'supplement',
          initial_progress_percent: 10
        })).data;

        const readyProject = (await window.api.create_project({ name: 'V16 Ready ' + suffix, description: '可突破态' })).data;
        const readyCore = (await window.api.create_resource({
          project_id: readyProject.id,
          title: 'Ready 核心功法',
          type: 'document',
          open_kind: 'record_only',
          path_or_url: null,
          cultivation_role: 'core',
          initial_progress_percent: 100
        })).data;
        const readyTrial = (await window.api.create_resource({
          project_id: readyProject.id,
          title: 'Ready 突破试炼',
          type: 'exercise',
          open_kind: 'record_only',
          path_or_url: null,
          cultivation_role: 'trial',
          initial_progress_percent: 100
        })).data;
        await window.api.save_study_log({
          resource_id: readyCore.id,
          source: 'record_only',
          progress_percent: 100,
          progress_text: '核心通过',
          next_action: '尝试突破',
          duration_minutes: 60,
          evidence_type: 'assessment',
          resource_updated_at_before: readyCore.updated_at
        });
        await window.api.save_study_log({
          resource_id: readyTrial.id,
          source: 'record_only',
          progress_percent: 100,
          progress_text: '试炼通过',
          next_action: '尝试突破',
          duration_minutes: 60,
          evidence_type: 'practice',
          resource_updated_at_before: readyTrial.updated_at
        });

        const blockedProject = (await window.api.create_project({ name: 'V16 Blocked ' + suffix, description: '不可突破态' })).data;
        await window.api.create_resource({
          project_id: blockedProject.id,
          title: 'Blocked 核心未稳',
          type: 'document',
          open_kind: 'record_only',
          path_or_url: null,
          cultivation_role: 'core',
          initial_progress_percent: 30
        });

        const emptyProject = (await window.api.create_project({ name: 'V16 Empty ' + suffix, description: '空资源态' })).data;

        return {
          normalProjectName: normalProject.name,
          readyProjectName: readyProject.name,
          blockedProjectName: blockedProject.name,
          emptyProjectName: emptyProject.name,
          pendingResourceId: pendingResource.id
        };
      })()
    `,
  );
}

async function createPending(client, resourceId) {
  await evaluate(
    client,
    `
      (async () => {
        const result = await window.api.continue_resource({ resource_id: ${JSON.stringify(resourceId)} });
        if (result.ok && result.data.pending) return true;
        return result;
      })()
    `,
  );
}

async function clearPending(client) {
  await evaluate(
    client,
    `
      (async () => {
        const pending = (await window.api.get_pending_session()).data;
        if (pending) await window.api.abandon_pending_session(pending.id);
        return true;
      })()
    `,
  );
}

async function selectProject(client, projectName) {
  await evaluate(
    client,
    `
      (async () => {
        const button = Array.from(document.querySelectorAll('button')).find((item) => item.innerText.includes(${JSON.stringify(projectName)}));
        button?.click();
        await new Promise((resolve) => setTimeout(resolve, 500));
        return Boolean(button);
      })()
    `,
  );
}

async function openTab(client, tabId) {
  await evaluate(
    client,
    `
      (async () => {
        document.querySelector('#app-tab-${tabId}')?.click();
        await new Promise((resolve) => setTimeout(resolve, 500));
        return document.querySelector('#app-tab-${tabId}')?.getAttribute('aria-selected') === 'true';
      })()
    `,
  );
}

async function showLibraryError(client) {
  await evaluate(
    client,
    `
      (async () => {
        try {
          window.api.get_project_detail = async () => ({
            ok: false,
            error: { user_message: '验收模拟：资料库加载失败。', details: {}, code: 'VALIDATION_FAILED', recoverable: true }
          });
        } catch {}
        document.querySelector('#app-tab-library')?.click();
        await new Promise((resolve) => setTimeout(resolve, 900));
        return true;
      })()
    `,
  );
}

async function reloadAndWait(client) {
  await client.send('Page.reload');
  await waitForApi(client);
  await sleep(900);
}

async function setViewport(client, width, height, deviceScaleFactor) {
  await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor, mobile: false });
  await sleep(450);
}

async function screenshot(client, name) {
  const result = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(path.join(artifactsDir, name), Buffer.from(result.data, 'base64'));
}

async function withApp(port, userDataPath, work) {
  const child = spawn(resolveBin('electron'), [`--user-data-dir=${userDataPath}`, `--remote-debugging-port=${port}`, '.'], {
    cwd: root,
    env,
    stdio: 'ignore',
    shell: process.platform === 'win32',
    windowsHide: true,
  });

  try {
    const wsUrl = await waitForDebugger(port);
    const client = await connect(wsUrl);
    try {
      await waitForApi(client);
      return await work(client);
    } finally {
      await client.send('Browser.close').catch(() => undefined);
      client.close();
    }
  } finally {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/F', '/T', '/PID', String(child.pid)], { stdio: 'ignore' });
    } else {
      child.kill();
    }
    await sleep(800);
  }
}

function resolveBin(name) {
  return process.platform === 'win32' ? path.join(root, 'node_modules', '.bin', `${name}.cmd`) : path.join(root, 'node_modules', '.bin', name);
}

async function waitForDebugger(port) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // App is still booting.
    }
    await sleep(300);
  }
  throw new Error(`Timed out waiting for remote debugger on ${port}`);
}

async function waitForApi(client) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const ready = await evaluate(client, 'Boolean(window.api && window.api.create_project)', { awaitPromise: false });
    if (ready) return;
    await sleep(300);
  }
  throw new Error('Timed out waiting for window.api');
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    let id = 0;
    const timeout = setTimeout(() => reject(new Error('Timed out connecting to WebSocket')), 10_000);

    ws.onopen = () => {
      clearTimeout(timeout);
      resolve({
        send(method, params) {
          const messageId = ++id;
          ws.send(JSON.stringify({ id: messageId, method, params }));
          return new Promise((messageResolve, messageReject) => {
            const messageTimeout = setTimeout(() => {
              pending.delete(messageId);
              messageReject(new Error(`Timed out waiting for ${method}`));
            }, 15_000);
            pending.set(messageId, {
              resolve(value) {
                clearTimeout(messageTimeout);
                messageResolve(value);
              },
              reject(error) {
                clearTimeout(messageTimeout);
                messageReject(error);
              },
            });
          });
        },
        close() {
          ws.close();
        },
      });
    };
    ws.onerror = (event) => reject(new Error(`WebSocket error: ${event.message ?? 'unknown'}`));
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      const callbacks = pending.get(message.id);
      if (!callbacks) return;
      pending.delete(message.id);
      if (message.error) callbacks.reject(new Error(JSON.stringify(message.error)));
      else callbacks.resolve(message.result);
    };
  });
}

async function evaluate(client, expression, options = {}) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: options.awaitPromise ?? true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails));
  }
  return result.result.value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
