# v1.6 验收摘要

日期：2026-06-06
状态：完成

## 需求状态

| 需求 | 状态 | 验收要点 |
| --- | --- | --- |
| REQ16-01 当前学习页升级为驾驶舱 | 完成 | 当前学习页改为驾驶舱，首屏包含推荐、诊断、法门概览和资源推进。 |
| REQ16-02 pending 待出关优先级提升 | 完成 | pending 在驾驶舱置顶，支持记录和放弃。 |
| REQ16-03 推荐卡升级为恢复学习现场 | 完成 | 推荐卡展示资料定位、进度、最近出关、理由和下次目标。 |
| REQ16-04 新增法门概览摘要 | 完成 | `ProjectCultivationStrip` 展示境界、进度、资源和出关摘要。 |
| REQ16-05 新增突破诊断摘要卡 | 完成 | 摘要卡与完整诊断页共用诊断 helper。 |
| REQ16-06 资源定位和权重可见 | 完成 | 资源列表、详情、编辑和全局藏经阁使用统一 role/weight 文案。 |
| REQ16-07 有效学习时间诊断 | 完成 | 120 分钟目标、180 分钟单条上限、缺时长和封顶诊断已进入 DTO/service/shared 测试。 |
| REQ16-08 视觉主题收敛 | 完成 | tab、HUD 面板、状态色、focus、reduced motion 已接入并截图验收。 |
| REQ16-09 低风险展示组件拆分 | 完成 | 仅拆展示组件，App 继续持有业务状态和 IPC 调度。 |
| REQ16-10 完整突破诊断页重排 | 完成 | `ProjectStatsPanel` 以诊断优先，不可突破按钮真实禁用。 |
| REQ16-11 统计页真实复盘增强 | 完成 | 统计页新增近 14 天有效学习、最近出关、进度分布、需回访方向。 |
| REQ16-12 出关时长语义优化 | 完成 | 出关表单语义改为“有效学习时长”，pending 自动填充可编辑。 |
| REQ16-13 保存后驾驶舱闭环回显 | 完成 | 保存日志后驾驶舱保留进度变化、时长、下次目标和反馈。 |
| REQ16-14 系统类漫画 UI 产品化规范 | 完成 | HUD 面板、芯片、按钮、移动布局和 reduced motion 通过截图验收。 |
| REQ16-15 前端 ViewModel 和组件契约 | 完成 | 新驾驶舱组件不直接调用 `window.api`；推荐、诊断、资源展示都有纯函数测试。 |

## 命令结果

| 命令 | 结果 | 备注 |
| --- | --- | --- |
| `rtk corepack pnpm run typecheck` | PASS | `tsc -b` 通过，记录见 `typecheck.log`。 |
| `rtk corepack pnpm run test` | PASS | 14 个测试文件、70 个用例通过，记录见 `test.log`。 |
| `rtk corepack pnpm run lint` | PASS | React purity / hooks 规则通过。 |
| `rtk corepack pnpm run build` | PASS | main、preload、renderer 三端构建通过。 |
| `rtk corepack pnpm run build:renderer` | PASS | 当前脚本映射为完整 `electron-vite build`，构建通过。 |
| `rtk corepack pnpm run acceptance:ui:v1.6` | PASS | 生成十张固定截图和 `ui-acceptance.json`。 |

补充聚焦回归：

- shared/main：`src/shared/realm.test.ts`、`src/shared/dto.test.ts`、`src/main/__tests__/cultivationService.test.ts` 通过。
- renderer：`src/renderer/App.test.tsx`、`cockpitViewModel.test.ts`、`cultivationDiagnostics.test.ts`、`resourceDisplay.test.ts`、`ResourceManagementPanel.test.tsx`、`GlobalLibrary.test.tsx` 通过。

## 截图证据

- `ui-1280x720-normal.png`
- `ui-1024x640-normal.png`
- `ui-390x844-normal.png`
- `ui-1280x720-pending.png`
- `ui-390x844-pending.png`
- `ui-1280x720-breakthrough-ready.png`
- `ui-1280x720-breakthrough-blocked.png`
- `ui-390x844-empty-resource.png`
- `ui-390x844-error-state.png`
- `ui-1280x720-reduced-motion.png`

目检结果：桌面双栏、移动单列、pending、空态、错误态、可突破态均无空白渲染；390px 下按钮和 tabs 未出现明显重叠。

## 测试文件清单

新增：

- `src/renderer/features/projects/cockpitViewModel.test.ts`
- `src/renderer/features/projects/cultivationDiagnostics.test.ts`
- `src/renderer/features/resources/resourceDisplay.test.ts`
- `src/renderer/features/resources/ResourceManagementPanel.test.tsx`
- `src/renderer/features/resources/GlobalLibrary.test.tsx`

更新：

- `src/shared/realm.test.ts`
- `src/shared/dto.test.ts`
- `src/main/__tests__/cultivationService.test.ts`
- `src/renderer/App.test.tsx`

## 已知风险

- `GlobalLibrary` 仍保留既有“按项目拉详情”的容器例外；v1.6 未扩散到新驾驶舱组件。
- `acceptance:ui:v1.6` 通过，但 Node 对 `.cmd` shell 启动输出 DEP0190 警告；当前为脚本启动方式风险，不影响验收结果。
- `build:renderer` 因 electron-vite 2.3.0 无可用 renderer-only 参数，当前映射为完整 `electron-vite build`。
- UI 验收结束后 `better-sqlite3` 处于 Electron ABI；`pnpm test` 脚本会自动先 `rebuild:node`。

## v1.7 候选

- 收敛 `GlobalLibrary` 的聚合资料查询，避免逐项目详情 IPC。
- 为 `CurrentStudyCockpit` 关键状态补组件级交互测试。
- 将 UI acceptance 脚本的 Electron 启动方式改为免 shell 参数拼接，消除 DEP0190。
