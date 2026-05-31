# Cultivation System

本地学习进度记录工具。当前交付目标按根目录 `实施方案.md` 的自用 MVP 门槛推进：用 SQLite 在本地保存项目、资料、出关记录和待记录会话，并在首页恢复最应该继续的资料。

## 当前能力

- 创建、编辑、删除修炼方向。
- 创建、编辑、删除学习资料，支持 `record_only`、文件、文件夹和网页链接入口。
- 首页推荐可继续资料，展示资料名、进度、所属方向和下次闭关目标。
- `继续闭关：打开资料继续学习` 成功后创建待出关记录，重开后从首页提示条恢复。
- `出关记录：保存本次学习进度` 会同步更新资料进度、项目状态、项目进度、最近出关时间和 `study_logs`。
- 放弃待出关记录不会生成日志，也不会更新进度、下一步目标或最近出关时间。
- 主进程封装 IPC 错误信封；渲染进程只能通过 preload 暴露的语义命令访问能力。
- 启动迁移前保留迁移备份，完整性检查通过后按 7 天间隔保留常规备份。
- portable 包已验证能启动，`better-sqlite3` 已按 Electron ABI 重建并随包携带。

## 常用验证

```powershell
rtk corepack pnpm typecheck
rtk corepack pnpm lint
rtk corepack pnpm test
rtk corepack pnpm run build
```

最近一次结果：

- `typecheck` 通过。
- `lint` 通过。
- `test` 通过：6 个测试文件，26 个测试。
- `build` 通过，preload 产物为 `out\preload\api.cjs`。

## 打包

正式 portable 打包入口：

```powershell
rtk corepack pnpm run package:portable
```

打包后可跑 packaged 冒烟：

```powershell
rtk corepack pnpm run smoke:portable
```

产物：

- `release\CultivationSystem 0.0.0.exe`
- `release\win-unpacked\CultivationSystem.exe`

注意：`package:portable` 会把 `better-sqlite3` 重建为 Electron ABI。打包后若要继续运行 Node/Vitest 测试，需要切回 Node ABI：

```powershell
rtk corepack pnpm run rebuild:node
```

## 已知非阻断项

- 当前仍使用默认 Electron 图标，适合自用 MVP，不作为 M5 阻断。
- `package.json` 缺少 `description` / `author`，electron-builder 会给出 warning，但不影响 portable 生成和启动。
