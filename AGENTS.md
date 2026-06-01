@C:\Users\Lenovo\.codex\RTK.md

---
inclusion: always
---

# 项目执行规范（Cultivation System）

本文件是每次执行前默认读取的项目约定，遇到冲突以本文件为准。

Cultivation System 是一款**本地优先**的 Electron 桌面应用，用于管理长期学习方向、记录学习进展，
并通过"境界"等阶段反馈维持学习动力。修仙主题只是表达层，真实目标始终是**学习进度管理与动力反馈**——
任何取舍都优先保证真实操作含义，不要为了主题牺牲清晰度。

## 技术栈

- 运行环境：Electron 42 + electron-vite（main / preload / renderer 三端）
- 语言：TypeScript（`"type": "module"`，ESM）+ React 18
- 状态与数据：@tanstack/react-query、zustand、react-router-dom 6
- 表单与校验：react-hook-form + @hookform/resolvers + zod 3
- 数据库：SQLite + better-sqlite3 + Drizzle ORM（drizzle-kit 迁移）
- 样式：Tailwind CSS 3 + clsx + tailwind-merge，图标用 lucide-react
- 日志：pino；时间处理：dayjs；ID：uuid
- 测试：Vitest + @testing-library/react + jsdom，属性测试用 fast-check
- 打包：electron-builder
- 包管理器：pnpm@9.15.9（通过 corepack），**不要混用 npm / yarn**

## 目录与分层

```text
src/
  main/        主进程：db、domain、errors、ipc、logger、opener、repositories、services
  preload/     预加载脚本（api.ts，向 renderer 暴露受控接口）
  renderer/    React 渲染层：components、features、lib、App.tsx、main.tsx
  shared/      主/渲染共享：dto、enums、errors、纯计算（calc/derive/progress/realm/normalize）
  shared/types/ 全局类型声明（api.d.ts）
config/        所有构建/工具配置集中存放（vite、tsconfig、eslint、drizzle、tailwind、postcss）
drizzle/       迁移 SQL 与 meta（由 db:generate 生成，勿手改已生成迁移）
docs/          版本化需求与实施方案（见 docs/README.md 的版本管理规范）
```

分层原则（违反即视为设计错误）：

- `shared/` 只放纯逻辑与类型，不依赖 Electron / Node 运行时 API，可被主/渲染双向复用。
- 业务规则与持久化在 `main/`，调用链为 `service → repository → db`；渲染层不直接碰数据库。
- 跨进程通信一律走 IPC：renderer 经 preload 的 `api` 调用，**不在 renderer 直接 import 主进程模块**。

## 代码规范

- 严格 TypeScript：已开启 `noUnusedLocals`、`noUnusedParameters`、`verbatimModuleSyntax`、
  `noFallthroughCasesInSwitch`；仅用于类型的导入必须写 `import type { ... }`。
- 模块解析为 bundler 模式，允许带 `.ts` 扩展导入；保持 ESM 语法。
- 导入分组并以空行分隔：先 Node 内置（`node:` 前缀）/ 第三方，再项目内相对导入；组内按字母序。
- 命名约定：
  - 跨进程 DTO / 数据库字段 / IPC 入参出参用 `snake_case`（如 `project_id`、`progress_percent`）。
  - TypeScript 内部变量、函数、React 组件 props 用 `camelCase`；组件与类型用 `PascalCase`。
  - Drizzle schema 列名 `snake_case`，TS 字段名 `camelCase`（如 `progress_percent` ↔ `progressPercent`）。
- 校验与类型单一来源：用 zod schema 定义输入输出，再用 `z.infer` / `z.input` 导出类型，**不要手写重复类型**；
  入参对象用 `.strict()` 拒绝多余字段。
- 错误处理：业务错误抛 `AppError`（错误码见 `shared/errors.ts` 的 `ErrorCode`）；IPC 边界统一用
  `toAppErrorPayload` 转为 `AppErrorPayload`。新增错误码须同时补充 `ErrorMessages` 的中文文案与 `recoverable`。
- IPC 返回值统一为 `IpcResult<T>`（`{ ok: true, data }` 或 `{ ok: false, error }`）；
  渲染层用 `lib/ipc.ts` 的 `unwrap` / `unwrapResult` 解包，不要在组件里裸读 `ok` 字段。
- 用户可见文案统一中文，并贴合"修炼 / 出关 / 境界"主题，但不能牺牲真实操作含义。
- 样式优先 Tailwind 原子类，条件类名用 `clsx` + `tailwind-merge`，避免散落的内联样式。
- 注释解释"为什么"，不复述"做了什么"；保持函数短小、单一职责。

## 数据库与迁移

- schema 定义在 `src/main/db/schema.ts`，约束尽量用表级 `check` 表达，并与对应 zod 校验保持一致。
- 改 schema 后用 `pnpm db:generate` 生成迁移，再用 `pnpm db:migrate` 应用；**不要手改已生成的迁移 SQL**。
- better-sqlite3 是原生模块，且应用了 `patches/better-sqlite3@12.10.0.patch`：跑 Node/Vitest 前需
  `rebuild:node`，跑 Electron 前需 `rebuild:electron`（`dev` 与 `test` 脚本已分别内置对应 rebuild）。

## 常用命令（统一用 corepack pnpm）

```powershell
corepack pnpm install        # 安装依赖
corepack pnpm dev            # 启动开发版（先 rebuild:electron）
corepack pnpm typecheck      # tsc -b 类型检查
corepack pnpm lint           # eslint 检查（-c config/eslint.config.js）
corepack pnpm test           # vitest run（先 rebuild:node）
corepack pnpm run build      # 类型检查 + electron-vite 构建
corepack pnpm db:generate    # 生成 Drizzle 迁移
corepack pnpm db:migrate     # 应用迁移
```

注意：`dev`、`build` 等命令运行后会切换 better-sqlite3 的 ABI，跑测试前记得 `rebuild:node`。
开发服务器 / watch 类命令请在你自己的终端手动运行，不要由自动流程长期占用。

## 改动前后约定

- 改动后至少跑 `typecheck` 和相关 `test`；触及构建 / 打包再视情况验证。
- 新增功能或修复缺陷时补对应单测（测试与被测文件同目录或 `__tests__/`，命名 `*.test.ts(x)`）；
  纯计算逻辑（`shared/` 下的 calc/derive/progress/realm 等）优先用 fast-check 做属性测试。
- 文档遵循 `docs/README.md`：每个版本只保留一份需求分析与一份实施方案，旧版本归档只读，新范围进入下一版本。
- 保持本地优先边界：**不引入云同步、账号系统、在线分享或过重的游戏化系统**。

# Karpathy-inspired coding guardrails

Use these guidelines as a behavior overlay for software work. Apply them quietly by default; surface the reasoning only when it changes the plan, exposes ambiguity, or helps the user choose a tradeoff.

## Operating loop

1. Frame the goal before coding.
   - Restate the concrete outcome and success criteria.
   - Name material assumptions. Ask only when ambiguity could change the implementation or risk user data.
   - Present competing interpretations when the request can reasonably mean more than one thing.
   - Push back when the requested approach is likely to be more complex, fragile, or indirect than the goal requires.

2. Choose the simplest sufficient design.
   - Implement only the requested behavior.
   - Avoid speculative options, future-proof abstractions, generic frameworks, and configuration knobs.
   - Do not create an abstraction for one call site unless the local codebase already uses that pattern.
   - If the solution is growing much larger than the problem, pause and simplify before continuing.

3. Make surgical changes.
   - Inspect the relevant code path before editing.
   - Touch only files and lines that trace directly to the user request.
   - Match existing style, naming, error handling, and test patterns.
   - Clean up imports, variables, tests, and helpers made obsolete by your own change.
   - Mention unrelated dead code or design issues; do not fix them unless asked.

4. Verify against the goal.
   - Convert vague commands into checks: reproduce the bug, make the failing test pass, run the focused test, or inspect the changed behavior.
   - For fixes, prefer a regression test when practical.
   - For refactors, check behavior before and after when possible.
   - If verification cannot be run, state the specific blocker and the residual risk.

## Task patterns

For implementation requests:

- Find the entry point and existing local pattern.
- Define the smallest behavior change.
- Edit narrowly.
- Run the most relevant verification.
- Summarize the changed files and checks.

For bug fixes:

- Identify the failing path.
- Reproduce with a test or direct command if practical.
- Fix the root cause without broad rewrites.
- Verify the reproduction now passes.

For reviews:

- Lead with concrete bugs, regressions, risks, and missing tests.
- Reference files, functions, classes, config keys, and lines when possible.
- Keep summary secondary to findings.

## Calibration

Use lighter rigor for obvious one-line changes. Use full rigor when the task touches shared code, migrations, auth, billing, concurrency, data deletion, public APIs, or user-facing workflows.

These guidelines complement project instructions and explicit user requests. Follow higher-priority system, developer, AGENTS.md, and repository rules first.
