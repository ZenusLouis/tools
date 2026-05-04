# Implementation

## Latest Update - BRD-Traceable Analysis + Model Dropdown

- Added `Task.reqIds` with Prisma migration `20260429121500_task_req_ids`, and threaded requirement IDs through analyze result parsing, task creation, task board cards, task detail panels, project detail, and generated backlog review.
- Updated local bridge analysis to extract PDF text with `pdftotext -layout`, log extracted character/page estimates, detect `CORE-*`, `CIN-*`, `HOT-*`, `CROSS-*`, and `UI-*` requirement groups, and stop with a clear error if PDF extraction fails instead of inventing a filename-based backlog.
- Changed local Claude analysis to attach the extracted document context through stdin instead of passing the full prompt as a Windows command-line argument, fixing `[WinError 206] The filename or extension is too long` for full BRDs.
- Updated the Claude analysis prompt to require BRD-traceable modules/tasks and `reqIds`, with OmniBooking domains such as Core Platform, Cinema Booking, Hotel Booking, Cross-domain Payment/Refund/State, and UI/Operations when those IDs exist in the BRD.
- Changed dashboard analysis to prefer the local bridge for local document paths, so the local machine hands full extracted BRD context to Claude instead of the hosted dashboard trying to read a Windows path.
- Added `/api/models` for provider-aware model discovery: curated static models are always available, and OpenAI/Anthropic model lists are fetched when the workspace has the matching encrypted API key.
- Replaced the free-text `MODEL / VERSION` field in Create/Edit Role with a provider-aware dropdown. Changing provider resets incompatible models and persists the selected value to `AgentRole.defaultModel`.

## Checks

- `pdftotext -layout D:\Code\OmniBooking\docx\BRD_OmniBooking_Requirement_Deep_Dive_FINAL6.pdf -` detected `CORE-*`, `CIN-*`, `HOT-*`, `CROSS-*`, and UI/cross-domain requirement content.
- `claude -p --input-format text` with a 100k-character stdin prompt returned successfully.
- `python -m py_compile hooks/gcs_bridge_daemon.py`
- `npx prisma generate`
- `npx prisma migrate deploy`
- `npm run lint`
- `npm run build`

## Latest Update - Projectless Chat/Log Activity

- Activity rows now know whether their `project` value maps to a real dashboard project.
- Dashboard Activity Log and top-bar notifications no longer link projectless sessions/logs to `/projects/<name>`, preventing 404s for values such as `GlobalClaudeSkills`.
- Projectless session/log activity links to `/tokens?source=session`; chat activity links to `/chat?sessionId=<id>`.
- Chat page accepts `sessionId` from the URL so notification/activity links can open the matching conversation.

## Checks

- `npm run lint`
- `npm run build`

## Latest Update - Project Analyze UI Deduplication

- Added a compact mode to `AnalyzeProjectButton` so only the main Module Progress instance resumes polling and renders local Claude logs/transcript.
- Converted the onboarding banner, regenerate header action, and document-card Analyze action to compact triggers. They queue analysis and point users back to Module Progress instead of duplicating terminal output across the page.
- This removes the repeated analysis console blocks that appeared in the banner, module panel, and Documents card at the same time.

## Checks

- `npm run lint`
- `npm run build`

## Latest Update - Claude Analysis Context Compaction

- Added a requirement-focused BRD excerpt builder for local Claude analysis. The bridge now extracts full PDF text, detects all requirement IDs/groups, then attaches only requirement-bearing lines plus nearby context to Claude.
- The excerpt is now page-tagged (`## Page N | Req IDs: ...`) so Claude reads the BRD page-by-page and can reference source pages in task details/risk notes.
- Reduced first-pass generation scope to 1-4 features and 1-4 tasks per feature so Claude can return JSON reliably instead of timing out on oversized BRD/output combinations.
- Increased the default local analysis timeout from 600s to 900s.
- OmniBooking BRD test: full extract `74,299` chars, page count `28`, attached page-tagged excerpt `28,743` chars, all 21 requirement groups and 139 requirement IDs still detected.

## Checks

- `python -m py_compile hooks/gcs_bridge_daemon.py`

## Latest Update - Bridge Heartbeat During Local Claude Analysis

- Local analysis now sends bridge heartbeat every 30 seconds while Claude is running, so the dashboard no longer marks the device offline during long BRD analysis.
- Local analysis now posts a `Claude still running locally...` progress line every minute with remaining timeout, so the action timestamp stays fresh and the UI shows real liveness.
- The analysis timeout guard is logged at startup and remains a hard cap (`GCS_CLAUDE_ANALYZE_TIMEOUT_SEC`, default 900 seconds).

## Checks

- `python -m py_compile hooks/gcs_bridge_daemon.py`

## Latest Update - Robust Claude JSON Parsing

- Replaced the fragile greedy `{...}` parser with a tolerant Claude output parser.
- The bridge now accepts fenced JSON, JSON with trailing text, root `{ modules: [...] }`, or a single module object with `features`.
- This fixes failures such as `Extra data: line ...` after Claude successfully completes but wraps or fragments the JSON response.

## Checks

- `python -m py_compile hooks/gcs_bridge_daemon.py`
- Local parser smoke test for fenced module JSON and trailing-text root JSON.

## Latest Update - Confirmation Popups

- Added `apps/dashboard/src/components/ui/ConfirmDialog.tsx` as the shared in-app confirmation modal.
- Replaced browser/inline confirmation flows with modal popups for:
  - Bot role deletion in `apps/dashboard/src/components/create/CreateRoleClient.tsx`
  - Generic API key deletion in `apps/dashboard/src/components/settings/ApiKeysPanel.tsx`
  - Project backlog reset in `apps/dashboard/src/components/projects/ResetTasksButton.tsx`
  - Project removal danger zone in `apps/dashboard/src/components/settings/DangerZone.tsx`
  - Codex usage reset in `apps/dashboard/src/components/tokens/ResetUsageButton.tsx`
  - Knowledge lesson deletion in `apps/dashboard/src/components/knowledge/LessonCard.tsx`
- Verified there are no remaining `confirm()`, `alert()`, or `prompt()` usages in `apps/dashboard/src`.
- Checks: `npm run lint`, `npm run build`.

## Latest Update - Generated Task Details

- Added DB-backed task detail fields to `Task`: `summary`, `details`, `acceptanceCriteria`, `steps`, `priority`, and `risk`.
- Added migration `apps/dashboard/prisma/migrations/20260429103000_task_details/migration.sql`.
- Updated dashboard-run and local bridge analysis prompts to generate task objects instead of only task name strings.
- Kept backward compatibility: old string-only generated tasks are normalized into default detail/acceptance/steps.
- Local bridge callback now accepts both string tasks and detailed task objects.
- Task Board cards, slide-over detail, full task detail page, and project detail backlog now render the new task details.
- Checks: `npx prisma generate`, `python -m py_compile hooks/gcs_bridge_daemon.py`, `npm run lint`, `npm run build`.

## Latest Update - Analysis Transcript Details

- Local bridge analysis now saves an `analysisTranscript` into the bridge action result.
- Transcript includes prompt/context, Claude response text, raw output tail, session id, duration, cost, usage/model usage, terminal reason, and permission denials.
- Analyze status API returns transcript data for both explicit `actionId` polling and latest-action resume.
- Analyze UI now shows a `Details` button beside local output and opens a modal with Prompt/Context, Claude Response, Usage, and Permission Denials/Raw Tail.
- Checks: `python -m py_compile hooks/gcs_bridge_daemon.py`, `npm run lint`, `npm run build`.

## Changed Files

- `apps/dashboard/src/components/projects/OnboardingEmptyState.tsx`
- `apps/dashboard/src/components/tasks/CommitComposerModal.tsx`
- `apps/dashboard/src/components/tasks/detail/CommitComposerButton.tsx`
- `apps/dashboard/src/components/labs/ConceptScreen.tsx`
- `apps/dashboard/src/app/(app)/labs/obsidian-logic/page.tsx`
- `apps/dashboard/src/app/(app)/labs/void-protocol/page.tsx`
- `apps/dashboard/src/app/(app)/labs/void-terminal/page.tsx`
- `apps/dashboard/src/app/(app)/premium/page.tsx`
- `apps/dashboard/src/app/(app)/projects/[name]/detail/page.tsx`
- `apps/dashboard/src/app/(app)/projects/[name]/settings/page.tsx`
- `apps/dashboard/src/app/(app)/projects/[name]/page.tsx`
- `apps/dashboard/src/app/(app)/projects/page.tsx`
- `apps/dashboard/src/app/(app)/page.tsx`
- `apps/dashboard/src/app/(app)/tasks/[id]/page.tsx`
- `apps/dashboard/src/components/tasks/TaskDetailPanel.tsx`
- `apps/dashboard/src/lib/lab-metrics.ts`
- `apps/dashboard/src/app/actions/templates.ts`
- `apps/dashboard/src/app/actions/mcp.ts`
- `apps/dashboard/src/app/(app)/projects/templates/page.tsx`
- `apps/dashboard/src/components/projects/TemplateScaffoldForm.tsx`
- `apps/dashboard/src/components/mcp/McpForms.tsx`
- `apps/dashboard/src/components/chat/ChatClient.tsx`
- `apps/dashboard/src/lib/analytics.ts`
- `apps/dashboard/src/components/tokens/SessionsTable.tsx`
- `apps/dashboard/src/components/mcp/McpServerList.tsx`
- `apps/dashboard/src/components/mcp/McpProfileViewer.tsx`
- `apps/dashboard/src/components/knowledge/LessonsList.tsx`
- `apps/dashboard/src/components/knowledge/LessonCard.tsx`
- `apps/dashboard/src/components/projects/ProjectConsoleActions.tsx`
- `apps/dashboard/src/app/(app)/projects/[name]/detail/page.tsx`
- `apps/dashboard/src/components/dashboard/RecentActivity.tsx`
- `apps/dashboard/src/components/labs/ConceptScreen.tsx`
- `apps/dashboard/src/app/layout.tsx`
- `apps/dashboard/src/app/icon.tsx`
- `apps/dashboard/src/components/layout/PageDocumentTitle.tsx`
- `apps/dashboard/src/components/layout/TopBar.tsx`
- `apps/dashboard/src/components/layout/TopBarControls.tsx`
- `apps/dashboard/src/config/site.ts`
- `apps/dashboard/src/app/login/page.tsx`
- `apps/dashboard/src/components/library/AgentLibraryClient.tsx`
- `apps/dashboard/src/app/(app)/layout.tsx`
- `apps/dashboard/src/components/layout/PageTransition.tsx`
- `apps/dashboard/src/components/layout/PageShell.tsx`
- `apps/dashboard/src/components/layout/Sidebar.tsx`
- `apps/dashboard/src/components/dashboard/StatCard.tsx`
- `apps/dashboard/src/components/dashboard/TokenUsageCard.tsx`
- `hooks/gcs_bridge_daemon.py`
- `hooks/token-tracker.py`
- `apps/dashboard/src/lib/analytics.ts`
- `apps/dashboard/src/app/(app)/tokens/page.tsx`
- `apps/dashboard/src/components/tokens/DailyBarChart.tsx`
- `apps/dashboard/src/components/tokens/DateRangeTabs.tsx`
- `apps/dashboard/src/components/tokens/HeroMetric.tsx`
- `apps/dashboard/src/components/tokens/ProviderTokenBreakdown.tsx`
- `apps/dashboard/src/lib/format.ts`
- `apps/dashboard/src/components/tasks/KanbanBoard.tsx`
- `apps/dashboard/src/components/tokens/SessionsTable.tsx`
- `apps/dashboard/src/app/(app)/page.tsx`
- `apps/dashboard/scripts/repair-codex-token-totals.ts`
- `apps/dashboard/package.json`
- `apps/dashboard/src/lib/stats.ts`
- `apps/dashboard/src/components/tasks/TaskBoardSelectors.tsx`
- `apps/dashboard/src/lib/tasks.ts`
- `apps/dashboard/src/app/(app)/tasks/page.tsx`
- `apps/dashboard/src/components/wizard/Step1Path.tsx`
- `apps/dashboard/src/app/(app)/projects/new/actions.ts`
- `hooks/gcs_bridge_daemon.py`
- `hooks/ensure-gcs-bridge.ps1`
- `.codex/settings.json`
- `agents/BRIDGE.md`
- `.codex/README.md`
- `apps/dashboard/src/components/wizard/Step3Index.tsx`
- `apps/dashboard/src/components/wizard/Step4Done.tsx`
- `apps/dashboard/src/components/wizard/WizardShell.tsx`
- `apps/dashboard/src/components/dashboard/ActiveProjectsList.tsx`
- `apps/dashboard/src/components/projects/ProjectCard.tsx`
- `apps/dashboard/prisma/schema.prisma`
- `apps/dashboard/prisma/migrations/20260428160000_bridge_file_actions/migration.sql`
- `apps/dashboard/src/app/api/bridge/file-actions/pending/route.ts`
- `apps/dashboard/src/app/api/bridge/file-actions/result/route.ts`
- `apps/dashboard/src/app/api/bridge/heartbeat/route.ts`
- `apps/dashboard/src/app/(app)/projects/[name]/settings/actions.ts`
- `apps/dashboard/src/app/(app)/projects/[name]/page.tsx`
- `apps/dashboard/prisma/migrations/20260428163000_bridge_project_paths/migration.sql`
- `apps/dashboard/src/lib/settings.ts`
- `apps/dashboard/src/lib/projects.ts`
- `apps/dashboard/src/components/settings/GeneralSection.tsx`
- `apps/dashboard/src/components/settings/SettingsForm.tsx`
- `apps/dashboard/src/app/(app)/projects/[name]/settings/page.tsx`
- `apps/dashboard/src/app/actions/projects.ts`
- `apps/dashboard/src/components/projects/LocalDevicePathsCard.tsx`
- `apps/dashboard/src/components/projects/AnalyzeProjectButton.tsx`
- `apps/dashboard/src/components/projects/ProjectActionButtons.tsx`
- `apps/dashboard/src/lib/project-analysis.ts`
- `apps/dashboard/src/lib/project-operations.ts`
- `apps/dashboard/src/components/tokens/SyncOpenAIButton.tsx`
- `apps/dashboard/src/components/dashboard/TokenUsageCard.tsx`
- `apps/dashboard/src/components/tokens/ProviderTokenBreakdown.tsx`
- `apps/dashboard/src/components/tokens/HeroMetric.tsx`
- `apps/dashboard/src/components/tokens/SessionsTable.tsx`
- `apps/dashboard/src/lib/stats.ts`
- `apps/dashboard/src/lib/analytics.ts`
- `apps/dashboard/src/lib/token-accounting.ts`
- `apps/dashboard/src/lib/token-cleanup.ts`
- `apps/dashboard/src/app/api/log/route.ts`
- `apps/dashboard/src/app/api/tokens/reset-usage/route.ts`
- `apps/dashboard/src/components/tokens/ResetUsageButton.tsx`
- `apps/dashboard/src/app/api/roles/route.ts`
- `apps/dashboard/src/app/api/projects/[name]/analyze/route.ts`
- `apps/dashboard/src/app/api/projects/[name]/deploy/route.ts`
- `apps/dashboard/src/app/api/projects/[name]/reindex/route.ts`
- `apps/dashboard/src/app/(app)/projects/[name]/page.tsx`
- `apps/dashboard/src/app/(app)/projects/[name]/detail/page.tsx`
- `apps/dashboard/src/proxy.ts`
- `.codex/settings.json`
- `.codex/settings.local.json.example`
- `.gitignore`
- `hooks/gcs_env.py`
- `hooks/bridge-heartbeat.py`
- `hooks/token-tracker.py`
- `hooks/run-codex.py`
- `apps/dashboard/src/app/(app)/projects/new/actions.ts`
- `apps/dashboard/src/components/wizard/Step1Path.tsx`
- `apps/dashboard/src/components/wizard/Step4Done.tsx`

## Behavior

- Added onboarding empty state from the Stitch concept and wired it into dashboard/projects when there are no projects.
- Added commit composer modal and wired it into task drawer and full task detail.
- Added lab routes for `obsidian_logic`, `void_protocol`, and `void_terminal`.
- Added `/premium` to cover the premium dashboard Stitch screen.
- Added `/projects/[name]/detail` for the separate project detail console screen.
- Polished project settings with a left settings navigation column inspired by the MovieTheater settings screens.
- Added real project deploy/reindex server actions that write project activity into the database.
- Added local git status and commit endpoints for the commit composer. It reads staged changes and commits only staged files.
- Added activity export endpoint and wired `Download_logs.json` to a real JSON download.
- Bound `/labs/*` and `/premium` to live workspace metrics from projects, sessions, tools, roles, skills, and bridge devices.
- Added a real project template scaffold flow at `/projects/templates` and wired onboarding "Start from Template" to it.
- Added MCP server registration and MCP profile management server actions.
- Expanded chat to a three-column active session UI with context, files, active tools, and generated artifacts.
- Enriched token analytics history with provider, role/model, duration, export, and daily usage from both sessions and tool usage.
- Replaced the Token Analytics placeholder filter with working provider/source filters and clickable session detail cards.
- Added MCP Monitor server/profile detail views so server cards and profile server chips are inspectable.
- Added a Knowledge Base master-detail view so lessons can be clicked and reviewed without relying on hover-only controls.
- Replaced static project detail action text with working copy/open/settings actions and live project health labels.
- Made dashboard activity project events clickable and replaced the dead refresh icon with a real dashboard refresh link.
- Renamed lab/premium copy from concept language to workspace/runtime language backed by live metrics.
- Updated app metadata, generated favicon, and per-page browser titles so tabs display as `Library | GCS Console` instead of the old GlobalClaudeSkills Dashboard title.
- Standardized visible app naming to GCS Console and cleaned a Library import loading label.
- Changed the app shell to a fixed viewport layout: the sidebar stays at `100dvh`, sidebar nav scrolls internally, and page content scrolls independently.
- Compacted large dashboard token numbers and allowed stat values to wrap without stretching cards.
- Changed Codex token sync to store per-thread token baselines and send only token deltas into `ToolUsage` as provider `codex`.
- Added year range support to Token Analytics and grouped year view by month instead of showing a running thread total.
- Compacted large token totals in token analytics cards while preserving full values in tooltips.
- Added shared number/currency format helpers and standardized cost display, so values like `$356.8792` render as `$356.88`.
- Added backend-driven per-column Task Board paging via URL query params, with `Prev`, `Next`, `Show all`, and `Back to pages`, plus viewport-height column scroll.
- Added a dry-run-first Codex token repair script for removing old inflated Codex token/session rows after switching to delta-based sync.
- Made dashboard stats and token analytics ignore Codex `Session.totalTokens`; Codex token totals now come only from delta-based `ToolUsage`, so old long-running thread totals cannot inflate Today/Week/Month views.
- Added backend-driven Token Analytics table pagination with 12 rows per page and filter-aware page reset.
- Added Task Board `All Modules` selector backed by project-wide task/progress queries.
- Reset Task Board pagination automatically when project/module filters change, so server queries do not reuse stale page params.
- Added per-row time display to Token Analytics sessions and sorted recent sessions by full timestamp instead of date-only.
- Changed project folder scan so inaccessible local paths no longer block project creation; the wizard now shows a warning and allows creating an empty index for folders only visible to the local bridge machine.
- Changed Codex bridge sync to baseline existing Codex threads by default and only backfill existing thread totals when `GCS_CODEX_SYNC_EXISTING=1` is explicitly set. This prevents long-running Codex IDE threads from inflating Today with their full historical `tokens_used` total.
- Made bridge state writes atomic to avoid null/corrupt `.gcs_bridge_state.json` files after interruption.
- Added `hooks/ensure-gcs-bridge.ps1` and wired Codex settings/docs to use it so a single command starts the bridge in the background only when it is not already running.
- Added Codex daily token baselines using `thread_id + yyyy-mm-dd` state keys, while keeping legacy thread baselines for migration, so long-running Codex threads can be accounted by day.
- Fixed Windows project path scanning on hosted/Linux runtimes by deriving project slugs from both `\` and `/` separators, so `D:\Code\OmniBooking` becomes `omnibooking` instead of a path-like project name.
- Sanitized project names server-side during create and returned the final name to the wizard, then URL-encoded project links to avoid route breaks for existing path-like names.
- Clarified the project-create Done screen: generated files are GCS workspace metadata under `projects/<name>/...`; the source folder is not modified, especially when the dashboard runs on hosted infrastructure.
- Added cloud-to-local bridge file actions: the dashboard queues `BridgeFileAction` records, local bridge polls pending actions, writes safe relative files under the local project folder, and reports success/failure back to cloud.
- Project creation now queues local `.gcs/context.json`, `.gcs/progress.json`, and `.gcs/code-index.md` writes for the local bridge.
- Added bridge file-action APIs at `/api/bridge/file-actions/pending` and `/api/bridge/file-actions/result`.
- Fixed Project Settings save for DB-backed/cloud-created projects: settings no longer require `projects/registry.json`, update the database directly, and queue `.gcs/context.json` sync back to the local machine.
- Added `BridgeProjectPath` as the canonical per-device local path mapping. Each bridge device can now store a different folder path for the same project.
- Bridge file-action results now resolve `deviceKey`, persist the action device, and upsert the synced project path for that device.
- The local bridge now includes `deviceKey` when reporting file-action success/failure, so cloud can map writes back to the correct machine.
- Bridge heartbeat now reports local project paths discovered from `projects/*/context.json`, and the server upserts those paths by device so existing projects do not need a manual resync action.
- Project Settings now shows the primary fallback path plus all synced local device paths with device name, key, online status, and last sync time.
- Project Settings save now queues `.gcs/context.json` updates to all known device-specific paths for that project, falling back to the legacy project path only when no device path exists.
- Project detail path resolution now prefers the latest device-specific path and falls back to legacy `Project.path`.
- Project deploy/reindex events now record `cwd` from the latest device-specific path instead of only the legacy project path.
- Project overview and detail pages now show a Local Device Paths card with per-device folder path, online status, device key, and last sync time.
- Wired the project Analyze buttons to a real server action instead of a dead detail link.
- Analyze now generates a starter module/feature/task backlog from the linked BRD/PRD, sets the first analysis task active, records a project activity event, and queues `.gcs/progress.json` sync to local devices.
- Replaced the client-imported Analyze Server Action with a stable `/api/projects/[name]/analyze` endpoint. The Analyze button now calls the API with `fetch`, avoiding Next's `failed-to-find-server-action` error after deploy/client build mismatches.
- Moved project Deploy/Reindex UI actions to stable `/api/projects/[name]/deploy` and `/api/projects/[name]/reindex` endpoints for the same reason, so project action buttons no longer import Server Actions in client code.
- Fixed Analyze provider routing: the backend now uses the configured `analysis` role provider as source of truth. ChatGPT roles call the OpenAI credential path and no longer silently queue local Claude; generated sessions are recorded with the selected provider/model.
- Changed Analyze regeneration order so existing backlog data is only cleared after a direct AI/template result is ready, or immediately before a local bridge action is queued. Missing OpenAI keys no longer wipe current modules/tasks.
- Updated Analyze status copy to render the selected runner label instead of hard-coded `local Claude`.
- Deferred the OpenAI usage auto-sync effect with a timer so React lint no longer rejects synchronous state updates inside `useEffect`.
- Added token meter metadata across Dashboard and Token Analytics. Codex is labeled as `thread meter`, Claude as `hook estimate`, and ChatGPT/OpenAI as `provider reported`, so mixed telemetry is no longer presented as the same exact billing metric.
- Added OpenAI Codex rate-card credit estimation for Codex rows. GPT-5.5, GPT-5.4, GPT-5.4-Mini, GPT-5.3-Codex, and GPT-5.2 now map to their token-based credits per 1M token rates. Because local Codex SQLite currently exposes only total thread tokens, these rows show `input-equivalent` credits unless exact input/cache/output split exists.
- Removed automatic Codex spike thresholds. `/api/log`, Dashboard, and Token Analytics no longer ignore or delete rows based on token size; telemetry is kept as received from the bridge/provider.
- Added a dashboard-run Codex usage reset action at `/api/tokens/reset-usage` and a `Reset Codex` button on Token Analytics. It resets Codex telemetry for the logged-in workspace without touching projects, tasks, skills, Claude, or ChatGPT/OpenAI usage, so cleanup is explicit instead of threshold-based.
- Normalized ChatGPT roles in `/api/roles`: ChatGPT roles are stored and returned as `dashboard` execution with `openai` credential, and Codex roles remain `local` with no credential. This fixes BA Analyst showing `chatgpt` provider but `local` execution.
- Analyze now resolves `ba-analyst` first for analysis instead of picking the oldest analysis role, preventing stale Claude analysis roles from being selected when BA was switched to ChatGPT.
- Split OpenAI keys by purpose in Settings: `openai` is the runtime/model key, while `openai_admin` (or legacy `openai_usage`) is preferred for Token Analytics organization usage/cost sync with `api.usage.read`.
- Updated `/api/sync/openai-usage` to use OpenAI organization usage completions as the token source and organization costs as the optional USD source. Missing `api.usage.read` now returns a clear error instead of a misleading successful zero-sync response.
- Added an OpenAI usage key selector on Token Analytics. Sync now sends only the selected `apiKeyId`; the server validates workspace ownership and decrypts the key server-side, so multiple OpenAI/admin keys no longer get chosen implicitly.
- Replaced the browser `window.confirm` Codex reset prompt with an in-app confirmation modal.
- Added a Settings warning when an OpenAI runtime key exists but no OpenAI Usage/Admin key is configured.
- Hardened OpenAI usage sync error handling so upstream non-JSON/failed responses return dashboard JSON errors instead of bubbling into a Cloudflare 502 page.
- Reworked Settings so OpenAI is configured as one grouped provider card with two encrypted inputs: `OpenAI API Key` for runtime/model calls and `OpenAI Admin API Key` for usage/cost sync.
- Prevented BA Analyst ChatGPT analysis from silently falling back to local Claude. If BA is configured as ChatGPT and OpenAI analysis cannot complete, the project page now returns a ChatGPT/OpenAI key error instead of queuing `claude -p`.
- Fixed local Claude analysis max-turn failures by raising the bridge `claude -p` default from 1 to 4 turns (`GCS_CLAUDE_ANALYZE_MAX_TURNS` override) and surfacing stdout JSON errors in the dashboard when Claude exits non-zero.
- Allowed the bridge callback route `/api/projects/:name/analyze/result` through the dashboard proxy while keeping route-level bridge-token verification, fixing 401 Unauthorized when local Claude posts generated modules/tasks back to cloud.
- Extended project Analyze polling from 2 minutes to 10 minutes and made the status API return running bridge progress, so local Claude/PDF analysis is not marked timed out while the bridge is still working.
- Preserved bridge progress logs when file actions complete, added structured local-Claude analysis progress lines, and returned a generated backlog summary for UI review.
- Added a Generated Backlog Review panel after Analyze completes with module/feature/task previews plus links to Project Detail and Task Board.
- Revalidated the project detail route after bridge analysis result callbacks so generated modules/tasks appear on follow-up views.
- Expanded Project Detail from module-only progress into a full generated backlog tree: modules now show features and clickable task rows linking to task detail pages.
- Made Module Progress rows on the project overview clickable, routing directly to the Task Board filtered by that module.
- Fixed bridge file sync auth by allowing `/api/bridge/file-actions/*` through the dashboard proxy. Before this, the route returned `401` before bridge-token verification, so local daemon could heartbeat but could not poll/write cloud-to-local file actions.
- Created a cloud bridge token for this machine, stored it in gitignored `.codex/settings.local.json` under `env.BRIDGE_TOKEN`, restarted the local bridge, manually drained the existing queued OmniBooking file action, wrote `.gcs/context.json`, `.gcs/progress.json`, and `.gcs/code-index.md` to `D:\Code\OmniBooking`, then reported the action as succeeded.
- Removed bridge-token guidance that suggested Windows environment variables; Chat and Settings now point to `.codex/settings.local.json`.
- Removed manual machine-specific bridge variables (`GCS_DEVICE_KEY`, `GCS_DEVICE_NAME`) from settings/docs/examples. Local scripts now auto-generate a per-account/per-machine identity in gitignored `hooks/.gcs_device.json` using the bridge token as account/workspace scope.
- Added a gitignored `hooks/.gcs_project_paths.json` local registry so each machine remembers the project folders it owns after file-action sync and can report those paths on heartbeat without global machine variables.
- Added cloud-only project creation: users can create dashboard projects with no local source folder, use documents/API keys/chat/analysis in cloud, and attach a local bridge later only when they need local file sync/actions.
- Fixed stale project-path ownership after device identity changes: heartbeat and file-action result now remove duplicate path mappings for the same workspace/project/path on older devices, and project/settings path cards sort online devices first.
- Standardized local device/settings timestamps through `formatDateTime()` with default timezone `Asia/Ho_Chi_Minh` (`NEXT_PUBLIC_APP_TIME_ZONE` override), so device path sync times render in ICT instead of browser/host-default ambiguous time.
- Fixed Analyze queue reuse after reset/regenerate: resetting a backlog now deletes stale `run_analysis` bridge actions for that project, starting a new local analysis clears old analysis actions before queueing, and the bridge pending endpoint prioritizes fresh `run_analysis` jobs ahead of older generic file actions. This prevents the UI from getting stuck at `Queued - waiting for local Claude...` after a reset.
- Added an Analyze cancel flow: `/api/projects/:name/analyze/cancel` marks pending/claimed/running analysis actions as `cancelled`, the Analyze UI shows a `Cancel` button while polling, stops local polling immediately, and bridge result callbacks ignore cancelled actions so late local-Claude results cannot overwrite the cancelled state.
- Hardened stuck Analyze recovery: the `Cancel` button now appears whenever an active analysis action exists, not only when the local polling state is true; bridge progress callbacks also ignore cancelled actions; and the status API auto-cancels stale analysis actions after `GCS_ANALYSIS_STALE_MINUTES` (default 30 minutes) without progress.
- Changed the Dashboard token card back to token/equivalent-token display and moved Codex credits into tooltip/detail-only context, avoiding confusing primary values like fractional `credits` on the dashboard summary card.
- Added a bridge action status endpoint and made the local bridge cancel-aware while Claude is running. The daemon now checks `/api/bridge/file-actions/:id/status` during local analysis, kills the Claude process when the dashboard action is cancelled, and posts a local cancellation progress line.
- Recorded local Claude Analyze telemetry as a real `Session` row when `/api/projects/:name/analyze/result` receives `analysisTranscript`. Dashboard and Token Analytics now include analysis token/cost/model data instead of only showing the generated backlog.
- Added Dashboard fallback accounting for older completed Analyze actions that already have `analysisTranscript` but were created before session telemetry existed, so Claude analysis tokens show without rerunning the BRD analysis.
- Added local task execution: task detail can queue a `run_task` bridge action, poll progress, and show local agent output. The bridge now runs Claude/Codex in the registered local project path, writes `.gcs/tasks/<taskId>/implementation.md`, posts artifacts/task events/log telemetry, and marks non-zero exits as failed.
- Task runs now show the actual local command preview (`CMD: ...`), persist the task prompt to `.gcs/tasks/<taskId>/prompt.txt`, stream `stdout>`/`stderr>` lines to the dashboard progress panel, and tee the same output to the bridge terminal while the process is running.
- Added task-run cancellation and command ergonomics: task detail now has `Cancel` for active local runs, `Copy CMD` once the bridge reports the command, and `/api/tasks/:id/run/cancel` marks pending/running task actions as cancelled so the bridge kills the local process on its next status check.
- Expanded task runs with selectable phase/provider controls. Task Detail can now queue `Prepare Brief`, `Implement`, or `Review` against `Auto`, `Claude local`, or `Codex local`, and shows the resolved command in a dedicated command strip before the streaming log.
- Added quick-run access from the Task Board drawer by embedding the same Local Agent Run controls directly in the selected task panel, and made the Dashboard `Run Task` action open the current active task when one exists.
- Added project-level run navigation: `/api/projects/:name/run-next` resolves the active task or next pending task, and Project Overview now exposes quick `Run` buttons in the top actions and Active Task card to jump straight into the executable task flow.
- Upgraded project-level `Run` buttons to queue the active/next task immediately before opening the task detail page, so the user lands directly on the live command/output stream instead of needing a second click.
- Upgraded the Dashboard `Run Task` button as well: it now chooses the active project/task (or first incomplete project), queues the task run, and navigates straight to the live task stream.
- Added chain-running support after a successful task: `/api/tasks/:id/next` resolves the next pending task in the same project, and the Local Agent Run panel shows `Run Next` to queue it with the same phase/provider settings and open its stream.
- Added small batch chaining: `/api/tasks/:id/next-batch?limit=3` resolves the next pending tasks in project order, and the Local Agent Run panel shows `Run Next 3` after success to queue several bridge task runs sequentially.
- Added project-level task run observability: `/api/projects/:name/run-queue` returns recent local `run_task` actions for the project, and Project Overview now shows a polling `Run Queue` card with status, provider/phase, device, latest log line, and links back to each task stream.
- Expanded the project Run Queue into a control surface: queue rows now include the task name, `Cancel` for pending/running local runs, and `Retry` for failed/cancelled runs using the same phase/provider settings.
- Added expandable process details to Project Run Queue rows. Each row can now show the latest captured command/output tail, artifact path, and a `Copy CMD` action when the bridge has emitted the local command.
- Added project-level batch queueing: Project Overview now has `Run Next 3`, which queues the active/next task plus the following pending tasks without navigating away, then refreshes the Run Queue in place.
- Added Run Queue header bulk controls: `Cancel Live` cancels visible pending/running task runs, and `Retry Failed` requeues visible failed/cancelled task runs without opening each task detail.
- Added backend-backed Run Queue expansion. `/api/projects/:name/run-queue` now returns `total` and up to 80 log lines per action, while the Project Overview queue shows `visible/total` and a `Show more runs` control instead of hiding older runs permanently.
- Added backend Run Queue status filtering. The API accepts `status=all|live|failed|done`, and Project Overview now has segmented filters that reset pagination and make it easier to focus on live, failed/cancelled, or completed task runs.
- Added Run Queue summary counts. The backend now returns all/live/failed/done counts for the project, and each filter tab shows its count so queue health is visible at a glance.

## Checks

- `npm run lint`
- `npm run build`
- `npx tsc --noEmit`
- `python -m py_compile hooks/gcs_bridge_daemon.py hooks/token-tracker.py`
- `powershell -NoProfile -ExecutionPolicy Bypass -File hooks/ensure-gcs-bridge.ps1`
- `npx prisma generate`
- `npx prisma migrate deploy`
- `python -m py_compile hooks/gcs_bridge_daemon.py`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `python -m py_compile hooks/gcs_bridge_daemon.py`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

## Gaps

- Local git commit and open-local actions require the dashboard runtime to have access to the project path.
- Template scaffold creates a minimal local starter; richer framework-specific templates can be added on top of the same action.
