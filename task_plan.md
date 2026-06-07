# v1.7 执行计划

目标：严格按照 `docs/versions/v1.7/实施方案.v1.7.md` 完成 v1.7，直到满足完成定义。

## 当前阶段

- M0 范围冻结：进行中
- M1 IPC 与迁移边界：待开始
- M2 主进程 repository：待开始
- M3 App 与 workbench：待开始
- M4 资源与资料库 UI 分层：待开始
- M5 通用工具与防漂移：待开始
- M6 回归与归档：待开始

## 执行约束

- 按 M0 到 M6 顺序推进；Drizzle snapshot 前置项未解决前不进入 schema 结构优化或新迁移。
- 不改变 v1.6 已有用户路径和文案语义。
- repository 只承接 SQL/row/projection，不承接业务语义、事务、AppError 或 IPC DTO。
- 展示组件不得直接访问 `window.api`，只允许方案列出的 hook/action 文件访问。
- 每个阶段完成后更新 `progress.md`，重要发现写入 `findings.md`。

## 阶段清单

1. M0：核对 v1.7 文档入口，运行 `typecheck` 和 `test` 基线。
2. M1：补齐 select file DTO、pending event schema、strict input、router output schema，并恢复 Drizzle snapshot。
3. M2：建立 repositories，迁移 service 中核心 SQL/row 映射，新增 `get_global_resources`。
4. M3：抽出 `features/workbench`，让 `App.tsx` 退回 shell。
5. M4：拆分资源管理面板与全局资料库，收敛请求 hook、状态矩阵与 a11y 测试。
6. M5：抽通用弹窗、日期格式化和 UI class helper，补 shared 去原生依赖与 enum 防漂移测试。
7. M6：运行 focused、全量和 UI acceptance 验证，写 `docs/artifacts/v1.7/acceptance-summary.md`。
## Final status 2026-06-07

- M0 completed.
- M1 completed.
- M2 completed.
- M3 completed.
- M4 completed.
- M5 completed.
- M6 completed.
- Final acceptance summary: `docs/artifacts/v1.7/acceptance-summary.md`.
