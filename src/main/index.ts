import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { BrowserWindow, Menu, app, shell, session, nativeTheme } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';

import { openDatabase, type SqliteDatabase } from './db/connection';
import { migrateDatabase } from './db/migrate';
import { registerIpcHandlers } from './ipc/router';
import { logger } from './logger';
import { CultivationService } from './services/cultivationService';

let mainWindow: BrowserWindow | null = null;
let db: SqliteDatabase | null = null;

configureUserDataPathOverride();

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.focus();
  });

  app.whenReady().then(bootstrap).catch((error: unknown) => {
    logger.error({ err: error }, 'bootstrap failed');
    createDiagnosticWindow();
  });
}

async function bootstrap(): Promise<void> {
  const userDataPath = app.getPath('userData');
  db = openDatabase(userDataPath);
  migrateDatabase(db, userDataPath);
  const service = new CultivationService(db, {
    onPendingSessionClosed: (pending) => {
      mainWindow?.webContents.send('event:pending_session_closed', pending);
    },
  });
  const smokeOutputPath = getSmokeOutputPath();

  if (smokeOutputPath) {
    runCommandLineSmoke(service, smokeOutputPath, userDataPath);
    db.close();
    db = null;
    app.quit();
    return;
  }

  registerIpcHandlers(service);
  blockRendererNetworkRequests();
  configureApplicationMenu();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}

function getSmokeOutputPath(): string | null {
  return getCommandLineValue('--cultivation-smoke=');
}

function configureUserDataPathOverride(): void {
  const userDataPath = getCommandLineValue('--user-data-dir=');

  if (userDataPath) {
    app.setPath('userData', userDataPath);
  }
}

function getCommandLineValue(prefix: string): string | null {
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function runCommandLineSmoke(service: CultivationService, outputPath: string, userDataPath: string): void {
  if (existsSync(outputPath)) {
    const saved = JSON.parse(readFileSync(outputPath, 'utf8')) as { projectId: string; resourceId: string; logId: string };
    const project = service.getProjectDetail({ project_id: saved.projectId }).project;
    const resource = service.getResourceDetail(saved.resourceId);
    const overview = service.getHomeOverview();
    const verified = project.progress_percent === 50 && resource.progress_percent === 50 && resource.next_action === 'Reopen and verify';

    writeFileSync(
      outputPath,
      JSON.stringify(
        {
          ...saved,
          verified,
          userDataPath,
          recentLogRestored: overview.recent_logs.some((log) => log.id === saved.logId),
          verifiedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    return;
  }

  const suffix = new Date().toISOString();
  const project = service.createProject({ name: `Portable smoke ${suffix}`, description: 'portable smoke' });
  const resource = service.createResource({
    project_id: project.id,
    title: `Portable smoke resource ${suffix}`,
    type: 'document',
    open_kind: 'record_only',
    path_or_url: null,
    initial_progress_percent: 0,
    initial_next_action: 'Save one study log',
  });
  const saved = service.saveStudyLog({
    resource_id: resource.id,
    source: 'record_only',
    progress_percent: 50,
    progress_text: 'Portable smoke saved progress',
    next_action: 'Reopen and verify',
    resource_updated_at_before: resource.updated_at,
  });

  writeFileSync(
    outputPath,
    JSON.stringify(
      {
        projectId: project.id,
        resourceId: resource.id,
        logId: saved.log.id,
        userDataPath,
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}

function configureApplicationMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [{ role: 'quit', label: '退出' }],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'delete', label: '删除' },
        { type: 'separator' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '切换全屏' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'close', label: '关闭窗口' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function getAppIconPath(): string {
  return app.isPackaged ? join(process.resourcesPath, 'icon.png') : join(process.cwd(), 'build', 'icon.png');
}

function createMainWindow(): void {
  nativeTheme.themeSource = 'dark';

  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: '#06110f',
    icon: getAppIconPath(),
    titleBarStyle: 'hidden',
    ...(process.platform !== 'darwin'
      ? {
          titleBarOverlay: {
            color: '#06110f00',
            symbolColor: '#d8fff2',
            height: 44,
          },
        }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/api.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setAutoHideMenuBar(true); // 默认隐藏白色的菜单栏，按下 Alt 可临时呼出

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void shell.openExternal(url);
    }

    return { action: 'deny' };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

function blockRendererNetworkRequests(): void {
  const devRendererUrl = process.env.ELECTRON_RENDERER_URL;
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (devRendererUrl && details.url.startsWith(devRendererUrl)) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });

  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const requestUrl = details.url;
    if (devRendererUrl && requestUrl.startsWith(devRendererUrl)) {
      callback({});
      return;
    }

    if (requestUrl.startsWith('http://') || requestUrl.startsWith('https://')) {
      callback({ cancel: true });
      return;
    }
    callback({});
  });
}

function createDiagnosticWindow(): void {
  nativeTheme.themeSource = 'dark';

  const window = new BrowserWindow({
    width: 720,
    height: 420,
    backgroundColor: '#0b0e0f',
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  const html = encodeURIComponent(`
    <main style="font-family: system-ui; padding: 32px; line-height: 1.6">
      <h1>数据升级未完成</h1>
      <p>应用已停止启动以保护本地学习记录。请检查应用数据目录中的数据库与 backups 目录，或从最近备份恢复。</p>
    </main>
  `);
  void window.loadURL(`data:text/html;charset=utf-8,${html}`);
}

app.on('window-all-closed', () => {
  db?.close();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});
