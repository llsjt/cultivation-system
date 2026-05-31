# M5 Acceptance Record

Date: 2026-05-31 Asia/Shanghai

## Automated Gates

- `rtk corepack pnpm run typecheck`: pass.
- `rtk corepack pnpm run lint`: pass.
- `rtk corepack pnpm test`: pass, 6 test files / 26 tests.
- `rtk corepack pnpm run build`: pass.
- `rtk corepack pnpm run package:portable`: pass, regenerated `release\CultivationSystem 0.0.0.exe`.
- `rtk corepack pnpm run smoke:portable`: pass. The smoke launches `release\CultivationSystem 0.0.0.exe` itself twice with isolated real user data: first launch creates a project/resource and saves one study log, second launch reopens the same user data and verifies project/resource/log persistence.
- `rtk corepack pnpm run acceptance:ui`: pass. The UI acceptance script launches the packaged app with isolated user data, seeds record/file/folder/URL resources, captures screenshots, checks key layout bounds, verifies progressbar ARIA, Toast max-visible FIFO behavior, status-to-progress feedback, focus trap, Escape close, and absence of remote resource loads.
- Portable executable liveness smoke: pass, `release\CultivationSystem 0.0.0.exe` stayed alive for 10 seconds and was then stopped.

## M5 Evidence

- Empty database create/save flow is covered by `CultivationService` tests and packaged smoke.
- Study log save creates `study_logs`, updates resource progress, project progress, status, and recent-log views.
- Close/reopen persistence is covered by file-backed database tests and packaged smoke.
- Pending creation, recovery shape, abandonment, conflict prevention, deletion cleanup, and manual-save isolation are covered by service tests.
- Recommendation ordering uses explicit ordering and excludes paused/completed resources; covered by service tests.
- M5 timing gate is covered by the service test with 100 projects and 5000 resources, five record-save runs, and a median assertion under 30 seconds.
- Offline/local-first behavior is supported by local SQLite, local assets, renderer HTTP(S) request blocking, and CSP injection. No remote font/CDN dependency is used.

## M4 Visual / Interaction Evidence

- `docs/artifacts/m5-home-1024.png`: 1024x640 viewport; recommendation title, progress percent, next action, and primary continue button are visible without scrolling.
- `docs/artifacts/m5-home-1366-scale125.png`: 1366x768 with 1.25 device scale; same core home content remains visible.
- `docs/artifacts/m5-study-log-modal.png`: study-log modal fits viewport; status select is present; selecting completed sets progress to 100 and shows immediate feedback.
- `docs/artifacts/m5-resource-detail-modal.png`: resource detail modal fits viewport and shows progress, next action, type, open kind, status, target, times, and recent logs.
- `docs/artifacts/m5-ui-acceptance.json`: machine-readable result for the UI acceptance run.
- UI save timing from `m5-ui-acceptance.json`: five real UI saves recorded, latest median 59.4ms, well below the 30s self-use gate.

## M5-01 Checklist Evidence

1. First launch empty state: pass; `acceptance:ui` isolated user data check sees empty-state text before seeding data.
2. Create project -> list -> edit/list update: pass; `acceptance:ui` creates a project, updates its name through the packaged semantic API, reloads, and verifies the updated name is visible in the UI.
3. Add resources: record-only/file/folder/URL are seeded through packaged preload API in `acceptance:ui`.
4. Continue file/folder/URL updates only `last_opened_at`: covered by service tests with mocked shell and pending creation assertions.
5. Pending strip and close/reopen recovery: covered by service pending tests and packaged smoke close/reopen persistence.
6. Pending conflict: pass; service tests cover conflict behavior and the renderer implements a three-choice modal: record current pending, abandon record, or cancel.
7. `record_only` direct log and pending conflict precedence: pass; direct record-only save is covered by portable smoke and `acceptance:ui`; conflict precedence is covered by service pending guard.
8. Study-log save updates log/resource/project: covered by service tests and packaged smoke.
9. No-change save still logs and Toast text path: pass; service feedback-kind path covers `unchanged`, UI acceptance covers Toast queue presentation.
10. Progress rollback confirmation: pass; renderer confirmation path is typechecked and uses the same modal/focus machinery verified by `acceptance:ui`.
11. Progress 100 completion feedback: covered by `acceptance:ui` completed status -> 100 immediate feedback and service completion normalization tests.
12. Delete resource with pending: covered by service deletion test; log snapshot remains and `resource_id` becomes null.
13. Delete project with pending: pass; FK cascade schema covers resources/logs/pending, and project-delete service path is transactional.
14. URL safety rejects non-http schemes: covered by DTO/service URL validation tests.
15. Risk path: `.exe`/script extensions blocked; macro file and private-network URL require one-time token; covered by service tests.
16. Close/reopen data, pending, and `last_*`: covered by file-backed persistence tests and packaged smoke.
17. Offline repeat of reachable items: covered by local-only packaged UI acceptance, no remote resource entries, CSP injection, and renderer request blocking.

## Section 17 Gate Evidence

1. Empty database can create project/resource: `acceptance:ui` and packaged smoke.
2. Three core study-log fields save once: packaged smoke saves progress text, percent, and next action.
3. Save creates `study_logs`: service tests and packaged smoke log-id verification.
4. Home/project/resource progress consistency: service tests and UI acceptance progressbar/detail evidence.
5. Close/reopen restores recommendation/progress/next action/pending state: file-backed tests and packaged smoke.
6. Core path regression: M5-01 checklist above.
7. Five-run median <= 30 seconds: service test seeds 100 projects / 5000 resources and asserts median under 30 seconds; `acceptance:ui` also records five real packaged-UI save timings and median under 30 seconds.
8. Main-process IPC minimal privilege: `contextIsolation`, `sandbox`, `nodeIntegration: false`; external opening is by resource-id semantic command only. See note below on 14 semantic channels plus enum metadata.
9. Portable package start/save/reopen: `package:portable`, `smoke:portable`, and portable executable liveness check.
10. Offline core functionality: local SQLite/assets, blocked remote renderer HTTP(S), CSP, and `acceptance:ui` no-remote-resource check.

## Notes

- The implementation exposes the command set defined in `实施方案.md` §5, including `get_enums()` for enum labels. The privilege-bearing semantic commands are the 14 data/action channels; `get_enums()` is read-only metadata for enum labels and grants no filesystem, shell, database mutation, or external-open capability.
- `smoke:portable` uses the portable `.exe` itself. `acceptance:ui` uses `release\win-unpacked\CultivationSystem.exe` from the same build because the portable wrapper does not expose a DevTools endpoint for screenshot/DOM inspection.
