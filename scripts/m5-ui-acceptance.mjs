import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exe = path.join(root, 'release', 'win-unpacked', 'CultivationSystem.exe');
const artifactsDir = path.join(root, 'docs', 'artifacts');
mkdirSync(artifactsDir, { recursive: true });

const userDataDir = mkdtempSync(path.join(tmpdir(), 'cultivation-m5-ui-'));
const fixtureDir = mkdtempSync(path.join(tmpdir(), 'cultivation-m5-fixture-'));
const filePath = path.join(fixtureDir, 'lesson.txt');
const folderPath = path.join(fixtureDir, 'folder');
mkdirSync(folderPath, { recursive: true });
writeFileSync(filePath, 'lesson');

const result = await withApp(9460, userDataDir, async (client) => {
  const evidence = {};

  await sleep(800);
  evidence.emptyState = await evaluate(client, `document.body.innerText.includes('暂无方向') || document.body.innerText.includes('暂无资料')`, { awaitPromise: false });

  const seed = await evaluate(
    client,
    `
      (async () => {
        const suffix = new Date().toISOString();
        const project = (await window.api.create_project({ name: 'M5 UI ' + suffix, description: 'visual acceptance' })).data;
        const updatedProject = (await window.api.update_project(project.id, { name: 'M5 UI updated ' + suffix, description: 'visual acceptance' })).data;
        const record = (await window.api.create_resource({
          project_id: project.id,
          title: 'UI acceptance record',
          type: 'document',
          open_kind: 'record_only',
          path_or_url: null,
          initial_progress_percent: 10,
          initial_next_action: 'Finish visual acceptance'
        })).data;
        await window.api.create_resource({
          project_id: project.id,
          title: 'UI acceptance file',
          type: 'document',
          open_kind: 'file',
          path_or_url: ${JSON.stringify(filePath)},
          initial_progress_percent: 0
        });
        await window.api.create_resource({
          project_id: project.id,
          title: 'UI acceptance folder',
          type: 'document',
          open_kind: 'folder',
          path_or_url: ${JSON.stringify(folderPath)},
          initial_progress_percent: 0
        });
        await window.api.create_resource({
          project_id: project.id,
          title: 'UI acceptance URL',
          type: 'web',
          open_kind: 'url',
          path_or_url: 'https://example.com/course',
          initial_progress_percent: 0
        });
        await window.api.save_study_log({
          resource_id: record.id,
          source: 'record_only',
          progress_percent: 50,
          progress_text: 'Halfway through UI acceptance',
          next_action: 'Finish visual acceptance',
          resource_updated_at_before: record.updated_at
        });
        return { projectId: project.id, projectName: updatedProject.name, resourceId: record.id };
      })()
    `,
  );

  await reloadAndWait(client);
  await setViewport(client, 1024, 640, 1);
  evidence.home1024 = await inspectHome(client);
  evidence.projectEditVisible = await evaluate(client, `document.body.innerText.includes(${JSON.stringify(seed.projectName)})`, { awaitPromise: false });
  await screenshot(client, 'm5-home-1024.png');

  await setViewport(client, 1366, 768, 1.25);
  evidence.home125 = await inspectHome(client);
  await screenshot(client, 'm5-home-1366-scale125.png');

  evidence.buttonLabels = await evaluate(
    client,
    `(() => {
      const text = Array.from(document.querySelectorAll('button')).map((button) => button.innerText || button.getAttribute('aria-label') || '').join('\\n');
      return {
        continueHasRealAction: text.includes('打开资料继续学习'),
        logHasRealAction: text.includes('保存本次学习进度')
      };
    })()`,
  );

  evidence.progressbars = await evaluate(
    client,
    `Array.from(document.querySelectorAll('[role="progressbar"]')).map((bar) => ({
      now: bar.getAttribute('aria-valuenow'),
      text: bar.innerText.trim()
    }))`,
  );

  evidence.noRemoteResources = await evaluate(
    client,
    `performance.getEntriesByType('resource').filter((entry) => /^https?:/.test(entry.name)).map((entry) => entry.name)`,
  );

  await openStudyLogModal(client);
  evidence.studyLogModal = await inspectModal(client);
  evidence.statusSelect = await evaluate(
    client,
    `(() => {
      const select = Array.from(document.querySelectorAll('.modal select')).find((item) => Array.from(item.options).some((option) => option.value === 'completed'));
      select.value = 'completed';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return {
        hasCompleted: Boolean(select),
        progressValue: document.querySelector('.modal input[type="number"]')?.value,
        hint: document.querySelector('.field-hint')?.innerText ?? ''
      };
    })()`,
  );
  evidence.focusTrap = await testFocusTrap(client);
  await screenshot(client, 'm5-study-log-modal.png');

  evidence.escapeClosesModal = await evaluate(
    client,
    `(async () => {
      const modal = document.querySelector('.modal');
      modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 120));
      return !document.querySelector('.modal');
    })()`,
  );

  evidence.uiTiming = await runUiTiming(client);

  evidence.toastQueue = await evaluate(
    client,
    `
      (async () => {
        const setValue = (input, value) => {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          setter.call(input, value);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        };
        const form = document.querySelector('.side-panel form');
        const input = form.querySelector('input');
        for (let index = 0; index < 4; index += 1) {
          setValue(input, 'Toast FIFO ' + index + ' ' + Date.now());
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          await new Promise((resolve) => setTimeout(resolve, 120));
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
        const visible = Array.from(document.querySelectorAll('.toast')).map((toast) => toast.innerText.trim());
        return { visibleCount: visible.length, visible };
      })()
    `,
  );

  const detailOpened = await evaluate(
    client,
    `(() => {
      const button = Array.from(document.querySelectorAll('button')).find((item) => item.innerText.trim() === '详情');
      button?.click();
      return Boolean(button);
    })()`,
  );
  await sleep(700);
  evidence.detailModal = detailOpened ? await inspectModal(client) : { opened: false };
  await screenshot(client, 'm5-resource-detail-modal.png');

  evidence.seed = seed;
  return evidence;
});

const failures = [];
if (!result.emptyState) failures.push('empty state text');
if (!result.home1024.ok) failures.push(`home 1024 layout: ${JSON.stringify(result.home1024)}`);
if (!result.home125.ok) failures.push(`home 125% layout: ${JSON.stringify(result.home125)}`);
if (!result.projectEditVisible) failures.push('project edit/list update');
if (!result.buttonLabels.continueHasRealAction || !result.buttonLabels.logHasRealAction) failures.push('real-action button labels');
if (result.progressbars.length === 0 || result.progressbars.some((bar) => !bar.text.includes('%') || bar.now === null)) failures.push('progressbar text/aria');
if (result.noRemoteResources.length > 0) failures.push(`remote resources: ${result.noRemoteResources.join(', ')}`);
if (!result.studyLogModal.ok || !result.statusSelect.hasCompleted || result.statusSelect.progressValue !== '100') failures.push('study log modal/status normalization');
if (!result.focusTrap) failures.push('focus trap');
if (!result.escapeClosesModal) failures.push('escape closes modal');
if (!result.uiTiming.ok) failures.push(`ui timing median: ${JSON.stringify(result.uiTiming)}`);
if (result.toastQueue.visibleCount > 3) failures.push('toast max visible count');
if (!result.detailModal.ok) failures.push(`resource detail modal: ${JSON.stringify(result.detailModal)}`);

const record = {
  ok: failures.length === 0,
  failures,
  artifacts: [
    'docs/artifacts/m5-home-1024.png',
    'docs/artifacts/m5-home-1366-scale125.png',
    'docs/artifacts/m5-study-log-modal.png',
    'docs/artifacts/m5-resource-detail-modal.png',
  ],
  evidence: result,
};

writeFileSync(path.join(artifactsDir, 'm5-ui-acceptance.json'), JSON.stringify(record, null, 2));
rmSync(userDataDir, { recursive: true, force: true });
rmSync(fixtureDir, { recursive: true, force: true });

if (!record.ok) {
  throw new Error(JSON.stringify(record, null, 2));
}

console.log(JSON.stringify(record, null, 2));

async function inspectHome(client) {
  return evaluate(
    client,
    `(() => {
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const selectors = ['.hero-panel h2', '.hero-panel [role="progressbar"]', '.hero-panel .next-action', '.hero-panel .primary-button'];
      const items = selectors.map((selector) => {
        const element = document.querySelector(selector);
        if (!element) return { selector, exists: false };
        const rect = element.getBoundingClientRect();
        return {
          selector,
          exists: true,
          text: element.innerText,
          rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
          visible: rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.left >= 0 && rect.bottom <= viewport.height && rect.right <= viewport.width
        };
      });
      return {
        viewport,
        items,
        ok: items.every((item) => item.exists && item.visible),
        bodyScrollY: document.scrollingElement.scrollTop
      };
    })()`,
  );
}

async function inspectModal(client) {
  return evaluate(
    client,
    `(() => {
      const modal = document.querySelector('.modal');
      if (!modal) return { ok: false, reason: 'missing modal' };
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const rect = modal.getBoundingClientRect();
      const children = Array.from(modal.children).map((child) => {
        const childRect = child.getBoundingClientRect();
        return { top: childRect.top, bottom: childRect.bottom, left: childRect.left, right: childRect.right, width: childRect.width, height: childRect.height };
      });
      const inViewport = rect.top >= 0 && rect.left >= 0 && rect.bottom <= viewport.height && rect.right <= viewport.width;
      const ordered = children.every((child, index) => index === 0 || child.top + 2 >= children[index - 1].bottom);
      return { ok: inViewport && ordered, inViewport, ordered, rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right }, text: modal.innerText.slice(0, 300) };
    })()`,
  );
}

async function openStudyLogModal(client) {
  const opened = await evaluate(
    client,
    `(() => {
      const button = Array.from(document.querySelectorAll('button')).find((item) => item.innerText.includes('保存本次学习进度'));
      button?.click();
      return Boolean(button);
    })()`,
  );
  if (!opened) {
    throw new Error('Could not find study log button');
  }
  await sleep(700);
}

async function testFocusTrap(client) {
  return evaluate(
    client,
    `(() => {
      const modal = document.querySelector('.modal');
      const focusable = Array.from(modal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      last.focus();
      last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      return document.activeElement === first;
    })()`,
  );
}

async function runUiTiming(client) {
  return evaluate(
    client,
    `
      (async () => {
        const setValue = (element, value) => {
          const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
          setter.call(element, value);
          element.dispatchEvent(new Event('input', { bubbles: true }));
        };
        const timings = [];
        for (let index = 0; index < 5; index += 1) {
          const openButton = Array.from(document.querySelectorAll('button')).find((item) => item.innerText.includes('保存本次学习进度'));
          openButton.click();
          await new Promise((resolve) => setTimeout(resolve, 250));
          const modal = document.querySelector('.modal');
          const textareas = modal.querySelectorAll('textarea');
          const progressInput = modal.querySelector('input[type="number"]');
          setValue(textareas[0], 'UI timed save ' + index);
          setValue(progressInput, String(51 + index));
          setValue(textareas[1], 'UI timing next ' + index);
          const saveButton = Array.from(modal.querySelectorAll('button')).find((item) => item.type === 'submit');
          const before = performance.now();
          saveButton.click();
          const deadline = performance.now() + 30000;
          while (performance.now() < deadline) {
            if (!document.querySelector('.modal') && Array.from(document.querySelectorAll('.toast')).some((toast) => toast.innerText.includes('已记录本次学习'))) {
              timings.push(performance.now() - before);
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        const sorted = [...timings].sort((a, b) => a - b);
        return { ok: timings.length === 5 && sorted[2] <= 30000, timingsMs: timings, medianMs: sorted[2] ?? null };
      })()
    `,
  );
}

async function reloadAndWait(client) {
  await client.send('Page.reload');
  await waitForApi(client);
  await sleep(800);
}

async function setViewport(client, width, height, deviceScaleFactor) {
  await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor, mobile: false });
  await sleep(500);
}

async function screenshot(client, name) {
  const result = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(path.join(artifactsDir, name), Buffer.from(result.data, 'base64'));
}

async function withApp(port, userDataPath, work) {
  const child = spawn(exe, [`--user-data-dir=${userDataPath}`, `--remote-debugging-port=${port}`], {
    cwd: root,
    stdio: 'ignore',
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
    await sleep(1000);
  }
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
      // Still booting.
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
