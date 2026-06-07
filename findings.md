# v1.7 执行发现

## 已确认

- 当前目标为：严格按照实施方案 1.7 执行，直到方案完全执行完毕。
- 项目补充规范要求 shell 命令使用 `rtk` 前缀；PowerShell cmdlet 需通过 `rtk powershell -NoProfile -Command "..."` 执行。
- `planning-with-files-zh` skill 适用于本次长任务，要求维护 `task_plan.md`、`findings.md`、`progress.md`。
- M0 基线：`rtk corepack pnpm run typecheck` 通过。
- M0 基线：`rtk corepack pnpm run test` 在 `rebuild:node` 阶段失败，原因是运行中的 Electron/Node 进程占用 `better_sqlite3.node`，导致 `EBUSY/EPERM`。
- Drizzle `_journal.json` 登记了 `0000_mute_spirit`、`0001_pending_close_time`、`0002_realm_breakthrough`，但原先仅存在 `0000_snapshot.json`。
- Git 历史中 `ac34370` 是初始 0000 节点，`f3b8e6d` 同时包含 0001/0002，未找到逐迁移节点，因此按方案使用临时 worktree 兜底路径恢复 snapshot。
- 已补回 `drizzle/meta/0001_snapshot.json` 与 `drizzle/meta/0002_snapshot.json`；随后执行 `rtk corepack pnpm run db:generate`，结果为无 schema 变化。
- M1 IPC/DTO：`select_local_file` 已纳入通用 typed `register`；`router.ts` 中 `input as` / `as never` 检查无结果。
- M1 IPC/DTO：pending session closed event 已在 preload 边界用 `PendingSessionClosedEventSchema` 解析，非法 payload 不回调。
- M1 IPC/DTO：`get_home_overview`、`get_project_detail`、`get_project_cultivation`、`save_study_log` 已接入 output schema。
- M2 repository：已新增 `ProjectRepository`、`ResourceRepository`、`StudyLogRepository`、`PendingSessionRepository`、`BreakthroughAttemptRepository` 和 `cultivationMappers.ts`。
- M2 repository：`CultivationService` 保留 `guardWrite` 事务边界，但核心 SQL/row 映射已迁到 repository/mapper。
- M2 聚合 API：已新增 `get_global_resources` DTO/API/preload/router/service/repository 垂直切片，并接入 output schema。

## 待核对

- v1.7 文档入口与版本索引是否满足 M0 验收。
- 当前工作区已有文档相关未提交变动，需要确认均属于 v1.7 范围。
- 运行中的 Electron/Node 进程需在最终全量测试前释放，否则 `better-sqlite3` rebuild 仍可能失败。
- M2 验证时已结束项目 Electron 进程并执行 `rtk corepack pnpm run rebuild:node`，Node ABI 测试恢复可运行。
## Final findings 2026-06-07

- `acceptance:ui:v1.6` initially failed before business assertions because sandbox preload could not load externalized `zod`; `window.api` was never exposed.
- CDP diagnostics confirmed the production page loaded `out/renderer/index.html`, then logged `Unable to load preload script` and `module not found: zod`.
- Fix: `src/preload/api.ts` now uses a local narrow validator for `pending_session_closed` events and imports DTOs type-only.
- `acceptance:ui:v1.6` passed after rebuilding production output and running with Electron ABI.
- Last `pnpm run test` switches `better-sqlite3` back to Node ABI; manual Electron launch after this still requires `rebuild:electron` or the `dev` script.
